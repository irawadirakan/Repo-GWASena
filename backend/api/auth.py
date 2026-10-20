"""M-01 Autentikasi (FR-01): registrasi, login, dan profil pengguna."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user
from backend.core.config import settings
from backend.core.database import get_db
from backend.core.security import create_token, hash_password, verify_password
from backend.models import User
from backend.schemas import LoginIn, RegisterIn

router = APIRouter(prefix="/api/auth", tags=["1. autentikasi"])


def _user_out(u: User) -> dict:
    return {"user_id": u.user_id, "username": u.username, "email": u.email, "role": u.role}


@router.post("/register", status_code=status.HTTP_201_CREATED, summary="Daftar akun baru")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    exists = db.scalar(
        select(User).where(or_(User.username == data.username, User.email == data.email.lower()))
    )
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Username atau email sudah terdaftar.")
    user = User(
        username=data.username,
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        role="pengguna_analisis",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"pesan": "Akun berhasil dibuat. Silakan login.", "pengguna": _user_out(user)}


@router.post("/login", summary="Login dan dapatkan token")
def login(data: LoginIn, db: Session = Depends(get_db)):
    ident = data.username.strip()
    user = db.scalar(select(User).where(or_(User.username == ident, User.email == ident.lower())))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Username/email atau kata sandi salah.")
    return {
        "access_token": create_token(user.user_id, user.role),
        "token_type": "bearer",
        "berlaku_jam": settings.TOKEN_EXPIRE_HOURS,
        "pengguna": _user_out(user),
    }


@router.get("/me", summary="Profil pengguna yang sedang login")
def me(user: User = Depends(get_current_user)):
    return _user_out(user)
