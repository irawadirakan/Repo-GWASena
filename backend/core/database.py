"""Koneksi basis data (SQLAlchemy 2.0)."""
import logging
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from backend.core.config import settings

logger = logging.getLogger("gwasena")

_connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    # SQLite hanya dipakai untuk pengujian otomatis (pytest / CI).
    _connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args=_connect_args,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Kelas dasar seluruh entitas (tabel)."""


def get_db():
    """Dependency FastAPI: membuka sesi DB per request lalu menutupnya."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_database_exists() -> None:
    """Otomatis membuat database PostgreSQL jika belum ada."""
    url_str = str(settings.DATABASE_URL)
    if not (url_str.startswith("postgres://") or url_str.startswith("postgresql://") or url_str.startswith("postgresql+")):
        return
    try:
        parsed_url = make_url(url_str)
        db_name = parsed_url.database
        if not db_name or db_name == "postgres":
            return
        m_url = parsed_url.set(database="postgres")
        m_engine = create_engine(m_url, isolation_level="AUTOCOMMIT")
        with m_engine.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_catalog.pg_database WHERE datname = :name"),
                {"name": db_name},
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{db_name}"'))
                logger.info("Database '%s' berhasil dibuat otomatis.", db_name)
        m_engine.dispose()
    except Exception as exc:
        logger.warning("Pengecekan auto-create database menghasilkan catatan: %s", exc)


def init_db() -> None:
    """Inisialisasi basis data, pembuatan tabel, dan penyemaian data awal."""
    ensure_database_exists()
    import backend.models  # noqa: F401  (mendaftarkan 12 tabel ke Base.metadata)
    Base.metadata.create_all(bind=engine)
    from backend.services.seed import seed_reference_data
    seed_reference_data()


def check_database() -> dict:
    """Dipakai endpoint /api/health untuk memastikan DB bisa dihubungi."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        tables = sorted(inspect(engine).get_table_names())
        return {"ok": True, "dialect": engine.dialect.name, "tables": tables}
    except Exception as exc:  # noqa: BLE001 - tampilkan pesan apa pun ke health check
        return {"ok": False, "error": str(exc).splitlines()[0]}
