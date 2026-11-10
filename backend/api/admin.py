"""Panel Admin & Pemantauan Sistem (FR-13): ringkasan, daftar pengguna, daftar analisis."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.api.deps import require_admin
from backend.core.database import get_db
from backend.models import Analysis, AnalysisStatus, User

router = APIRouter(prefix="/api/admin", tags=["3. administrator (FR-13)"])


@router.get("/ringkasan", summary="Ringkasan statistik platform untuk administrator (FR-13)")
def admin_summary(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    total_users = db.scalar(select(func.count(User.user_id))) or 0
    total_analyses = db.scalar(select(func.count(Analysis.analysis_id))) or 0
    active_analyses = (
        db.scalar(
            select(func.count(Analysis.analysis_id)).where(
                Analysis.status.in_([AnalysisStatus.ANTRE, AnalysisStatus.BERJALAN])
            )
        )
        or 0
    )
    completed_analyses = (
        db.scalar(
            select(func.count(Analysis.analysis_id)).where(
                Analysis.status == AnalysisStatus.SELESAI
            )
        )
        or 0
    )
    failed_analyses = (
        db.scalar(
            select(func.count(Analysis.analysis_id)).where(
                Analysis.status == AnalysisStatus.GAGAL
            )
        )
        or 0
    )

    recent_rows = db.execute(
        select(Analysis, User.username)
        .join(User, User.user_id == Analysis.user_id)
        .order_by(Analysis.analysis_id.desc())
        .limit(5)
    ).all()

    return {
        "total_pengguna": total_users,
        "total_analisis": total_analyses,
        "analisis_aktif": active_analyses,
        "analisis_selesai": completed_analyses,
        "analisis_gagal": failed_analyses,
        "aktivitas_terbaru": [
            {
                "analysis_id": a.analysis_id,
                "analysis_name": a.analysis_name,
                "username": uname,
                "status": a.status,
                "analysis_time": a.analysis_time,
            }
            for a, uname in recent_rows
        ],
    }


@router.get("/users", summary="Daftar seluruh pengguna terdaftar (FR-13)")
def admin_users(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.scalars(select(User).order_by(User.user_id.asc())).all()
    counts = dict(
        db.execute(
            select(Analysis.user_id, func.count(Analysis.analysis_id)).group_by(Analysis.user_id)
        ).all()
    )
    return [
        {
            "user_id": u.user_id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "created_at": u.created_at,
            "jumlah_analisis": counts.get(u.user_id, 0),
        }
        for u in users
    ]


@router.get("/analyses", summary="Daftar analisis seluruh pengguna dengan filter status (FR-13)")
def admin_analyses(
    status: str | None = Query(None, description="Filter: aktif | draft | tervalidasi | antre | berjalan | selesai | gagal"),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Analysis, User.username)
        .join(User, User.user_id == Analysis.user_id)
        .order_by(Analysis.analysis_id.desc())
    )
    if status:
        s_lower = status.strip().lower()
        if s_lower == "aktif":
            stmt = stmt.where(Analysis.status.in_([AnalysisStatus.ANTRE, AnalysisStatus.BERJALAN]))
        else:
            stmt = stmt.where(Analysis.status == s_lower)

    rows = db.execute(stmt).all()
    return [
        {
            "analysis_id": a.analysis_id,
            "analysis_name": a.analysis_name,
            "user_id": a.user_id,
            "username": uname,
            "status": a.status,
            "organism": a.organism,
            "analysis_time": a.analysis_time,
        }
        for a, uname in rows
    ]
