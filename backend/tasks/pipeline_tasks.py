"""Tugas-tugas Celery. Saat ini hanya tugas uji koneksi."""
from backend.tasks.celery_app import celery_app


@celery_app.task(name="gwasena.ping")
def ping() -> str:
    return "pong"


# Minggu 8: tugas run_pipeline (QC -> PCA -> uji asosiasi -> koreksi) ditambahkan di sini.
