"""Konfigurasi aplikasi dibaca dari berkas .env di root repositori dan backend/."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
# Prioritaskan berkas konfigurasi tanpa menimpa environment variable yang sudah diset (mis. saat pengujian pytest)
load_dotenv(ROOT_DIR / "backend" / ".env", override=False)
load_dotenv(ROOT_DIR / ".env", override=False)


def _as_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "ya"}


class Settings:
    APP_NAME: str = "GWASena API"
    APP_VERSION: str = "0.2.0"
    APP_ENV: str = os.getenv("APP_ENV", "development")

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:renoipb@localhost:5432/gwasena_database",
    )
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if o.strip()
    ]
    AUTO_CREATE_TABLES: bool = _as_bool(os.getenv("AUTO_CREATE_TABLES", "true"))
    UPLOAD_DIR: Path = (ROOT_DIR / os.getenv("UPLOAD_DIR", "./storage/uploads")).resolve()
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "200"))

    # Autentikasi (FR-01). Ganti SECRET_KEY di .env dengan teks acak yang panjang.
    SECRET_KEY: str = os.getenv("SECRET_KEY", "gwasena_secret_key_super_aman_2026")
    TOKEN_EXPIRE_HOURS: int = int(os.getenv("TOKEN_EXPIRE_HOURS", "12"))

    # Cara menjalankan pipeline:
    #   auto       -> pakai Celery bila worker aktif, selain itu dijalankan di latar belakang FastAPI
    #   celery     -> selalu dikirim ke antrean Celery (worker wajib dinyalakan)
    #   background -> selalu dijalankan di latar belakang FastAPI (tanpa Celery)
    PIPELINE_MODE: str = os.getenv("PIPELINE_MODE", "auto").strip().lower()

    # Batas jumlah sel genotipe yang disalin ke tabel genotypes (sampel x SNP).
    MAX_GENOTYPE_ROWS: int = int(os.getenv("MAX_GENOTYPE_ROWS", "2000000"))

    # Anotasi gen kandidat (FR-07): berkas anotasi genom GFF3 dan jendela pencarian gen (bp).
    ANNOTATION_GFF3: Path = (
        ROOT_DIR / os.getenv("ANNOTATION_GFF3", "./data/contoh/anotasi_bawang_putih_contoh.gff3")
    ).resolve()
    ANNOTATION_WINDOW_BP: int = int(os.getenv("ANNOTATION_WINDOW_BP", "50000"))


settings = Settings()
