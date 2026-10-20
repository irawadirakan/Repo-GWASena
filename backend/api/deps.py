"""Dependency bersama: pengguna yang sedang login dan kepemilikan analisis (FR-01, FR-12)."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.security import decode_token
from backend.models import Analysis, User

bearer = HTTPBearer(auto_error=False, description="Tempel access_token dari POST /api/auth/login")


def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if cred is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Silakan login terlebih dahulu.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(cred.credentials)
    user = db.get(User, payload["sub"]) if payload else None
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Token tidak valid atau kedaluwarsa. Silakan login ulang.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def owned_analysis(
    analysis_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Analysis:
    analysis = db.get(Analysis, analysis_id)
    if analysis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analisis tidak ditemukan.")
    if analysis.user_id != user.user_id and user.role != "administrator":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Anda tidak memiliki akses ke analisis ini.")
    return analysis
