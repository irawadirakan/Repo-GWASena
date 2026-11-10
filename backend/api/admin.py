"""Panel administrator (FR-13, AC-13.1): daftar akun pengguna dan status job analisis.

Semua endpoint hanya untuk akun dengan role "administrator"; pengguna biasa mendapat 403.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user
from backend.core.database import get_db
from backend.models import Analysis, AnalysisStatus, User

router = APIRouter(prefix="/api/admin", tags=["3. administrator"])

STATUS_SEMUA = [AnalysisStatus.DRAFT, AnalysisStatus.TERVALIDASI, AnalysisStatus.ANTRE,
                AnalysisStatus.BERJALAN, AnalysisStatus.SELESAI, AnalysisStatus.GAGAL]


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "administrator":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Halaman ini hanya untuk administrator.")
    return user


@router.get("/ringkasan", summary="Ringkasan jumlah pengguna dan analisis per status")
def ringkasan(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    per_status = dict(db.execute(select(Analysis.status, func.count()).group_by(Analysis.status)).all())
    return {
        "jumlah_pengguna": db.scalar(select(func.count()).select_from(User)),
        "jumlah_analisis": sum(per_status.values()),
        "analisis_per_status": {s: per_status.get(s, 0) for s in STATUS_SEMUA},
        "job_aktif": per_status.get(AnalysisStatus.ANTRE, 0) + per_status.get(AnalysisStatus.BERJALAN, 0),
    }


@router.get("/users", summary="Daftar akun pengguna")
def daftar_pengguna(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    jumlah = dict(db.execute(select(Analysis.user_id, func.count()).group_by(Analysis.user_id)).all())
    terakhir = dict(db.execute(select(Analysis.user_id, func.max(Analysis.created_at))
                               .group_by(Analysis.user_id)).all())
    users = db.scalars(select(User).order_by(User.user_id)).all()
    return [{"user_id": u.user_id, "username": u.username, "email": u.email, "role": u.role,
             "terdaftar": u.created_at, "jumlah_analisis": jumlah.get(u.user_id, 0),
             "analisis_terakhir": terakhir.get(u.user_id)} for u in users]


@router.get("/analyses", summary="Daftar job analisis semua pengguna")
def daftar_job(
    status_job: str | None = Query(None, alias="status",
                                   description="Saring status: draft, tervalidasi, antre, berjalan, selesai, gagal, "
                                               "atau aktif (antre + berjalan)"),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = (select(Analysis, User.username).join(User, User.user_id == Analysis.user_id)
            .order_by(Analysis.analysis_id.desc()))
    if status_job == "aktif":
        stmt = stmt.where(Analysis.status.in_([AnalysisStatus.ANTRE, AnalysisStatus.BERJALAN]))
    elif status_job:
        if status_job not in STATUS_SEMUA:
            raise HTTPException(422, {"pesan": f"Status '{status_job}' tidak dikenal.",
                                      "rincian": [f"Pilihan: {', '.join(STATUS_SEMUA)}, aktif"]})
        stmt = stmt.where(Analysis.status == status_job)
    return [{"analysis_id": a.analysis_id, "analysis_name": a.analysis_name, "pemilik": username,
             "status": a.status, "trait_name": a.trait_name, "model_name": a.model_name,
             "significant_count": a.significant_count, "dibuat": a.created_at, "diperbarui": a.updated_at}
            for a, username in db.execute(stmt).all()]
