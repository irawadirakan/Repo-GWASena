"""Mengisi data referensi awal (idempoten, aman dijalankan berulang)."""
from sqlalchemy import or_, select

from backend.core.config import settings
from backend.core.database import SessionLocal
from backend.core.security import hash_password
from backend.models import AnalysisModel, User

DEFAULT_MODELS = [
    {
        "model_name": "GLM",
        "software_version": "Python numpy/scipy (pipeline/gwas/glm.py)",
        "description": "General Linear Model dengan kovariat PC dari PCA.",
    },
    {
        "model_name": "MLM",
        "software_version": "Python numpy/scipy, REML P3D (pipeline/gwas/mlm.py)",
        "description": "Mixed Linear Model dengan kovariat PC dan matriks kinship.",
    },
]

DEFAULT_USERS = [
    {
        "username": "user_demo",
        "email": "demo@gwasena.id",
        "password": "password123",
        "role": "pengguna_analisis",
    },
    {
        "username": "peneliti_demo",
        "email": "peneliti_demo@gwasena.id",
        "password": "password123",
        "role": "pengguna_analisis",
    },
    {
        "username": "peneliti_ipb",
        "email": "peneliti@apps.ipb.ac.id",
        "password": "password123",
        "role": "pengguna_analisis",
    },
    {
        "username": "admin",
        "email": "admin@gwasena.id",
        "password": "password123",
        "role": "administrator",
    },
]


def seed_reference_data() -> None:
    with SessionLocal() as db:
        # 1. Seed Models
        for item in DEFAULT_MODELS:
            exists = db.scalar(
                select(AnalysisModel).where(AnalysisModel.model_name == item["model_name"])
            )
            if not exists:
                db.add(AnalysisModel(**item))

        # 2. Seed Default Users (akun demo; dimatikan di production lewat SEED_DEMO_USERS)
        for u in (DEFAULT_USERS if settings.SEED_DEMO_USERS else []):
            exists_user = db.scalar(
                select(User).where(
                    or_(User.username == u["username"], User.email == u["email"].lower())
                )
            )
            if not exists_user:
                db.add(
                    User(
                        username=u["username"],
                        email=u["email"].lower(),
                        password_hash=hash_password(u["password"]),
                        role=u["role"],
                    )
                )
        db.commit()
