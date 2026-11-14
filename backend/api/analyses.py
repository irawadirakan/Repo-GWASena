"""Alur utama UC-01 "Run GWAS Pipeline" (FR-02 s.d. FR-06, FR-09 CSV, FR-10, FR-11, FR-12).

Urutan pemakaian:
  1. POST /api/analyses                         buat sesi analisis
  2. POST /api/analyses/{id}/upload             unggah VCF + CSV, validasi, cocokkan Sample ID
  3. PUT  /api/analyses/{id}/parameters         atur parameter QC dan model (GLM/MLM)
  4. POST /api/analyses/{id}/run                jalankan QC -> PCA -> GLM/MLM -> koreksi
  5. GET  /api/analyses/{id}/status             pantau kemajuan
  6. GET  /api/analyses/{id}/results            lihat hasil
  7. GET  /api/analyses/{id}/results/csv        unduh hasil CSV (?hanya_signifikan=true untuk SNP signifikan)
"""
import csv
import gzip
import io
import shutil
import time
import zipfile
from pathlib import Path

import numpy as np
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import HTMLResponse, Response
from sqlalchemy import delete, func, select
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user, owned_analysis
from backend.core.config import ROOT_DIR, settings
from backend.core.database import get_db
from backend.models import (
    SNP,
    Analysis,
    AnalysisLog,
    AnalysisModel,
    AnalysisParameter,
    AnalysisStatus,
    AssociationResult,
    Dataset,
    Phenotype,
    User,
    VisualizationResult,
)
from backend.schemas import AnalysisCreate, AnalysisUpdate, ParameterIn
from backend.services import dataset_service as ds
from backend.services import annotation_service, plot_service, report_service
from backend.services.analysis_runner import dispatch
from pipeline.annotation import detect_organism_from_dataset, scientific_name
from pipeline.errors import ValidationError
from pipeline.runner import MIN_SAMPLES, STAGES
from pipeline.visualization.downsample import smart_downsample
from pipeline.validation import match_sample_ids, read_genotype, read_phenotype_csv

router = APIRouter(prefix="/api/analyses", tags=["2. analisis (alur utama)"])

LOCKED = (AnalysisStatus.ANTRE, AnalysisStatus.BERJALAN)

TIPS = {
    "validasi": [
        "ID sampel pada VCF dan CSV harus sama persis agar genotipe dan fenotipe tiap tanaman "
        "dipasangkan dengan benar.",
    ],
    "qc": [
        "MAF menyaring SNP yang alel minornya terlalu jarang; uji statistik pada SNP seperti ini "
        "tidak stabil.",
        "Missingness tinggi pada satu sampel bisa menandakan kualitas DNA atau genotyping yang "
        "kurang baik.",
        "Bawang putih umumnya diperbanyak secara klonal, sehingga filter HWE dan kekerabatan "
        "perlu dipakai dengan hati-hati.",
    ],
    "pca": [
        "PCA merangkum struktur populasi, misalnya perbedaan asal varietas, agar tidak salah "
        "dianggap sebagai efek SNP.",
    ],
    "asosiasi": [
        "GLM menguji hubungan setiap SNP dengan sifat, dengan komponen PCA sebagai kovariat untuk "
        "mengurangi hasil positif palsu.",
        "MLM menambahkan matriks kekerabatan (kinship), sehingga lebih tepat untuk bawang putih "
        "yang banyak memiliki klon atau kerabat dekat.",
    ],
    "koreksi": [
        "Bonferroni membagi alpha dengan jumlah SNP sehingga sangat ketat; FDR mengendalikan "
        "proporsi temuan palsu sehingga lebih longgar.",
    ],
}


def _detail(message: str, details: list[str] | None = None) -> dict:
    return {"pesan": message, "rincian": details or []}


def _resolve_session_organism(db: Session | None, a: Analysis) -> tuple[str, str]:
    """Kembalikan (kode_organisme, nama_ilmiah) akurat; inferensi sesi lama bila masih default."""
    raw = (a.organism or "").strip()
    if raw and raw.lower() not in ("allium sativum", "allium sativum l.", "allium_sativum"):
        return raw, scientific_name(raw)

    if db is not None:
        ds_names = db.scalars(select(Dataset.file_name).where(Dataset.analysis_id == a.analysis_id)).all()
        chrom_rows = db.scalars(
            select(SNP.chromosome).where(SNP.analysis_id == a.analysis_id).distinct()
        ).all()
        sample_snps = db.scalars(
            select(SNP.snp_code).where(SNP.analysis_id == a.analysis_id).limit(25)
        ).all()
        traits = ds.available_traits(db, a.analysis_id)
        inferred = detect_organism_from_dataset(
            filenames=[a.analysis_name, *ds_names],
            traits=[t for t in [a.trait_name, *traits] if t],
            num_chromosomes=len(chrom_rows) or None,
            snp_ids=sample_snps,
        )
        if inferred.get("auto_detected") and inferred.get("organism") != "allium_sativum":
            code = inferred["organism"]
            return code, inferred.get("organism_label") or scientific_name(code)

    code = raw or "Allium sativum"
    return code, scientific_name(code)


def _resolve_session_trait(db: Session | None, a: Analysis) -> str | None:
    """Kembalikan nama sifat aktif dari Analysis, AnalysisParameter, atau kolom fenotipe pertama."""
    if a.trait_name and str(a.trait_name).strip():
        return str(a.trait_name).strip()
    if db is not None:
        param = db.scalar(select(AnalysisParameter).where(AnalysisParameter.analysis_id == a.analysis_id))
        cfg_trait = (param.parameter_config or {}).get("trait") if param and param.parameter_config else None
        if cfg_trait and str(cfg_trait).strip():
            return str(cfg_trait).strip()
        traits = ds.available_traits(db, a.analysis_id)
        if traits:
            return traits[0]
    return None


def _summary(a: Analysis, db: Session | None = None) -> dict:
    org_code, org_label = _resolve_session_organism(db, a)
    trait_val = _resolve_session_trait(db, a)
    return {
        "analysis_id": a.analysis_id,
        "analysis_name": a.analysis_name,
        "status": a.status,
        "organism": org_code,
        "organism_label": org_label,
        "analysis_time": a.analysis_time,
        "trait": trait_val,
        "trait_name": trait_val,
        "model_name": a.model_name,
        "lambda_gc": a.lambda_gc,
        "significant_count": a.significant_count,
    }


# ------------------------------------------------------------------ daftar & referensi
@router.get("", summary="Daftar analisis milik pengguna (FR-12)")
def list_analyses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Analysis).order_by(Analysis.analysis_id.desc())
    if user.role != "administrator":
        stmt = stmt.where(Analysis.user_id == user.user_id)
    rows = db.scalars(stmt).all()
    if not rows:
        return []

    aids = [a.analysis_id for a in rows]
    ds_by_aid: dict[int, list[str]] = {}
    for aid, fname in db.execute(select(Dataset.analysis_id, Dataset.file_name).where(Dataset.analysis_id.in_(aids))).all():
        ds_by_aid.setdefault(aid, []).append(fname)

    param_trait_by_aid: dict[int, str] = {}
    for aid, cfg in db.execute(
        select(AnalysisParameter.analysis_id, AnalysisParameter.parameter_config).where(AnalysisParameter.analysis_id.in_(aids))
    ).all():
        t = (cfg or {}).get("trait") if isinstance(cfg, dict) else None
        if t:
            param_trait_by_aid[aid] = str(t).strip()

    chrom_cnt_by_aid: dict[int, int] = dict(
        db.execute(
            select(SNP.analysis_id, func.count(func.distinct(SNP.chromosome)))
            .where(SNP.analysis_id.in_(aids))
            .group_by(SNP.analysis_id)
        ).all()
    )
    sample_snp_by_aid: dict[int, str | None] = dict(
        db.execute(
            select(SNP.analysis_id, func.min(SNP.snp_code))
            .where(SNP.analysis_id.in_(aids))
            .group_by(SNP.analysis_id)
        ).all()
    )

    out = []
    for a in rows:
        aid = a.analysis_id
        raw_org = (a.organism or "").strip()
        if raw_org and raw_org.lower() not in ("allium sativum", "allium sativum l.", "allium_sativum"):
            org_code = raw_org
        else:
            inferred = detect_organism_from_dataset(
                filenames=[a.analysis_name, *ds_by_aid.get(aid, [])],
                traits=[t for t in [a.trait_name, param_trait_by_aid.get(aid)] if t],
                num_chromosomes=chrom_cnt_by_aid.get(aid) or None,
                snp_ids=[sample_snp_by_aid[aid]] if sample_snp_by_aid.get(aid) else None,
            )
            org_code = (
                inferred["organism"]
                if inferred.get("auto_detected") and inferred.get("organism") != "allium_sativum"
                else (raw_org or "Allium sativum")
            )
        trait_val = (a.trait_name or "").strip() or param_trait_by_aid.get(aid) or None
        out.append({
            "analysis_id": aid,
            "analysis_name": a.analysis_name,
            "status": a.status,
            "organism": org_code,
            "organism_label": scientific_name(org_code),
            "analysis_time": a.analysis_time,
            "trait": trait_val,
            "trait_name": trait_val,
            "model_name": a.model_name,
            "lambda_gc": a.lambda_gc,
            "significant_count": a.significant_count,
        })
    return out


@router.get("/models", summary="Daftar model uji asosiasi")
def list_models(db: Session = Depends(get_db)):
    rows = db.scalars(select(AnalysisModel).order_by(AnalysisModel.model_id)).all()
    return [
        {"model_id": m.model_id, "model_name": m.model_name, "description": m.description,
         "tersedia": True}
        for m in rows
    ]


# ------------------------------------------------------------------ 1. buat sesi
@router.post("", status_code=status.HTTP_201_CREATED, summary="1. Buat sesi analisis")
def create_analysis(data: AnalysisCreate, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    kwargs = {"organism": data.organism.strip()} if data.organism and data.organism.strip() else {}
    a = Analysis(user_id=user.user_id, analysis_name=data.analysis_name, status=AnalysisStatus.DRAFT, **kwargs)
    db.add(a)
    db.commit()
    db.refresh(a)
    return {**_summary(a), "pesan": "Sesi analisis dibuat. Unggah berkas genotipe dan fenotipe.",
            "langkah_berikutnya": f"POST /api/analyses/{a.analysis_id}/upload"}


@router.get("/{analysis_id}", summary="Detail sesi analisis")
def get_analysis(a: Analysis = Depends(owned_analysis), db: Session = Depends(get_db)):
    datasets = db.scalars(select(Dataset).where(Dataset.analysis_id == a.analysis_id)).all()
    param = db.scalar(select(AnalysisParameter).where(AnalysisParameter.analysis_id == a.analysis_id))
    return {
        **_summary(a, db=db),
        "berkas": [{"nama_berkas": d.file_name, "jenis": d.file_type,
                    "sample_count": d.sample_count, "snp_count": d.snp_count,
                    "status_validasi": d.validation_status, "diunggah": d.upload_time}
                   for d in datasets],
        "sifat_tersedia": ds.available_traits(db, a.analysis_id),
        "phenotype_columns": ds.available_traits(db, a.analysis_id),
        "parameter": param.parameter_config if param else None,
    }


@router.patch("/{analysis_id}", summary="Perbarui nama atau atribut sesi analisis")
def update_analysis(data: AnalysisUpdate, a: Analysis = Depends(owned_analysis), db: Session = Depends(get_db)):
    if data.analysis_name is None and data.organism is None:
        raise HTTPException(422, _detail("Tidak ada atribut sesi yang diperbarui."))
    if data.analysis_name is not None:
        nama = data.analysis_name.strip()
        if not nama:
            raise HTTPException(422, _detail("Nama sesi tidak boleh kosong."))
        a.analysis_name = nama
    if data.organism is not None:
        org = data.organism.strip()
        if not org:
            raise HTTPException(422, _detail("Organisme target tidak boleh kosong."))
        a.organism = org
    db.commit()
    db.refresh(a)
    pesan = "Nama sesi diperbarui." if data.organism is None else "Atribut sesi diperbarui."
    return {**_summary(a), "pesan": pesan}


@router.delete("/{analysis_id}", summary="Hapus sesi analisis beserta berkas dan hasilnya (riwayat)")
def delete_analysis(a: Analysis = Depends(owned_analysis), db: Session = Depends(get_db)):
    if a.status in LOCKED:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            _detail("Analisis sedang berjalan; sesi belum dapat dihapus.",
                                    ["Tunggu sampai status selesai atau gagal, lalu coba lagi."]))
    aid, nama = a.analysis_id, a.analysis_name
    ds.clear_analysis_data(db, aid)
    db.execute(delete(AnalysisParameter).where(AnalysisParameter.analysis_id == aid),
               execution_options={"synchronize_session": False})
    db.delete(a)
    db.commit()
    ds.remove_dir(aid)
    return {"pesan": f"Sesi analisis '{nama}' telah dihapus.", "analysis_id": aid}


# ------------------------------------------------------------------ 2. unggah & validasi
def _check_minimum(geno) -> None:
    """Menolak data yang pasti gagal dianalisis, supaya pengguna tahu sejak tahap unggah (AC-02.2)."""
    if geno.n_snps == 0:
        raise ValidationError(
            "Berkas genotipe tidak berisi SNP bialelik yang dapat dianalisis.",
            [f"Varian dilewati: {geno.skipped}" if geno.skipped else "Berkas tidak memiliki baris varian.",
             "GWASena hanya memakai SNP dengan satu alel REF dan satu alel ALT (A, C, G, T)."])
    if geno.n_samples < MIN_SAMPLES:
        raise ValidationError(
            "Jumlah sampel terlalu sedikit untuk analisis GWAS.",
            [f"Berkas berisi {geno.n_samples} sampel; minimal {MIN_SAMPLES} sampel."])


def _read_vcf_header_preview(path: Path, max_lines: int = 80) -> str:
    """Ambil baris header VCF (# / ##) secukupnya untuk deteksi referensi spesies."""
    try:
        opener = gzip.open if str(path).lower().endswith(".gz") else open
        header_lines: list[str] = []
        with opener(path, "rt", encoding="utf-8", errors="replace") as fh:
            for _ in range(max_lines):
                line = fh.readline()
                if not line:
                    break
                if line.startswith("#"):
                    header_lines.append(line.strip())
                else:
                    break
        return "\n".join(header_lines)
    except OSError:
        return ""


def _upload_warnings(geno, pheno) -> list[str]:
    """Hal yang tidak menggagalkan unggahan tetapi perlu diketahui pengguna."""
    out = []
    for nama, alasan in pheno.ignored.items():
        out.append(f"Kolom '{nama}' tidak dipakai sebagai sifat: {alasan}.")
    for alasan, n in (geno.skipped or {}).items():
        label = {"multialelik": "multialelik", "bukan_snp": "bukan SNP (indel atau basa selain A/C/G/T)",
                 "posisi_tidak_diketahui": "posisinya tidak diketahui (0 atau negatif)"}.get(alasan, alasan)
        out.append(f"{n} varian dilewati karena {label}.")
    for nama, nilai in pheno.traits.items():
        terisi = int(np.isfinite(nilai).sum())
        if terisi < MIN_SAMPLES:
            out.append(f"Sifat '{nama}' hanya terisi pada {terisi} sampel (minimal {MIN_SAMPLES}); "
                       "sifat ini tidak dapat dianalisis.")
        elif terisi < len(nilai):
            out.append(f"Sifat '{nama}' kosong pada {len(nilai) - terisi} sampel; sampel tersebut "
                       "tidak ikut dalam uji asosiasi sifat ini.")
    return out

@router.post("/{analysis_id}/upload", summary="2. Unggah genotipe (VCF atau PLINK biner) + CSV dan validasi")
def upload(
    a: Analysis = Depends(owned_analysis),
    genotipe: UploadFile = File(..., description="Berkas genotipe .vcf, .vcf.gz, atau .bed (PLINK biner)"),
    fenotipe: UploadFile = File(..., description="Berkas fenotipe .csv (kolom sample_id + sifat)"),
    bim: UploadFile | None = File(None, description="Wajib bila genotipe berupa .bed: berkas .bim"),
    fam: UploadFile | None = File(None, description="Wajib bila genotipe berupa .bed: berkas .fam"),
    db: Session = Depends(get_db),
):
    # field berkas opsional yang dikirim kosong dianggap tidak diunggah
    bim = bim if bim is not None and bim.filename else None
    fam = fam if fam is not None and fam.filename else None
    sumber = {"genotipe": genotipe, "fenotipe": fenotipe, "bim": bim, "fam": fam}
    return _ingest(a, db, {k: (v.filename if v else None) for k, v in sumber.items()},
                   lambda key, target: ds.save_upload(sumber[key], target))


def _ingest(a: Analysis, db: Session, names: dict, save) -> dict:
    """Simpan, validasi, dan catat berkas genotipe + fenotipe untuk satu sesi.

    ``names`` berisi nama berkas asli (genotipe, fenotipe, bim, fam); ``save(key, target)`` menulis
    isi berkas ``key`` ke ``target``. Dipakai oleh unggahan pengguna dan dataset contoh.
    """
    if a.status in LOCKED:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            _detail("Analisis sedang berjalan; unggahan dikunci sampai selesai."))
    folder = ds.analysis_dir(a.analysis_id)
    g_name, p_name, bim_name, fam_name = names["genotipe"], names["fenotipe"], names.get("bim"), names.get("fam")
    try:
        plink = ds.is_plink(g_name)
        ds.check_extensions(g_name, p_name, bim_name, fam_name)
        ds.remove_dir(a.analysis_id)
        folder.mkdir(parents=True, exist_ok=True)
        if plink:
            g_path = folder / "genotipe.bed"
            save("bim", folder / "genotipe.bim")
            save("fam", folder / "genotipe.fam")
        else:
            g_path = folder / ("genotipe.vcf.gz" if g_name.lower().endswith(".gz") else "genotipe.vcf")
        p_path = folder / "fenotipe.csv"
        save("genotipe", g_path)
        save("fenotipe", p_path)
        geno = read_genotype(g_path)
        pheno = read_phenotype_csv(p_path)
        match = match_sample_ids(geno.samples, pheno.samples)
        _check_minimum(geno)
    except ValidationError as exc:
        ds.remove_dir(a.analysis_id)
        ds.clear_analysis_data(db, a.analysis_id)
        a.status = AnalysisStatus.DRAFT
        db.add(AnalysisLog(analysis_id=a.analysis_id, stage="validasi", status="gagal",
                           message="\n".join([exc.message, *exc.details])))
        db.commit()
        raise HTTPException(422, _detail(exc.message, exc.details))

    ds.clear_analysis_data(db, a.analysis_id)
    info = ds.store_datasets(db, a.analysis_id, g_name, g_path, p_name, p_path, geno, pheno,
                             genotype_type="plink_bed" if plink else "vcf")
    # Auto-rename sesi jika pengguna membiarkan nama default
    default_names = {"Sesi Analisis Baru", "Analisis Asosiasi Genomik 2026", "Analisis Baru", "Analisis Tanpa Judul", ""}
    if a.analysis_name in default_names or a.analysis_name.startswith("Sesi Analisis"):
        stem = Path(g_name).stem
        if stem.lower().endswith(".vcf"):
            stem = Path(stem).stem
        a.analysis_name = f"Analisis {stem}"

    vcf_header = _read_vcf_header_preview(g_path) if not plink else ""
    distinct_chroms = {str(c).strip() for c in (geno.chrom or []) if str(c).strip()}
    detected_org = detect_organism_from_dataset(
        filenames=[f for f in [g_name, p_name, bim_name, fam_name] if f],
        traits=list(pheno.traits.keys()),
        num_chromosomes=len(distinct_chroms) or None,
        vcf_header=vcf_header,
        snp_ids=list(geno.ids[:25]),
    )
    a.organism = detected_org["organism"]
    if not a.trait_name and pheno.trait_names:
        a.trait_name = pheno.trait_names[0]
    a.status = AnalysisStatus.TERVALIDASI
    db.add(AnalysisLog(analysis_id=a.analysis_id, stage="validasi", status="selesai",
                       message=f"{geno.n_samples} sampel, {geno.n_snps} SNP; Sample ID cocok"))
    db.commit()
    db.refresh(a)
    return {
        "pesan": "Berkas valid. Lanjutkan ke pengaturan parameter.",
        "peringatan": _upload_warnings(geno, pheno),
        "analysis_id": a.analysis_id,
        "analysis_name": a.analysis_name,
        "status": a.status,
        **info,
        "kecocokan_sample_id": match,
        "organism": a.organism,
        "organism_label": scientific_name(a.organism),
        "trait": (pheno.trait_names[0] if pheno.trait_names else None),
        "trait_name": (pheno.trait_names[0] if pheno.trait_names else None),
        "detected_organism": detected_org,
        "langkah_berikutnya": f"PUT /api/analyses/{a.analysis_id}/parameters",
    }


# ------------------------------------------------------------------ dataset contoh (benchmark)
CONTOH_DIR = ROOT_DIR / "data" / "contoh"
BENCHMARK_FILES = {
    "VCF": {"genotipe": "genotipe_bawang_putih_mini.vcf", "fenotipe": "fenotipe_bawang_putih_mini.csv"},
    "PLINK": {"genotipe": "genotipe_bawang_putih_mini.bed", "bim": "genotipe_bawang_putih_mini.bim",
              "fam": "genotipe_bawang_putih_mini.fam", "fenotipe": "fenotipe_bawang_putih_mini.csv"},
}


class BenchmarkIn(BaseModel):
    format: str = Field("VCF", description="VCF atau PLINK")
    analysis_id: int | str | None = Field(None, description="Sesi yang dipakai; kosong atau tidak valid = sesi baru")


def _load_benchmark(user: User, db: Session, fmt: str, analysis_id) -> dict:
    fmt = (fmt or "VCF").strip().upper()
    if fmt not in BENCHMARK_FILES:
        raise HTTPException(422, _detail("Format dataset contoh tidak dikenal.", ["Pilihan: VCF atau PLINK"]))
    files = BENCHMARK_FILES[fmt]
    hilang = [n for n in files.values() if not (CONTOH_DIR / n).is_file()]
    if hilang:
        raise HTTPException(500, _detail("Berkas dataset contoh tidak ditemukan di server.",
                                         [f"Tidak ada: data/contoh/{n}" for n in hilang]))

    # Pakai sesi yang diminta bila milik pengguna dan tidak sedang berjalan; selain itu buat sesi baru.
    a = None
    try:
        a = db.get(Analysis, int(analysis_id)) if analysis_id not in (None, "") else None
    except (TypeError, ValueError):
        a = None
    sesi_baru = a is None or a.user_id != user.user_id or a.status in LOCKED
    if sesi_baru:
        a = Analysis(user_id=user.user_id, analysis_name="Analisis Bobot Umbi Bawang Putih (contoh)",
                     status=AnalysisStatus.DRAFT)
        db.add(a)
        db.commit()
        db.refresh(a)

    hasil = _ingest(a, db, {"genotipe": files["genotipe"], "fenotipe": files["fenotipe"],
                            "bim": files.get("bim"), "fam": files.get("fam")},
                    lambda key, target: shutil.copyfile(CONTOH_DIR / files[key], target))
    g, f = hasil.get("genotipe") or {}, hasil.get("fenotipe") or {}
    return {
        **hasil,
        "status": "success",
        "status_analisis": hasil["status"],
        "sesi_baru": sesi_baru,
        "dataset_type": fmt,
        "pesan": "Dataset contoh bawang putih dimuat. Lanjutkan ke pengaturan parameter.",
        "validation": {
            "is_valid": True,
            "sample_count": g.get("jumlah_sampel"),
            "snp_count": g.get("jumlah_snp"),
            "trait_count": len(f.get("daftar_sifat") or f.get("sifat_tersedia") or []),
            "qc_status": "Lolos validasi berkas (QC dijalankan saat analisis)",
        },
        "files": {
            "genotype": [files[k] for k in ("genotipe", "bim", "fam") if k in files],
            "phenotype": [files["fenotipe"]],
        },
    }


@router.post("/benchmark", summary="Muat dataset contoh bawang putih (VCF atau PLINK) ke sesi analisis")
def load_benchmark(data: BenchmarkIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _load_benchmark(user, db, data.format, data.analysis_id)


@router.post("/{analysis_id}/load-benchmark", summary="Muat dataset contoh ke sesi tertentu")
def load_benchmark_to(analysis_id: int, data: BenchmarkIn | None = None,
                      user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _load_benchmark(user, db, data.format if data else "VCF", analysis_id)


@router.get("/benchmark/download", summary="Unduh berkas dataset contoh (ZIP)",
            response_class=Response, responses={200: {"content": {"application/zip": {}}}})
def download_benchmark(format: str = Query("all", description="vcf, plink, atau all")):
    fmt = format.strip().lower()
    if fmt not in ("vcf", "plink", "all"):
        raise HTTPException(422, _detail("Format tidak dikenal.", ["Pilihan: vcf, plink, atau all"]))
    names = set()
    for key in (["VCF", "PLINK"] if fmt == "all" else [fmt.upper()]):
        names.update(BENCHMARK_FILES[key].values())
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for n in sorted(names):
            zf.write(CONTOH_DIR / n, arcname=n)
    return Response(buf.getvalue(), media_type="application/zip", headers={
        "Content-Disposition": f'attachment; filename="gwasena_benchmark_bawang_putih_{fmt}.zip"'})


# ------------------------------------------------------------------ 3. parameter
@router.put("/{analysis_id}/parameters", summary="3. Atur parameter QC dan model")
def set_parameters(data: ParameterIn, a: Analysis = Depends(owned_analysis),
                   db: Session = Depends(get_db)):
    if a.status in LOCKED:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            _detail("Analisis sedang berjalan; parameter dikunci sampai selesai."))
    if a.status == AnalysisStatus.DRAFT:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            _detail("Unggah dan validasi berkas terlebih dahulu.",
                                    [f"POST /api/analyses/{a.analysis_id}/upload"]))
    traits = ds.available_traits(db, a.analysis_id)
    if data.trait not in traits:
        raise HTTPException(422,
                            _detail(f"Sifat '{data.trait}' tidak ada di berkas fenotipe.",
                                    [f"Pilihan sifat: {', '.join(traits)}"]))
    terisi = db.scalar(select(func.count(Phenotype.phenotype_id)).where(
        Phenotype.analysis_id == a.analysis_id, Phenotype.trait_name == data.trait,
        Phenotype.phenotype_value.is_not(None)))
    if terisi is not None and terisi < MIN_SAMPLES:
        raise HTTPException(422, _detail(
            f"Sifat '{data.trait}' hanya terisi pada {terisi} sampel; minimal {MIN_SAMPLES} sampel.",
            ["Pilih sifat lain atau lengkapi nilai sifat pada CSV fenotipe lalu unggah ulang."]))
    model = db.scalar(select(AnalysisModel).where(AnalysisModel.model_name == data.model))
    a.model_id = model.model_id if model else None
    a.model_name = data.model
    a.trait_name = data.trait
    if data.organism and data.organism.strip():
        a.organism = data.organism.strip()

    config = data.model_dump()
    param = db.scalar(select(AnalysisParameter).where(AnalysisParameter.analysis_id == a.analysis_id))
    if param is None:
        param = AnalysisParameter(
            analysis_id=a.analysis_id,
            parameter_config=config,
            maf_threshold=data.maf,
            mind_threshold=data.mind,
            geno_threshold=data.geno,
            hwe_threshold=data.hwe,
            kinship_threshold=data.king_cutoff,
            alpha_threshold=data.alpha,
            pca_components=data.n_pc,
        )
        db.add(param)
    else:
        param.parameter_config = config
        param.maf_threshold = data.maf
        param.mind_threshold = data.mind
        param.geno_threshold = data.geno
        param.hwe_threshold = data.hwe
        param.kinship_threshold = data.king_cutoff
        param.alpha_threshold = data.alpha
        param.pca_components = data.n_pc

    if a.status in (AnalysisStatus.SELESAI, AnalysisStatus.GAGAL):
        a.status = AnalysisStatus.TERVALIDASI  # perlu dijalankan ulang dengan parameter baru
    db.commit()
    return {"pesan": "Parameter disimpan.", "analysis_id": a.analysis_id, "parameter": config,
            "langkah_berikutnya": f"POST /api/analyses/{a.analysis_id}/run"}


# ------------------------------------------------------------------ 4. jalankan
@router.post("/{analysis_id}/run", status_code=status.HTTP_202_ACCEPTED,
             summary="4. Jalankan pipeline (QC → PCA → GLM/MLM → koreksi)")
def run(background_tasks: BackgroundTasks, a: Analysis = Depends(owned_analysis),
        db: Session = Depends(get_db)):
    if a.status in LOCKED:
        raise HTTPException(status.HTTP_409_CONFLICT, _detail("Analisis ini sedang berjalan."))
    if a.status == AnalysisStatus.DRAFT:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            _detail("Berkas belum diunggah atau belum lolos validasi."))
    param = db.scalar(select(AnalysisParameter).where(AnalysisParameter.analysis_id == a.analysis_id))
    if param is None:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            _detail("Parameter analisis belum diatur.",
                                    [f"PUT /api/analyses/{a.analysis_id}/parameters"]))
    ds.clear_results(db, a.analysis_id)
    a.status = AnalysisStatus.ANTRE
    db.add(AnalysisLog(analysis_id=a.analysis_id, stage=None, status="antre",
                       message="Analisis masuk antrean"))
    db.commit()
    mode = dispatch(a.analysis_id, background_tasks)
    return {"pesan": "Analisis dimulai. Pantau kemajuannya melalui endpoint status.",
            "analysis_id": a.analysis_id, "status": AnalysisStatus.ANTRE, "mode_eksekusi": mode,
            "langkah_berikutnya": f"GET /api/analyses/{a.analysis_id}/status"}


# ------------------------------------------------------------------ 5. status
STATUS_TEXT = {
    AnalysisStatus.DRAFT: ("Berkas belum diunggah.", "POST /api/analyses/{id}/upload"),
    AnalysisStatus.TERVALIDASI: ("Berkas valid. Atur parameter lalu jalankan analisis.",
                                 "PUT /api/analyses/{id}/parameters"),
    AnalysisStatus.ANTRE: ("Analisis menunggu giliran dijalankan.", "GET /api/analyses/{id}/status"),
    AnalysisStatus.BERJALAN: ("Analisis sedang berjalan.", "GET /api/analyses/{id}/status"),
    AnalysisStatus.SELESAI: ("Analisis selesai.", "GET /api/analyses/{id}/results"),
    AnalysisStatus.GAGAL: ("Analisis gagal.", "PUT /api/analyses/{id}/parameters"),
}


@router.get("/{analysis_id}/status", summary="5. Pantau kemajuan analisis")
def get_status(a: Analysis = Depends(owned_analysis), db: Session = Depends(get_db)):
    logs = db.scalars(select(AnalysisLog).where(AnalysisLog.analysis_id == a.analysis_id)
                      .order_by(AnalysisLog.log_id)).all()
    latest = {}
    for log in logs:
        if log.stage:
            latest[log.stage] = log
    stages, current = [], None
    for code, name in STAGES:
        log = latest.get(code)
        st = log.status if log else "menunggu"
        if st == "berjalan":
            current = code
        stages.append({"kode": code, "nama": name, "status": st,
                       "pesan": (log.message.splitlines()[0] if log and log.message else None)})
    done = sum(1 for s in stages if s["status"] == "selesai")
    failed = next((log for log in reversed(logs) if log.status == "gagal"), None)
    galat = None
    if a.status == AnalysisStatus.GAGAL and failed and failed.message:
        lines = failed.message.splitlines()
        galat = {"tahap": failed.stage, "pesan": lines[0], "rincian": lines[1:]}

    # kalimat status yang siap ditampilkan antarmuka
    teks, langkah = STATUS_TEXT.get(a.status, ("", None))
    if a.status == AnalysisStatus.BERJALAN and current:
        urutan = [c for c, _ in STAGES].index(current) + 1
        teks = f"Sedang menjalankan tahap {urutan} dari {len(STAGES)}: {dict(STAGES)[current]}."
    elif a.status == AnalysisStatus.SELESAI:
        teks = (f"Analisis selesai: {a.significant_count or 0} SNP signifikan"
                + (f", λGC = {a.lambda_gc:.3f}." if a.lambda_gc is not None else "."))
    elif a.status == AnalysisStatus.GAGAL and galat:
        nama_tahap = dict(STAGES).get(galat["tahap"], galat["tahap"] or "persiapan")
        teks = f"Analisis gagal pada tahap {nama_tahap}: {galat['pesan']}"

    mulai = next((log.timestamp for log in logs if log.status == "berjalan"), None)
    akhir = logs[-1].timestamp if logs and a.status in (AnalysisStatus.SELESAI, AnalysisStatus.GAGAL) else None
    tip_pool = TIPS.get(current or "qc")
    resolved_trait = _resolve_session_trait(db, a)
    ringkasan_cache = _get_cache(db, a.analysis_id, "ringkasan") or {}
    qc_summary = dict(ringkasan_cache.get("qc") or {})
    if not qc_summary:
        geno_ds = db.scalar(select(Dataset).where(Dataset.analysis_id == a.analysis_id, Dataset.file_type.in_(ds.GENOTYPE_TYPES)))
        if geno_ds:
            qc_summary = {"sampel_awal": geno_ds.sample_count, "snp_awal": geno_ds.snp_count}
    if resolved_trait:
        qc_summary["trait_name"] = resolved_trait
    return {
        "analysis_id": a.analysis_id,
        "status": a.status,
        "trait": resolved_trait,
        "trait_name": resolved_trait,
        "ringkasan_qc": qc_summary or None,
        "pesan_status": teks,
        "terkunci": a.status in LOCKED,
        "tahap_sekarang": current,
        "progres_persen": round(100 * done / len(STAGES)),
        "tahap": stages,
        "galat": galat,
        "waktu_mulai": mulai,
        "waktu_selesai": akhir,
        "durasi_detik": round((akhir - mulai).total_seconds(), 1) if mulai and akhir else None,
        "tips_edukatif": tip_pool[int(time.time() // 10) % len(tip_pool)],
        "langkah_berikutnya": langkah.format(id=a.analysis_id) if langkah else None,
    }


# ------------------------------------------------------------------ 6. hasil
def _get_cache(db: Session, analysis_id: int, plot_type: str) -> dict | None:
    row = db.scalar(select(VisualizationResult).where(
        VisualizationResult.analysis_id == analysis_id, VisualizationResult.plot_type == plot_type))
    return row.plot_cache if row else None


def _require_done(a: Analysis) -> None:
    if a.status != AnalysisStatus.SELESAI:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            _detail(f"Hasil belum tersedia; status analisis: {a.status}.",
                                    [f"GET /api/analyses/{a.analysis_id}/status"]))


@router.get("/{analysis_id}/results", summary="6. Lihat hasil analisis")
def get_results(a: Analysis = Depends(owned_analysis), db: Session = Depends(get_db)):
    _require_done(a)
    ringkasan = _get_cache(db, a.analysis_id, "ringkasan") or {}
    param = db.scalar(select(AnalysisParameter).where(AnalysisParameter.analysis_id == a.analysis_id))
    base = f"/api/analyses/{a.analysis_id}"
    n_sig = len(ringkasan.get("snp_signifikan") or [])
    pesan = (f"Ditemukan {n_sig} SNP signifikan." if n_sig else
             "Tidak ada SNP yang signifikan setelah koreksi. Lihat snp_teratas untuk SNP dengan nilai p terkecil.")
    org_code, org_label = _resolve_session_organism(db, a)
    if "chromosome_count" not in ringkasan:
        chroms = db.scalars(select(SNP.chromosome).where(SNP.analysis_id == a.analysis_id).distinct()).all()
        if chroms:
            ringkasan = {**ringkasan, "chromosome_count": len(chroms)}
    return {
        "analysis_id": a.analysis_id,
        "analysis_name": a.analysis_name,
        "status": a.status,
        "organism": org_code,
        "organism_label": org_label,
        "trait": _resolve_session_trait(db, a) or ringkasan.get("trait"),
        "trait_name": _resolve_session_trait(db, a) or ringkasan.get("trait"),
        "pesan": pesan,
        "parameter": param.parameter_config if param else None,
        **ringkasan,
        "tautan": {
            "unduh_csv": f"{base}/results/csv",
            "unduh_csv_signifikan": f"{base}/results/csv?hanya_signifikan=true",
            "unduh_png_manhattan": f"{base}/plots/manhattan/png",
            "unduh_png_qq": f"{base}/plots/qq/png",
            "anotasi": f"{base}/annotation",
            "laporan_web": f"{base}/report",
            "data_manhattan": f"{base}/plots/manhattan",
            "data_qq": f"{base}/plots/qq",
            "data_pca": f"{base}/plots/pca",
        },
    }


@router.get("/{analysis_id}/plots/{jenis}", summary="Data titik untuk Manhattan, QQ, atau PCA plot")
def get_plot(
    jenis: str,
    maks_titik: int | None = Query(
        None, ge=0,
        description="Khusus Manhattan: batas jumlah titik (smart downsampling). Kosong = memakai "
                    "MANHATTAN_MAX_POINTS dari .env; 0 = kirim semua titik."),
    a: Analysis = Depends(owned_analysis),
    db: Session = Depends(get_db),
):
    if jenis not in ("manhattan", "qq", "pca"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, _detail("Jenis plot: manhattan, qq, atau pca."))
    _require_done(a)
    data = _get_cache(db, a.analysis_id, jenis) or {}
    if jenis == "manhattan" and data.get("titik"):
        batas = settings.MANHATTAN_MAX_POINTS if maks_titik is None else maks_titik
        ring = smart_downsample(data["titik"], batas)
        data = {**data, **ring}
    return data


@router.get("/{analysis_id}/plots/{jenis}/png", summary="Unduh Manhattan atau QQ plot (PNG)",
            response_class=Response,
            responses={200: {"content": {"image/png": {}}, "description": "Berkas gambar PNG"}})
def get_plot_png(jenis: str, a: Analysis = Depends(owned_analysis), db: Session = Depends(get_db)):
    if jenis not in plot_service.PNG_TYPES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _detail("Jenis plot PNG: manhattan atau qq."))
    _require_done(a)
    # PNG dibuat saat analisis selesai dan lokasinya dicatat di visualization_results.file_path
    # (AC-08.1). Bila belum ada (mis. matplotlib baru dipasang), dibuat sekarang.
    try:
        png = plot_service.render_png(db, a.analysis_id, jenis)
    except plot_service.PngUnavailable:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, _detail(
            "Ekspor PNG belum tersedia karena paket matplotlib belum terpasang.",
            ["Jalankan: pip install -r backend/requirements.txt"]))
    if png is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _detail("Data plot tidak ditemukan untuk analisis ini."))
    return Response(content=png, media_type="image/png", headers={
        "Content-Disposition": f'attachment; filename="gwasena_sesi{a.analysis_id}_{jenis}.png"'})


# ------------------------------------------------------------------ anotasi gen (FR-07)
@router.get("/{analysis_id}/annotation", summary="Anotasi gen kandidat untuk SNP signifikan")
def get_annotation(
    a: Analysis = Depends(owned_analysis),
    sertakan_teratas: bool = Query(
        False, description="Ikut menganotasi 10 SNP dengan nilai p terkecil, berguna bila tidak ada "
                           "SNP yang signifikan"),
    segarkan: bool = Query(False, description="true = abaikan cache dan minta ulang ke sumber anotasi"),
    db: Session = Depends(get_db),
):
    _require_done(a)
    org_code, _ = _resolve_session_organism(db, a)
    return annotation_service.annotate(db, a, org_code, sertakan_teratas, segarkan)


# ------------------------------------------------------------------ 7. unduh CSV
@router.get("/{analysis_id}/results/csv", summary="7. Unduh hasil asosiasi (CSV)")
def download_csv(
    hanya_signifikan: bool = Query(False, description="true = hanya SNP yang signifikan setelah koreksi"),
    a: Analysis = Depends(owned_analysis),
    db: Session = Depends(get_db),
):
    _require_done(a)
    stmt = (
        select(SNP.chromosome, SNP.position, SNP.variant_code, SNP.ref_allele, SNP.alt_allele,
               AssociationResult.effect_size, AssociationResult.std_error,
               AssociationResult.p_value, AssociationResult.q_value,
               AssociationResult.is_significant, AssociationResult.candidate_gene)
        .select_from(AssociationResult)
        .join(SNP, SNP.snp_id == AssociationResult.snp_id)
        .where(AssociationResult.analysis_id == a.analysis_id)
        .order_by(SNP.snp_id)
    )
    rows = db.execute(stmt).all()
    # Bonferroni dihitung dari SEMUA SNP yang diuji, walau yang diekspor hanya yang signifikan
    m = sum(1 for r in rows if r.p_value is not None)
    if hanya_signifikan:
        rows = [r for r in rows if r.is_significant]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Chr", "Pos", "SNP_ID", "Ref_Allele", "Alt_Allele", "Beta_OR", "SE",
                "P_Value", "P_Bonferroni", "Q_Value_FDR", "Signifikan", "Kandidat_Gen"])
    for r in rows:
        p_bonf = min(r.p_value * m, 1.0) if r.p_value is not None else None
        w.writerow([r.chromosome, r.position, r.variant_code, r.ref_allele, r.alt_allele,
                    r.effect_size, r.std_error, r.p_value, p_bonf, r.q_value,
                    "ya" if r.is_significant else "tidak", r.candidate_gene or ""])
    akhiran = "snp_signifikan" if hanya_signifikan else "hasil"
    filename = f"gwasena_analisis_{a.analysis_id}_{akhiran}.csv"
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ------------------------------------------------------------------ 8. laporan web
@router.get("/{analysis_id}/report", summary="8. Laporan hasil analisis (Web Report HTML)",
            response_class=HTMLResponse)
def web_report(
    unduh: bool = Query(False, description="true = diunduh sebagai berkas .html"),
    a: Analysis = Depends(owned_analysis),
    db: Session = Depends(get_db),
):
    _require_done(a)
    org_code, _ = _resolve_session_organism(db, a)
    html = report_service.build_report(db, a, organism_override=org_code)
    headers = {}
    if unduh:
        headers["Content-Disposition"] = f'attachment; filename="gwasena_analisis_{a.analysis_id}_laporan.html"'
    return HTMLResponse(content=html, headers=headers)
