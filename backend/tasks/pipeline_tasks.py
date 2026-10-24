"""Tugas-tugas Celery."""
from backend.tasks.celery_app import celery_app


@celery_app.task(name="gwasena.ping")
def ping() -> str:
    return "pong"


@celery_app.task(name="gwasena.run_pipeline")
def run_pipeline_task(analysis_id: int) -> str:
    """Menjalankan alur QC -> PCA -> GLM -> koreksi untuk satu analisis."""
    from backend.services.analysis_runner import run_analysis

    run_analysis(analysis_id)
    return f"analysis {analysis_id} diproses"
