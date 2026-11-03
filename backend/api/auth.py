"""M-01 Autentikasi (FR-01): registrasi, login, profil pengguna, dan Google OAuth."""
import base64
import json
import re
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user
from backend.core.config import settings
from backend.core.database import get_db
from backend.core.security import create_token, hash_password, verify_password
from backend.models import User
from backend.schemas import GoogleAuthRequest, LoginIn, RegisterIn

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


@router.post("/google", summary="Masuk atau daftar otomatis dengan Google OAuth")
def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    email = None
    name = None
    sub = payload.google_sub

    # 1. Jika credential (Google JWT ID Token) dikirim, ekstrak datanya
    if payload.credential:
        try:
            parts = payload.credential.strip().split(".")
            if len(parts) >= 2:
                payload_b64 = parts[1]
                payload_b64 += "=" * (-len(payload_b64) % 4)
                jwt_data = json.loads(base64.urlsafe_b64decode(payload_b64).decode("utf-8"))
                email = jwt_data.get("email")
                name = jwt_data.get("name")
                sub = jwt_data.get("sub") or sub
        except Exception:
            pass

    # 2. Jika email tidak didapat dari credential, gunakan email dari payload langsung (OAuth chooser)
    if not email and payload.email:
        email = str(payload.email).strip().lower()

    if not name and payload.name:
        name = payload.name.strip()

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email akun Google tidak ditemukan atau tidak valid.",
        )

    clean_email = email.strip().lower()

    # 3. Cari user berdasarkan email
    user = db.scalar(select(User).where(User.email == clean_email))

    if not user:
        # Otomatis buatkan akun User baru (auto-register) dengan username unik
        raw_username = ""
        if name:
            raw_username = re.sub(r"[^A-Za-z0-9_.-]", "_", name.lower().strip())
        if not raw_username or len(raw_username) < 3:
            raw_username = re.sub(r"[^A-Za-z0-9_.-]", "_", clean_email.split("@")[0].lower())

        base_username = raw_username[:35] or "user_google"
        candidate_username = base_username
        suffix = 1
        while db.scalar(select(User).where(User.username == candidate_username)):
            candidate_username = f"{base_username}_{suffix}"[:50]
            suffix += 1

        random_password = secrets.token_urlsafe(32)
        user = User(
            username=candidate_username,
            email=clean_email,
            password_hash=hash_password(random_password),
            role="pengguna_analisis",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return {
        "access_token": create_token(user.user_id, user.role),
        "token_type": "bearer",
        "berlaku_jam": settings.TOKEN_EXPIRE_HOURS,
        "pengguna": _user_out(user),
    }


@router.get("/me", summary="Profil pengguna yang sedang login")
def me(user: User = Depends(get_current_user)):
    return _user_out(user)
