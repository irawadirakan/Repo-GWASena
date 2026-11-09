"""
Titik masuk backend GWASena.

Jalankan dari ROOT repositori (bukan dari folder backend/):
    uvicorn backend.main:app --reload
Lalu buka http://localhost:8000/docs
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import models  # noqa: F401  (mendaftarkan semua 12 tabel)
from backend.api import admin, analyses, auth, health, meta
from backend.core import errors
from backend.core.config import settings
from backend.core.database import init_db
from backend.services.analysis_runner import recover_stuck_analyses

logger = logging.getLogger("gwasena")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    if settings.AUTO_CREATE_TABLES:
        try:
            init_db()
            logger.info("Tabel basis data siap dan data referensi terisi.")
        except Exception as exc:  # noqa: BLE001
            # Aplikasi tetap menyala agar /api/health bisa menunjukkan masalahnya.
            logger.error("Gagal terhubung/membuat tabel DB: %s", exc)
    try:
        n = recover_stuck_analyses()
        if n:
            logger.warning("%s analisis yang terhenti saat server mati ditandai gagal.", n)
    except Exception as exc:  # noqa: BLE001
        logger.error("Gagal memeriksa analisis yang terhenti: %s", exc)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API platform GWAS edukatif untuk bawang putih (Allium sativum).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (health.router, meta.router, auth.router, analyses.router, admin.router):
    app.include_router(r)

errors.register(app)


@app.get("/", include_in_schema=False)
def root():
    return {"message": "GWASena API berjalan. Buka /docs untuk dokumentasi."}
