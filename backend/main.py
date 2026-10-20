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

from backend import models  # noqa: F401  (mendaftarkan semua tabel)
from backend.api import analyses, auth, health, meta
from backend.core.config import settings
from backend.core.database import Base, engine
from backend.services.seed import seed_reference_data

logger = logging.getLogger("gwasena")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    if settings.AUTO_CREATE_TABLES:
        try:
            Base.metadata.create_all(bind=engine)
            seed_reference_data()
            logger.info("Tabel basis data siap.")
        except Exception as exc:  # noqa: BLE001
            # Aplikasi tetap menyala agar /api/health bisa menunjukkan masalahnya.
            logger.error("Gagal terhubung/membuat tabel DB: %s", exc)
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

for r in (health.router, meta.router, auth.router, analyses.router):
    app.include_router(r)


@app.get("/", include_in_schema=False)
def root():
    return {"message": "GWASena API berjalan. Buka /docs untuk dokumentasi."}
