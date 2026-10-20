"""Mengisi data referensi awal (idempoten, aman dijalankan berulang)."""
from sqlalchemy import select

from backend.core.database import SessionLocal
from backend.models import AnalysisModel

DEFAULT_MODELS = [
    {
        "model_name": "GLM",
        "software_version": "belum ditetapkan (minggu 8)",
        "description": "General Linear Model dengan kovariat PC dari PCA.",
    },
    {
        "model_name": "MLM",
        "software_version": "belum ditetapkan (minggu 8)",
        "description": "Mixed Linear Model dengan kovariat PC dan matriks kinship.",
    },
]


def seed_reference_data() -> None:
    with SessionLocal() as db:
        for item in DEFAULT_MODELS:
            exists = db.scalar(
                select(AnalysisModel).where(AnalysisModel.model_name == item["model_name"])
            )
            if not exists:
                db.add(AnalysisModel(**item))
        db.commit()
