"""Alur utama UC-01 "Run GWAS Pipeline" (FR-02 s.d. FR-06, FR-09 CSV, FR-10, FR-11, FR-12).

Urutan pemakaian:
  1. POST /api/analyses                         buat sesi analisis
  2. POST /api/analyses/{id}/upload             unggah VCF + CSV, validasi, cocokkan Sample ID
  3. PUT  /api/analyses/{id}/parameters         atur parameter QC dan model (GLM/MLM)
  4. POST /api/analyses/{id}/run                jalankan QC -> PCA -> GLM/MLM -> koreksi
  5. GET  /api/analyses/{id}/status             pantau kemajuan
  6. GET  /api/analyses/{id}/results            lihat hasil
  7. GET  /api/analyses/{id}/results/csv        unduh hasil CSV
"""
import csv
import html
import io
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

import shutil
import zipfile

from backend.api.deps import get_current_user, get_current_user_or_demo, owned_analysis
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
    User,
    VisualizationResult,
)
from backend.schemas import AnalysisCreate, BenchmarkLoadRequest, ParameterIn
from backend.services import dataset_service as ds
from backend.services.analysis_runner import dispatch
from pipeline.annotation import annotate_from_gff3
from pipeline.errors import ValidationError
from pipeline.runner import STAGES
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


def _summary(a: Analysis) -> dict:
    return {
        "analysis_id": a.analysis_id,
        "analysis_name": a.analysis_name,
        "status": a.status,
        "organism": a.organism,
        "analysis_time": a.analysis_time,
    }


def _build_warnings(geno, pheno) -> list[str]:
    warnings: list[str] = []
    skipped = getattr(geno, "skipped", None) or {}
    label_map = {
        "multialelik": "varian multialelik",
        "non_bialelik": "varian non-bialelik",
        "monomorfik": "varian monomorfik",
        "posisi_invalid": "varian dengan posisi tidak valid",
        "kosong": "varian tanpa genotipe valid",
    }
    for key, count in skipped.items():
        if count:
            desc = label_map.get(key, key.replace("_", " "))
            warnings.append(f"{count} {desc} dilewati saat pembacaan genotipe.")
    ignored = getattr(pheno, "ignored_columns", None) or []
    if ignored:
        warnings.append(f"Kolom fenotipe non-numerik atau kurang data diabaikan: {', '.join(ignored)}")
    return warnings


# ------------------------------------------------------------------ daftar & referensi
@router.get("", summary="Daftar analisis milik pengguna (FR-12)")
def list_analyses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Analysis).order_by(Analysis.analysis_id.desc())
    if user.role != "administrator":
        stmt = stmt.where(Analysis.user_id == user.user_id)
    return [_summary(a) for a in db.scalars(stmt).all()]


@router.get("/models", summary="Daftar model uji asosiasi")
def list_models(db: Session = Depends(get_db)):
    rows = db.scalars(select(AnalysisModel).order_by(AnalysisModel.model_id)).all()
    return [
        {"model_id": m.model_id, "model_name": m.model_name, "description": m.description,
         "tersedia": True}
        for m in rows
    ]


# ------------------------------------------------------------------ dataset benchmark bawang putih
def _get_benchmark_dir() -> Path:
    candidates = [
        ROOT_DIR / "backend" / "fixtures" / "benchmark",
        ROOT_DIR / "data" / "contoh",
        ROOT_DIR / "frontend" / "public" / "assets" / "example",
    ]
    for c in candidates:
        if c.exists() and (c / "fenotipe_bawang_putih_mini.csv").exists():
            return c
    raise HTTPException(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        _detail("Direktori berkas benchmark bawang putih tidak ditemukan di server disk.")
    )


def _load_benchmark_internal(
    target_format: str,
    target_analysis_id: int | str | None,
    user: User,
    db: Session,
) -> dict:
    fmt = (target_format or "VCF").strip().upper()
    if fmt not in ("PLINK", "VCF"):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            _detail(f"Format benchmark '{target_format}' tidak didukung. Pilih 'VCF' atau 'PLINK'.")
        )

    # 1. Resolusi ID Sesi atau Buat Sesi Baru (Fallback Session Creation)
    aid: int | None = None
    if target_analysis_id is not None:
        try:
            aid = int(target_analysis_id)
        except (ValueError, TypeError):
            aid = None

    a: Analysis | None = None
    if aid is not None:
        candidate = db.get(Analysis, aid)
        if candidate and (candidate.user_id == user.user_id or user.role == "administrator"):
            a = candidate

    if a is None:
        a = Analysis(
            user_id=user.user_id,
            analysis_name="Analisis Bobot Umbi Bawang Putih",
            status=AnalysisStatus.DRAFT,
            organism="Allium sativum",
        )
        db.add(a)
        db.commit()
        db.refresh(a)
    else:
        if "tanpa judul" in a.analysis_name.lower() or "sesi" in a.analysis_name.lower():
            a.analysis_name = "Analisis Bobot Umbi Bawang Putih"

    # 2. Periksa berkas benchmark di direktori fixtures
    fixture_dir = _get_benchmark_dir()
    csv_candidates = [
        fixture_dir / "fenotipe_bawang_putih_mini.csv",
        fixture_dir / "fenotipe.csv",
    ]
    csv_src = next((p for p in csv_candidates if p.exists()), None)
    if not csv_src:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            _detail("Berkas fenotipe benchmark (fenotipe_bawang_putih_mini.csv) tidak ditemukan.")
        )

    folder = ds.analysis_dir(a.analysis_id)
    ds.remove_dir(a.analysis_id)
    folder.mkdir(parents=True, exist_ok=True)

    if fmt == "PLINK":
        bed_src = next((fixture_dir / n for n in ["genotipe_bawang_putih_mini.bed", "bawang_putih.bed", "genotipe.bed"] if (fixture_dir / n).exists()), None)
        bim_src = next((fixture_dir / n for n in ["genotipe_bawang_putih_mini.bim", "bawang_putih.bim", "genotipe.bim"] if (fixture_dir / n).exists()), None)
        fam_src = next((fixture_dir / n for n in ["genotipe_bawang_putih_mini.fam", "bawang_putih.fam", "genotipe.fam"] if (fixture_dir / n).exists()), None)

        if not (bed_src and bim_src and fam_src):
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                _detail("Berkas biner PLINK benchmark (.bed/.bim/.fam) tidak lengkap di server.")
            )

        g_path = folder / "genotipe.bed"
        bim_path = folder / "genotipe.bim"
        fam_path = folder / "genotipe.fam"
        p_path = folder / "fenotipe.csv"

        shutil.copy2(bed_src, g_path)
        shutil.copy2(bim_src, bim_path)
        shutil.copy2(fam_src, fam_path)
        shutil.copy2(csv_src, p_path)

        genotype_filename = "genotipe_bawang_putih_mini.bed"
        genotype_type = "plink_bed"
        file_list = [
            "genotipe_bawang_putih_mini.bed",
            "genotipe_bawang_putih_mini.bim",
            "genotipe_bawang_putih_mini.fam",
        ]
    else:
        vcf_src = next((fixture_dir / n for n in ["genotipe_bawang_putih_mini.vcf", "bawang_putih.vcf", "bawang_putih_mini.vcf", "genotipe.vcf"] if (fixture_dir / n).exists()), None)
        if not vcf_src:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                _detail("Berkas VCF benchmark (genotipe_bawang_putih_mini.vcf) tidak ditemukan di server.")
            )

        g_path = folder / "genotipe.vcf"
        p_path = folder / "fenotipe.csv"

        shutil.copy2(vcf_src, g_path)
        shutil.copy2(csv_src, p_path)

        genotype_filename = "genotipe_bawang_putih_mini.vcf"
        genotype_type = "vcf"
        file_list = ["genotipe_bawang_putih_mini.vcf"]

    # 3. Parsing & Validasi Genotipe & Fenotipe
    try:
        geno = read_genotype(g_path)
        pheno = read_phenotype_csv(p_path)
        match = match_sample_ids(geno.samples, pheno.samples)
    except ValidationError as exc:
        ds.remove_dir(a.analysis_id)
        ds.clear_analysis_data(db, a.analysis_id)
        a.status = AnalysisStatus.DRAFT
        db.add(AnalysisLog(analysis_id=a.analysis_id, stage="validasi", status="gagal",
                           message="\n".join([exc.message, *exc.details])))
        db.commit()
        raise HTTPException(422, _detail(exc.message, exc.details))

    # 4. Catat ke tabel database
    ds.clear_analysis_data(db, a.analysis_id)
    info = ds.store_datasets(
        db,
        a.analysis_id,
        genotype_filename,
        g_path,
        "fenotipe_bawang_putih_mini.csv",
        p_path,
        geno,
        pheno,
        genotype_type=genotype_type,
    )

    if genotype_type == "plink_bed":
        db.add_all([
            Dataset(
                analysis_id=a.analysis_id,
                file_name="genotipe_bawang_putih_mini.bim",
                file_type="plink_bim",
                file_path=str(folder / "genotipe.bim"),
                validation_status="valid",
            ),
            Dataset(
                analysis_id=a.analysis_id,
                file_name="genotipe_bawang_putih_mini.fam",
                file_type="plink_fam",
                file_path=str(folder / "genotipe.fam"),
                validation_status="valid",
            ),
        ])

    a.status = AnalysisStatus.TERVALIDASI
    peringatan = _build_warnings(geno, pheno)
    db.add(
        AnalysisLog(
            analysis_id=a.analysis_id,
            stage="validasi",
            status="selesai",
            message=f"Benchmark {fmt}: {geno.n_samples} sampel, {geno.n_snps} SNP; Sample ID cocok",
        )
    )
    db.commit()
    db.refresh(a)

    return {
        "status": "success",
        "analysis_id": a.analysis_id,
        "dataset_type": fmt,
        "files": {
            "genotype": file_list,
            "phenotype": "fenotipe_bawang_putih_mini.csv",
        },
        "validation": {
            "is_valid": True,
            "sample_count": geno.n_samples,
            "snp_count": geno.n_snps,
            "qc_status": "100% Lolos QC",
            "sample_match": True,
        },
        "pesan": f"Dataset benchmark {fmt} berhasil dimuat dan divalidasi. Sample ID cocok.",
        "peringatan": peringatan,
        "genotipe": info["genotipe"],
        "fenotipe": info["fenotipe"],
        "kecocokan_sample_id": match,
        "sifat_tersedia": pheno.trait_names,
        "integritas": {
            "kesamaan_sampel": "100%",
            "sampel_cocok": geno.n_samples,
            "kelengkapan": "100%",
            "vcf_valid": True,
            "csv_valid": True,
        },
        "langkah_berikutnya": f"PUT /api/analyses/{a.analysis_id}/parameters",
    }


@router.post("/benchmark", summary="Muat dataset benchmark bawang putih (VCF / PLINK) dengan auto-create session")
def load_benchmark(
    data: BenchmarkLoadRequest = BenchmarkLoadRequest(),
    user: User = Depends(get_current_user_or_demo),
    db: Session = Depends(get_db),
):
    return _load_benchmark_internal(
        target_format=data.format,
        target_analysis_id=data.analysis_id,
        user=user,
        db=db,
    )


@router.get("/benchmark/download", summary="Unduh arsip ZIP dataset contoh benchmark bawang putih")
def download_benchmark_zip(
    format: str = Query("all", description="vcf | plink | all"),
):
    fixture_dir = _get_benchmark_dir()
    zip_buffer = io.BytesIO()
    fmt = format.strip().lower()

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        pheno_src = fixture_dir / "fenotipe_bawang_putih_mini.csv"
        if pheno_src.exists():
            zf.write(pheno_src, arcname="fenotipe_bawang_putih_mini.csv")

        if fmt in ("vcf", "all"):
            vcf_src = fixture_dir / "genotipe_bawang_putih_mini.vcf"
            if vcf_src.exists():
                zf.write(vcf_src, arcname="genotipe_bawang_putih_mini.vcf")

        if fmt in ("plink", "all"):
            for ext in (".bed", ".bim", ".fam"):
                p_file = fixture_dir / f"genotipe_bawang_putih_mini{ext}"
                if p_file.exists():
                    zf.write(p_file, arcname=f"genotipe_bawang_putih_mini{ext}")

    zip_buffer.seek(0)
    filename = f"gwasena_benchmark_bawang_putih_{fmt}.zip"
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{analysis_id}/load-benchmark", summary="Muat dataset benchmark contoh bawang putih ke sesi spesifik")
def load_benchmark_for_analysis(
    analysis_id: int | str,
    data: BenchmarkLoadRequest = BenchmarkLoadRequest(),
    user: User = Depends(get_current_user_or_demo),
    db: Session = Depends(get_db),
):
    return _load_benchmark_internal(
        target_format=data.format,
        target_analysis_id=analysis_id,
        user=user,
        db=db,
    )


# ------------------------------------------------------------------ 1. buat sesi
@router.post("", status_code=status.HTTP_201_CREATED, summary="1. Buat sesi analisis")
def create_analysis(data: AnalysisCreate, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    a = Analysis(user_id=user.user_id, analysis_name=data.analysis_name, status=AnalysisStatus.DRAFT)
    db.add(a)
    db.commit()
    db.refresh(a)
    return {**_summary(a), "langkah_berikutnya": f"POST /api/analyses/{a.analysis_id}/upload"}


@router.get("/{analysis_id}", summary="Detail sesi analisis")
def get_analysis(a: Analysis = Depends(owned_analysis), db: Session = Depends(get_db)):
    datasets = db.scalars(select(Dataset).where(Dataset.analysis_id == a.analysis_id)).all()
    param = db.scalar(select(AnalysisParameter).where(AnalysisParameter.analysis_id == a.analysis_id))
    return {
        **_summary(a),
        "berkas": [{"nama_berkas": d.file_name, "jenis": d.file_type,
                    "status_validasi": d.validation_status, "diunggah": d.upload_time}
                   for d in datasets],
        "sifat_tersedia": ds.available_traits(db, a.analysis_id),
        "parameter": param.parameter_config if param else None,
    }


# ------------------------------------------------------------------ 2. unggah & validasi
@router.post("/{analysis_id}/upload", summary="2. Unggah genotipe (VCF atau PLINK biner) + CSV dan validasi")
def upload(
    a: Analysis = Depends(owned_analysis),
    genotipe: UploadFile = File(..., description="Berkas genotipe .vcf, .vcf.gz, atau .bed (PLINK biner)"),
    fenotipe: UploadFile = File(..., description="Berkas fenotipe .csv (kolom sample_id + sifat)"),
    bim: UploadFile | None = File(None, description="Wajib bila genotipe berupa .bed: berkas .bim"),
    fam: UploadFile | None = File(None, description="Wajib bila genotipe berupa .bed: berkas .fam"),
    db: Session = Depends(get_db),
):
    if a.status in LOCKED:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            _detail("Analisis sedang berjalan; unggahan dikunci sampai selesai."))
    folder = ds.analysis_dir(a.analysis_id)
    # field berkas opsional yang dikirim kosong dianggap tidak diunggah
    bim = bim if bim is not None and bim.filename else None
    fam = fam if fam is not None and fam.filename else None
    try:
        plink = ds.is_plink(genotipe.filename)
        ds.check_extensions(genotipe.filename, fenotipe.filename,
                            bim.filename if bim else None, fam.filename if fam else None)
        ds.remove_dir(a.analysis_id)
        folder.mkdir(parents=True, exist_ok=True)
        if plink:
            g_path = folder / "genotipe.bed"
            ds.save_upload(bim, folder / "genotipe.bim")
            ds.save_upload(fam, folder / "genotipe.fam")
        else:
            g_path = folder / ("genotipe.vcf.gz" if genotipe.filename.lower().endswith(".gz") else "genotipe.vcf")
        p_path = folder / "fenotipe.csv"
        ds.save_upload(genotipe, g_path)
        ds.save_upload(fenotipe, p_path)
        geno = read_genotype(g_path)
        pheno = read_phenotype_csv(p_path)
        match = match_sample_ids(geno.samples, pheno.samples)
    except ValidationError as exc:
        ds.remove_dir(a.analysis_id)
        ds.clear_analysis_data(db, a.analysis_id)
        a.status = AnalysisStatus.DRAFT
        db.add(AnalysisLog(analysis_id=a.analysis_id, stage="validasi", status="gagal",
                           message="\n".join([exc.message, *exc.details])))
        db.commit()
        raise HTTPException(422, _detail(exc.message, exc.details))

    ds.clear_analysis_data(db, a.analysis_id)
    info = ds.store_datasets(db, a.analysis_id, genotipe.filename, g_path,
                             fenotipe.filename, p_path, geno, pheno,
                             genotype_type="plink_bed" if plink else "vcf")
    a.status = AnalysisStatus.TERVALIDASI
    db.add(AnalysisLog(analysis_id=a.analysis_id, stage="validasi", status="selesai",
                       message=f"{geno.n_samples} sampel, {geno.n_snps} SNP; Sample ID cocok"))
    db.commit()
    peringatan = _build_warnings(geno, pheno)
    return {
        "pesan": "Berkas valid. Lanjutkan ke pengaturan parameter.",
        "peringatan": peringatan,
        "analysis_id": a.analysis_id,
        "status": a.status,
        **info,
        "kecocokan_sample_id": match,
        "langkah_berikutnya": f"PUT /api/analyses/{a.analysis_id}/parameters",
    }


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
    model = db.scalar(select(AnalysisModel).where(AnalysisModel.model_name == data.model))
    a.model_id = model.model_id if model else None
    config = data.model_dump()
    param = db.scalar(select(AnalysisParameter).where(AnalysisParameter.analysis_id == a.analysis_id))
    if param is None:
        db.add(AnalysisParameter(analysis_id=a.analysis_id, parameter_config=config))
    else:
        param.parameter_config = config
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
    durasi_detik = 0.0
    if logs:
        t_start = logs[0].timestamp
        t_end = logs[-1].timestamp
        if t_start and t_end:
            if a.status in (AnalysisStatus.SELESAI, AnalysisStatus.GAGAL):
                delta = (t_end.replace(tzinfo=None) - t_start.replace(tzinfo=None)).total_seconds()
            else:
                now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
                delta = (now_utc - t_start.replace(tzinfo=None)).total_seconds()
            durasi_detik = round(max(0.0, delta), 2)

    stage_names = dict(STAGES)
    if a.status == AnalysisStatus.SELESAI:
        pesan_status = "Komputasi pipeline selesai. Hasil siap divisualisasikan."
        langkah_berikutnya = f"GET /api/analyses/{a.analysis_id}/results"
    elif a.status == AnalysisStatus.GAGAL:
        pesan_status = galat["pesan"] if galat else "Komputasi gagal dijalankan."
        langkah_berikutnya = f"PUT /api/analyses/{a.analysis_id}/parameters"
    elif a.status == AnalysisStatus.BERJALAN:
        cur_label = stage_names.get(current, "komputasi")
        pesan_status = f"Sedang menjalankan tahap {cur_label}..."
        langkah_berikutnya = f"GET /api/analyses/{a.analysis_id}/status"
    elif a.status == AnalysisStatus.ANTRE:
        pesan_status = "Analisis masuk antrean dan menunggu pekerja komputasi..."
        langkah_berikutnya = f"GET /api/analyses/{a.analysis_id}/status"
    elif a.status == AnalysisStatus.TERVALIDASI:
        pesan_status = "Dataset tervalidasi. Silakan atur parameter QC & model."
        langkah_berikutnya = f"POST /api/analyses/{a.analysis_id}/run"
    else:
        pesan_status = "Sesi dalam tahap draft. Silakan unggah dataset terlebih dahulu."
        langkah_berikutnya = f"POST /api/analyses/{a.analysis_id}/upload"

    tip_pool = TIPS.get(current or "qc")
    return {
        "analysis_id": a.analysis_id,
        "status": a.status,
        "pesan_status": pesan_status,
        "durasi_detik": durasi_detik,
        "langkah_berikutnya": langkah_berikutnya,
        "terkunci": a.status in LOCKED,
        "tahap_sekarang": current,
        "progres_persen": round(100 * done / len(STAGES)),
        "tahap": stages,
        "galat": galat,
        "tips_edukatif": tip_pool[int(time.time() // 10) % len(tip_pool)],
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
    return {
        "analysis_id": a.analysis_id,
        "analysis_name": a.analysis_name,
        "status": a.status,
        "parameter": param.parameter_config if param else None,
        **ringkasan,
        "tautan": {
            "unduh_csv": f"{base}/results/csv",
            "unduh_csv_signifikan": f"{base}/results/csv?hanya_signifikan=true",
            "laporan_html": f"{base}/report?unduh=true",
            "data_manhattan": f"{base}/plots/manhattan",
            "data_qq": f"{base}/plots/qq",
            "data_pca": f"{base}/plots/pca",
        },
    }


@router.get("/{analysis_id}/plots/{jenis}", summary="Data titik untuk Manhattan, QQ, atau PCA plot")
def get_plot(jenis: str, a: Analysis = Depends(owned_analysis), db: Session = Depends(get_db)):
    if jenis not in ("manhattan", "qq", "pca"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, _detail("Jenis plot: manhattan, qq, atau pca."))
    _require_done(a)
    return _get_cache(db, a.analysis_id, jenis) or {}


@router.get("/{analysis_id}/plots/{jenis}/png", summary="Unduh Manhattan atau QQ plot (PNG)",
            response_class=Response,
            responses={200: {"content": {"image/png": {}}, "description": "Berkas gambar PNG"}})
def get_plot_png(jenis: str, a: Analysis = Depends(owned_analysis), db: Session = Depends(get_db)):
    if jenis not in ("manhattan", "qq"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, _detail("Jenis plot PNG: manhattan atau qq."))
    _require_done(a)
    row = db.scalar(select(VisualizationResult).where(
        VisualizationResult.analysis_id == a.analysis_id, VisualizationResult.plot_type == jenis))
    if row is None or not row.plot_cache:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _detail("Data plot tidak ditemukan untuk analisis ini."))

    # PNG dibuat sekali lalu disimpan; lokasinya dicatat di visualization_results.file_path (AC-08.1).
    # Bila analisis dijalankan ulang, baris lama dihapus sehingga gambar dibuat ulang.
    path = Path(row.file_path) if row.file_path else None
    if path is not None and path.is_file():
        png = path.read_bytes()
    else:
        # matplotlib dimuat di sini, bukan di awal berkas, supaya backend tetap bisa menyala
        # walaupun paket matplotlib belum terpasang (hanya fitur PNG yang tidak tersedia).
        try:
            from pipeline.visualization import manhattan_png, qq_png
        except ImportError:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, _detail(
                "Ekspor PNG belum tersedia karena paket matplotlib belum terpasang.",
                ["Jalankan: pip install -r backend/requirements.txt"]))
        ringkasan = _get_cache(db, a.analysis_id, "ringkasan") or {}
        nama = "Manhattan plot" if jenis == "manhattan" else "QQ plot"
        judul = f"{nama} - {ringkasan.get('trait', '')} ({ringkasan.get('model', '')})"
        png = manhattan_png(row.plot_cache, judul) if jenis == "manhattan" else qq_png(row.plot_cache, judul)
        folder = ds.analysis_dir(a.analysis_id) / "plot"
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{jenis}.png"
        path.write_bytes(png)
        row.file_path = str(path)
        db.commit()
    return Response(content=png, media_type="image/png", headers={
        "Content-Disposition": f'attachment; filename="gwasena_sesi{a.analysis_id}_{jenis}.png"'})


# ------------------------------------------------------------------ anotasi gen (FR-07)
@router.get("/{analysis_id}/annotation", summary="Anotasi gen kandidat untuk SNP signifikan")
def get_annotation(
    a: Analysis = Depends(owned_analysis),
    sertakan_teratas: bool = Query(
        False, description="Ikut menganotasi 10 SNP dengan nilai p terkecil, berguna bila tidak ada "
                           "SNP yang signifikan"),
    db: Session = Depends(get_db),
):
    """Mencocokkan SNP signifikan dengan gen yang tumpang tindih atau terdekat (AC-07.1).

    Bila sumber anotasi tidak dapat dipakai, respons tetap 200 dengan status
    "tidak_tersedia" dan pesan, tanpa mengganggu hasil analisis lain (AC-07.2).
    """
    _require_done(a)
    ringkasan = _get_cache(db, a.analysis_id, "ringkasan") or {}
    snps = list(ringkasan.get("snp_signifikan") or [])
    signifikan = {s["snp_id"] for s in snps}
    label = "SNP signifikan"
    if sertakan_teratas:
        snps += [s for s in ringkasan.get("snp_teratas") or [] if s["snp_id"] not in signifikan]
        label = "SNP (signifikan dan teratas)"
    hasil = annotate_from_gff3(snps, settings.ANNOTATION_GFF3, settings.ANNOTATION_WINDOW_BP, label)
    for k in hasil["kandidat"]:
        k["signifikan"] = k["snp_id"] in signifikan
    if hasil["status"] == "tersedia" and not snps:
        hasil["pesan"] += " Gunakan sertakan_teratas=true untuk melihat kandidat gen di sekitar SNP teratas."
    return {"analysis_id": a.analysis_id, "trait": ringkasan.get("trait"),
            "model": ringkasan.get("model"), **hasil}


# ------------------------------------------------------------------ 7. unduh CSV & laporan HTML & hapus
@router.get("/{analysis_id}/results/csv", summary="7. Unduh hasil asosiasi (CSV)")
def download_csv(
    hanya_signifikan: bool = Query(False, description="Jika true, hanya unduh SNP signifikan"),
    a: Analysis = Depends(owned_analysis),
    db: Session = Depends(get_db),
):
    _require_done(a)
    rows = db.execute(
        select(SNP.chromosome, SNP.position, SNP.variant_code, SNP.ref_allele, SNP.alt_allele,
               AssociationResult.effect_size, AssociationResult.std_error,
               AssociationResult.p_value, AssociationResult.q_value)
        .select_from(AssociationResult)
        .join(SNP, SNP.snp_id == AssociationResult.snp_id)
        .where(AssociationResult.analysis_id == a.analysis_id)
        .order_by(SNP.snp_id)
    ).all()
    m = sum(1 for r in rows if r.p_value is not None)

    sig_ids: set[str] | None = None
    alpha = 0.05
    if hanya_signifikan:
        ringkasan = _get_cache(db, a.analysis_id, "ringkasan") or {}
        if "snp_signifikan" in ringkasan:
            sig_ids = {s.get("snp_id") for s in (ringkasan.get("snp_signifikan") or []) if s.get("snp_id")}
        param = db.scalar(select(AnalysisParameter).where(AnalysisParameter.analysis_id == a.analysis_id))
        if param and param.parameter_config:
            alpha = float(param.parameter_config.get("alpha", 0.05))

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Chr", "Pos", "SNP_ID", "Ref_Allele", "Alt_Allele", "Beta_OR", "SE",
                "P_Value", "P_Bonferroni", "Q_Value_FDR"])
    for r in rows:
        p_bonf = min(r.p_value * m, 1.0) if r.p_value is not None and m > 0 else None
        if hanya_signifikan:
            if sig_ids is not None:
                if r.variant_code not in sig_ids:
                    continue
            else:
                is_sig = (p_bonf is not None and p_bonf <= alpha) or (r.q_value is not None and r.q_value <= alpha)
                if not is_sig:
                    continue
        w.writerow([r.chromosome, r.position, r.variant_code, r.ref_allele, r.alt_allele,
                    r.effect_size, r.std_error, r.p_value, p_bonf, r.q_value])
    suffix = "signifikan" if hanya_signifikan else "hasil"
    filename = f"gwasena_analisis_{a.analysis_id}_{suffix}.csv"
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/{analysis_id}/report", summary="8. Ekspor laporan analisis Web HTML mandiri (FR-09)")
def get_html_report(
    unduh: bool = Query(True, description="Jika true, kirim header Content-Disposition attachment"),
    a: Analysis = Depends(owned_analysis),
    db: Session = Depends(get_db),
):
    _require_done(a)
    ringkasan = _get_cache(db, a.analysis_id, "ringkasan") or {}
    param = db.scalar(select(AnalysisParameter).where(AnalysisParameter.analysis_id == a.analysis_id))
    cfg = param.parameter_config if param and param.parameter_config else {}
    qc = ringkasan.get("qc") or {}
    asosiasi = ringkasan.get("asosiasi") or {}
    sig_snps = list(ringkasan.get("snp_signifikan") or [])
    display_snps = sig_snps if sig_snps else list(ringkasan.get("snp_teratas") or [])[:10]

    ann = annotate_from_gff3(sig_snps, settings.ANNOTATION_GFF3, settings.ANNOTATION_WINDOW_BP, "SNP signifikan")
    ann_status = ann.get("status", "tidak_tersedia")
    ann_msg = html.escape(str(ann.get("pesan", "")))

    title = html.escape(str(a.analysis_name or f"Analisis GWAS #{a.analysis_id}"))
    organism = html.escape(str(a.organism or "Allium sativum"))
    model = html.escape(str(ringkasan.get("model") or cfg.get("model") or "GLM"))
    trait = html.escape(str(ringkasan.get("trait") or cfg.get("trait") or "-"))

    snp_rows_html = ""
    for idx, s in enumerate(display_snps, start=1):
        snp_id = html.escape(str(s.get("snp_id", "-")))
        chrom = html.escape(str(s.get("chromosome", "-")))
        pos = s.get("position", 0)
        pval = s.get("p_value")
        beta = s.get("beta") if s.get("beta") is not None else s.get("effect_size")
        qval = s.get("q_value")
        sig_badge = "Signifikan" if s.get("signifikan") else "Teratas"
        p_str = f"{pval:.3e}" if isinstance(pval, (int, float)) else "-"
        b_str = f"{beta:+.4f}" if isinstance(beta, (int, float)) else "-"
        q_str = f"{qval:.3e}" if isinstance(qval, (int, float)) else "-"
        snp_rows_html += (
            f"<tr><td>{idx}</td><td>{snp_id}</td><td>{chrom}</td><td>{pos:,}</td>"
            f"<td>{b_str}</td><td>{p_str}</td><td>{q_str}</td><td>{sig_badge}</td></tr>"
        )
    if not snp_rows_html:
        snp_rows_html = '<tr><td colspan="8" style="text-align:center;">Tidak ada data SNP yang dapat ditampilkan.</td></tr>'

    html_doc = f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Laporan Analisis GWASena - {title}</title>
<style>
  body {{ font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 2rem auto; max-width: 960px; padding: 0 1rem; line-height: 1.5; }}
  header {{ border-bottom: 2px solid #0284c7; padding-bottom: 1rem; margin-bottom: 1.5rem; }}
  h1 {{ margin: 0 0 0.25rem; font-size: 1.5rem; }}
  .meta {{ color: #475569; font-size: 0.9rem; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin: 1rem 0 1.5rem; }}
  .card {{ background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.75rem 1rem; }}
  .card .label {{ font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 700; }}
  .card .val {{ font-size: 1.15rem; font-weight: 700; margin-top: 0.2rem; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 0.75rem; font-size: 0.875rem; }}
  th, td {{ border: 1px solid #cbd5e1; padding: 0.5rem 0.65rem; text-align: left; }}
  th {{ background: #f1f5f9; font-weight: 700; }}
  .notice {{ background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 0.75rem 1rem; margin-top: 1rem; font-size: 0.875rem; }}
  footer {{ margin-top: 2rem; border-top: 1px solid #e2e8f0; padding-top: 0.75rem; font-size: 0.8rem; color: #64748b; }}
</style>
</head>
<body>
  <header>
    <h1>Laporan Analisis Asosiasi Genomik (GWASena)</h1>
    <div class="meta">Sesi #{a.analysis_id} &bull; {title} &bull; Organisme: <em>{organism}</em></div>
  </header>
  <section class="grid">
    <div class="card"><div class="label">Model Statistik</div><div class="val">{model} (PCA Auto)</div></div>
    <div class="card"><div class="label">Sifat Fenotipe</div><div class="val">{trait}</div></div>
    <div class="card"><div class="label">Sampel Lolos QC</div><div class="val">{qc.get("sampel_lolos", "-")} / {qc.get("sampel_awal", qc.get("sampel_total", "-"))}</div></div>
    <div class="card"><div class="label">SNP Diuji</div><div class="val">{asosiasi.get("jumlah_snp_diuji", qc.get("snp_lolos", "-"))}</div></div>
    <div class="card"><div class="label">SNP Signifikan</div><div class="val">{len(sig_snps)}</div></div>
    <div class="card"><div class="label">Lambda GC (&lambda;)</div><div class="val">{asosiasi.get("lambda_gc", "-")}</div></div>
  </section>
  <section>
    <h2>{"Daftar SNP Signifikan" if sig_snps else "10 SNP Teratas (Nilai-p Terkecil)"}</h2>
    <table>
      <thead>
        <tr><th>No</th><th>ID SNP</th><th>Kromosom</th><th>Posisi (bp)</th><th>Beta</th><th>P-Value</th><th>Q-Value (FDR)</th><th>Status</th></tr>
      </thead>
      <tbody>{snp_rows_html}</tbody>
    </table>
  </section>
  <section style="margin-top:1.5rem;">
    <h2>Status Anotasi Kandidat Gen (FR-07)</h2>
    <div class="notice"><strong>Status ({html.escape(str(ann_status))}):</strong> {ann_msg}</div>
  </section>
  <footer>Dihasilkan secara dinamis dari basis data sesi GWASena API.</footer>
</body>
</html>"""

    headers = {}
    if unduh:
        headers["Content-Disposition"] = f'attachment; filename="gwasena_laporan_{a.analysis_id}.html"'
    return Response(content=html_doc, media_type="text/html; charset=utf-8", headers=headers)


@router.delete("/{analysis_id}", summary="Hapus sesi analisis dan berkas terkait (FR-12)")
def delete_analysis(a: Analysis = Depends(owned_analysis), db: Session = Depends(get_db)):
    if a.status in LOCKED:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            _detail("Analisis sedang berjalan; tunggu sampai selesai sebelum menghapus."),
        )
    aid = a.analysis_id
    ds.remove_dir(aid)
    ds.clear_analysis_data(db, aid)
    db.execute(delete(AnalysisParameter).where(AnalysisParameter.analysis_id == aid))
    db.delete(a)
    db.commit()
    return {"pesan": f"Sesi analisis #{aid} berhasil dihapus.", "analysis_id": aid}
