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
    APP_VERSION: str = "0.3.0"
    APP_ENV: str = os.getenv("APP_ENV", "development")

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        # Nilai bawaan sama dengan .env.example. Kredensial pribadi (mis. kata sandi PostgreSQL
        # di laptop masing-masing) cukup ditulis di berkas .env, jangan di kode.
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
    # Akun demo (kata sandi password123, termasuk akun admin) hanya untuk pengembangan dan
    # pengujian. Otomatis mati bila APP_ENV=production.
    SEED_DEMO_USERS: bool = _as_bool(os.getenv("SEED_DEMO_USERS", "false" if os.getenv("APP_ENV") == "production" else "true"))

    # Login Google (FR-01): Client ID OAuth dari Google Cloud Console, sama dengan
    # VITE_GOOGLE_CLIENT_ID di frontend. Kosong = login Google dimatikan (503).
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "").strip()

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
    # Sumber anotasi: "ensembl" (bawaan, semua organisme lewat Ensembl) atau "otomatis"
    # (bawang putih memakai berkas GFF3 lokal ANNOTATION_GFF3, organisme lain Ensembl).
    ANNOTATION_SOURCE: str = os.getenv("ANNOTATION_SOURCE", "ensembl").strip().lower()
    # Batas waktu total (detik) satu kali anotasi melalui Ensembl REST API.
    ANNOTATION_TIMEOUT_TOTAL: float = float(os.getenv("ANNOTATION_TIMEOUT_TOTAL", "25"))
    # true = anotasi gen kandidat langsung dihitung setelah analisis selesai (hasilnya di-cache).
    ANNOTATION_AUTO: bool = _as_bool(os.getenv("ANNOTATION_AUTO", "true"))

    # Smart downsampling Manhattan plot: di atas batas ini, titik non-signifikan diringkas
    # agar grafik interaktif tetap ringan (SNP signifikan selalu dipertahankan).
    MANHATTAN_MAX_POINTS: int = int(os.getenv("MANHATTAN_MAX_POINTS", "20000"))


settings = Settings()
