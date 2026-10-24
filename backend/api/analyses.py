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
import io
import time

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user, owned_analysis
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
from backend.schemas import AnalysisCreate, ParameterIn
from backend.services import dataset_service as ds
from backend.services.analysis_runner import dispatch
from pipeline.errors import ValidationError
from pipeline.runner import STAGES
from pipeline.validation import match_sample_ids, read_phenotype_csv, read_vcf

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
@router.post("/{analysis_id}/upload", summary="2. Unggah VCF + CSV dan validasi")
def upload(
    a: Analysis = Depends(owned_analysis),
    genotipe: UploadFile = File(..., description="Berkas genotipe .vcf atau .vcf.gz"),
    fenotipe: UploadFile = File(..., description="Berkas fenotipe .csv (kolom sample_id + sifat)"),
    db: Session = Depends(get_db),
):
    if a.status in LOCKED:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            _detail("Analisis sedang berjalan; unggahan dikunci sampai selesai."))
    folder = ds.analysis_dir(a.analysis_id)
    try:
        ds.check_extensions(genotipe.filename, fenotipe.filename)
        ds.remove_dir(a.analysis_id)
        folder.mkdir(parents=True, exist_ok=True)
        g_path = folder / ("genotipe.vcf.gz" if genotipe.filename.lower().endswith(".gz") else "genotipe.vcf")
        p_path = folder / "fenotipe.csv"
        ds.save_upload(genotipe, g_path)
        ds.save_upload(fenotipe, p_path)
        geno = read_vcf(g_path)
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
                             fenotipe.filename, p_path, geno, pheno)
    a.status = AnalysisStatus.TERVALIDASI
    db.add(AnalysisLog(analysis_id=a.analysis_id, stage="validasi", status="selesai",
                       message=f"{geno.n_samples} sampel, {geno.n_snps} SNP; Sample ID cocok"))
    db.commit()
    return {
        "pesan": "Berkas valid. Lanjutkan ke pengaturan parameter.",
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
    tip_pool = TIPS.get(current or "qc")
    return {
        "analysis_id": a.analysis_id,
        "status": a.status,
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


# ------------------------------------------------------------------ 7. unduh CSV
@router.get("/{analysis_id}/results/csv", summary="7. Unduh hasil asosiasi (CSV)")
def download_csv(a: Analysis = Depends(owned_analysis), db: Session = Depends(get_db)):
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
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Chr", "Pos", "SNP_ID", "Ref_Allele", "Alt_Allele", "Beta_OR", "SE",
                "P_Value", "P_Bonferroni", "Q_Value_FDR"])
    for r in rows:
        p_bonf = min(r.p_value * m, 1.0) if r.p_value is not None else None
        w.writerow([r.chromosome, r.position, r.variant_code, r.ref_allele, r.alt_allele,
                    r.effect_size, r.std_error, r.p_value, p_bonf, r.q_value])
    filename = f"gwasena_analisis_{a.analysis_id}_hasil.csv"
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})
