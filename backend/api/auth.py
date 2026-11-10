"""M-01 Autentikasi (FR-01): registrasi, login, profil pengguna, dan Google OAuth."""
import json
import re
import secrets
import urllib.error
import urllib.parse
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.api.deps import get_current_user
from backend.core.config import settings
from backend.core.database import get_db
from backend.core.security import create_token, hash_password, verify_password
from backend.models import User
from backend.schemas import GoogleAuthRequest, LoginIn, RegisterIn

router = APIRouter(prefix="/api/auth", tags=["1. autentikasi"])

DUMMY_EMAIL_PREFIXES = ("blablabla", "test", "dummy", "abc", "123", "asdf", "user")
DISPOSABLE_DOMAINS = (
    "mailinator.com",
    "tempmail.com",
    "example.com",
    "throwaway.com",
    "guerrillamail.com",
)


def _validate_not_dummy_email(email: str) -> None:
    clean = email.strip().lower()
    parts = clean.split("@")
    if len(parts) != 2:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Format alamat email tidak valid."
        )
    prefix, domain = parts
    for p in DUMMY_EMAIL_PREFIXES:
        if (
            prefix == p
            or prefix.startswith(f"{p}_")
            or prefix.startswith(f"{p}.")
            or prefix.startswith(f"{p}1")
            or prefix.startswith(f"{p}2")
            or prefix.startswith(f"{p}@")
        ):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Alamat email dummy atau percobaan tidak diizinkan. Mohon gunakan email resmi atau institusi yang valid.",
            )
    for d in DISPOSABLE_DOMAINS:
        if domain == d or domain.endswith("." + d):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Domain email sementara (disposable) tidak diizinkan. Mohon gunakan email institusi atau email resmi yang valid.",
            )


def _user_out(u: User) -> dict:
    created_str = None
    if hasattr(u, "created_at") and u.created_at:
        try:
            created_str = u.created_at.isoformat()
        except Exception:
            created_str = str(u.created_at)
    return {
        "user_id": u.user_id,
        "username": u.username,
        "email": u.email,
        "role": u.role,
        "created_at": created_str,
    }


@router.post("/register", status_code=status.HTTP_201_CREATED, summary="Daftar akun baru")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    _validate_not_dummy_email(data.email)
    email = data.email.strip().lower()
    if db.scalar(select(User).where(func.lower(User.username) == data.username.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            {"pesan": "Username sudah dipakai.", "rincian": ["Pilih username lain."]})
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            {"pesan": "Email sudah terdaftar.",
                             "rincian": ["Masuk dengan email ini, atau gunakan email lain untuk akun baru."]})
    user = User(
        username=data.username,
        email=email,
        password_hash=hash_password(data.password),
        role="pengguna_analisis",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    u_out = _user_out(user)
    return {
        "pesan": "Akun berhasil dibuat. Silakan login.",
        "user": u_out,
        "pengguna": u_out,
    }


@router.post("/login", summary="Login dan dapatkan token")
def login(data: LoginIn, db: Session = Depends(get_db)):
    ident = data.username.strip()
    # Isian berisi "@" dicari sebagai email, selain itu sebagai username. Email dibandingkan tanpa
    # membedakan huruf besar/kecil, termasuk akun lama yang emailnya tersimpan dengan huruf besar.
    if "@" in ident:
        user = db.scalar(select(User).where(func.lower(User.email) == ident.lower()))
    else:
        user = db.scalar(select(User).where(User.username == ident))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Username/email atau kata sandi salah.")
    u_out = _user_out(user)
    return {
        "access_token": create_token(user.user_id, user.role),
        "token_type": "bearer",
        "berlaku_jam": settings.TOKEN_EXPIRE_HOURS,
        "user": u_out,
        "pengguna": u_out,
    }


GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


def verify_google_credential(credential: str) -> dict:
    """Memeriksa ID token Google ke server Google lalu mengembalikan klaimnya.

    Tanda tangan, masa berlaku, dan penerbit token diperiksa oleh endpoint tokeninfo
    milik Google. Di sini dicek lagi bahwa token memang dibuat untuk aplikasi GWASena
    (aud = GOOGLE_CLIENT_ID) dan emailnya sudah diverifikasi Google.
    """
    url = f"{GOOGLE_TOKENINFO_URL}?{urllib.parse.urlencode({'id_token': credential})}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            claims = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token Google tidak valid atau sudah kedaluwarsa.")
    except (urllib.error.URLError, TimeoutError, ValueError):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            "Server Google tidak dapat dihubungi untuk memeriksa token. Coba lagi.")
    if claims.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token Google bukan untuk aplikasi GWASena.")
    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Penerbit token bukan Google.")
    if str(claims.get("email_verified", "")).lower() != "true":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email akun Google belum terverifikasi.")
    if not claims.get("email"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token Google tidak memuat email.")
    return claims


@router.post("/google", summary="Masuk atau daftar otomatis dengan Google (ID token terverifikasi)")
def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    # Login Google hanya menerima ID token (credential) dari tombol Google Identity Services.
    # Email yang diketik/dikirim langsung TIDAK dipercaya, karena siapa pun bisa mengirim
    # email orang lain (termasuk admin) dan langsung masuk sebagai orang itu.
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            "Login Google belum dikonfigurasi (GOOGLE_CLIENT_ID kosong). "
                            "Gunakan login username/email dan kata sandi.")
    if not payload.credential:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "credential (ID token dari tombol Google) wajib dikirim.")
    claims = verify_google_credential(payload.credential.strip())
    email = claims["email"]
    name = claims.get("name") or (payload.name.strip() if payload.name else None)

    clean_email = email.strip().lower()

    # 3. Cari user berdasarkan email
    user = db.scalar(select(User).where(func.lower(User.email) == clean_email))

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

    u_out = _user_out(user)
    return {
        "access_token": create_token(user.user_id, user.role),
        "token_type": "bearer",
        "berlaku_jam": settings.TOKEN_EXPIRE_HOURS,
        "user": u_out,
        "pengguna": u_out,
    }


@router.get("/me", summary="Profil pengguna yang sedang login")
def me(user: User = Depends(get_current_user)):
    return _user_out(user)
