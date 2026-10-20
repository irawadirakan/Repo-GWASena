"""Konfigurasi aplikasi dibaca dari berkas .env di root repositori."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")


def _as_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "ya"}


class Settings:
    APP_NAME: str = "GWASena API"
    APP_VERSION: str = "0.1.1"
    APP_ENV: str = os.getenv("APP_ENV", "development")

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://gwasena:gwasena@localhost:5432/gwasena",
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
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-ganti-kunci-ini-di-env")
    TOKEN_EXPIRE_HOURS: int = int(os.getenv("TOKEN_EXPIRE_HOURS", "12"))

    # Batas jumlah sel genotipe yang disalin ke tabel genotypes (sampel x SNP).
    MAX_GENOTYPE_ROWS: int = int(os.getenv("MAX_GENOTYPE_ROWS", "2000000"))


settings = Settings()
