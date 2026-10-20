"""Fitur awal analisis (FR-02, FR-11, FR-12).

Sudah berfungsi:
  GET  /api/analyses                    daftar analisis milik pengguna
  POST /api/analyses                    buat sesi analisis
  GET  /api/analyses/{id}               detail sesi (berkas, sifat tersedia)
  POST /api/analyses/{id}/upload        unggah VCF + CSV, validasi, cocokkan Sample ID

Menyusul minggu 8 (sudah terdaftar, membalas 501):
  PUT /parameters, POST /run, GET /status, GET /results
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user, owned_analysis
from backend.core.database import get_db
from backend.models import (
    Analysis,
    AnalysisLog,
    AnalysisModel,
    AnalysisParameter,
    AnalysisStatus,
    Dataset,
    User,
)
from backend.schemas import AnalysisCreate
from backend.services import dataset_service as ds
from pipeline.errors import ValidationError
from pipeline.validation import match_sample_ids, read_phenotype_csv, read_vcf

router = APIRouter(prefix="/api/analyses", tags=["2. analisis"])

LOCKED = (AnalysisStatus.ANTRE, AnalysisStatus.BERJALAN)


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
         "tersedia": False}
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
        "pesan": "Berkas valid dan sudah disimpan.",
        "analysis_id": a.analysis_id,
        "status": a.status,
        **info,
        "kecocokan_sample_id": match,
        "langkah_berikutnya": "Pengaturan parameter dan analisis tersedia pada minggu 8.",
    }


# ------------------------------------------------------------------ menyusul minggu 8
_BELUM = _detail("Fitur ini diimplementasikan pada minggu 8 (alur utama analisis).")


@router.put("/{analysis_id}/parameters", status_code=501, summary="(Minggu 8) Atur parameter")
def set_parameters(a: Analysis = Depends(owned_analysis)):
    raise HTTPException(501, _BELUM)


@router.post("/{analysis_id}/run", status_code=501, summary="(Minggu 8) Jalankan analisis")
def run(a: Analysis = Depends(owned_analysis)):
    raise HTTPException(501, _BELUM)


@router.get("/{analysis_id}/status", status_code=501, summary="(Minggu 8) Status analisis")
def get_status(a: Analysis = Depends(owned_analysis)):
    raise HTTPException(501, _BELUM)


@router.get("/{analysis_id}/results", status_code=501, summary="(Minggu 8) Hasil analisis")
def get_results(a: Analysis = Depends(owned_analysis)):
    raise HTTPException(501, _BELUM)
