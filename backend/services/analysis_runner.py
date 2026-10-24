"""Menjalankan pipeline untuk satu analisis dan menyimpan hasilnya (M-03, FR-10)."""
import logging

from fastapi import BackgroundTasks
from sqlalchemy import insert, select

from backend.core.config import settings
from backend.core.database import SessionLocal
from backend.models import (
    SNP,
    Analysis,
    AnalysisLog,
    AnalysisParameter,
    AnalysisStatus,
    AssociationResult,
    Dataset,
    VisualizationResult,
)
from backend.services.dataset_service import dataset_paths
from pipeline.errors import PipelineError
from pipeline.runner import run_pipeline

logger = logging.getLogger("gwasena.runner")


def _log(db, analysis_id: int, stage: str | None, status: str, message: str | None = None) -> None:
    db.add(AnalysisLog(analysis_id=analysis_id, stage=stage, status=status, message=message))
    db.commit()


def run_analysis(analysis_id: int) -> None:
    """Dipanggil oleh Celery worker atau BackgroundTasks FastAPI."""
    with SessionLocal() as db:
        analysis = db.get(Analysis, analysis_id)
        if analysis is None:
            return
        param = db.scalar(select(AnalysisParameter).where(AnalysisParameter.analysis_id == analysis_id))
        geno_path, pheno_path = dataset_paths(db, analysis_id)
        if param is None or not geno_path or not pheno_path:
            analysis.status = AnalysisStatus.GAGAL
            _log(db, analysis_id, None, "gagal", "Berkas atau parameter analisis belum lengkap.")
            return

        analysis.status = AnalysisStatus.BERJALAN
        db.commit()
        current = {"stage": None}

        def on_stage(stage: str, status: str, message: str | None = None) -> None:
            current["stage"] = stage
            _log(db, analysis_id, stage, status, message)

        try:
            result = run_pipeline(geno_path, pheno_path, param.parameter_config, on_stage)
        except PipelineError as exc:
            db.rollback()
            detail = "\n".join([exc.message, *exc.details])
            analysis.status = AnalysisStatus.GAGAL
            _log(db, analysis_id, current["stage"], "gagal", detail)
            return
        except Exception as exc:  # noqa: BLE001
            logger.exception("Pipeline analisis %s gagal", analysis_id)
            db.rollback()
            analysis.status = AnalysisStatus.GAGAL
            _log(db, analysis_id, current["stage"], "gagal",
                 f"Terjadi kesalahan internal saat analisis.\n{type(exc).__name__}: {exc}")
            return

        try:
            _save_results(db, analysis_id, result)
            analysis.status = AnalysisStatus.SELESAI
            db.commit()
        except Exception as exc:  # noqa: BLE001
            logger.exception("Gagal menyimpan hasil analisis %s", analysis_id)
            db.rollback()
            analysis.status = AnalysisStatus.GAGAL
            _log(db, analysis_id, "simpan", "gagal", f"Hasil gagal disimpan.\n{exc}")


def _save_results(db, analysis_id: int, result: dict) -> None:
    geno_ds = db.scalar(select(Dataset).where(Dataset.analysis_id == analysis_id,
                                              Dataset.file_type == "vcf"))
    snp_ids = db.scalars(select(SNP.snp_id).where(SNP.dataset_id == geno_ds.dataset_id)
                         .order_by(SNP.snp_id)).all()
    rows = [
        {"analysis_id": analysis_id, "snp_id": snp_ids[r["variant_index"]], "p_value": r["p_value"],
         "effect_size": r["beta"], "std_error": r["se"], "q_value": r["q_value"]}
        for r in result["snp"]
    ]
    if rows:
        db.execute(insert(AssociationResult), rows)

    significant = [r for r in result["snp"] if r["signifikan"]]
    top = sorted((r for r in result["snp"] if r["p_value"] is not None),
                 key=lambda r: r["p_value"])[:10]
    ringkasan = {
        "trait": result["trait"],
        "model": result["model"],
        "qc": result["qc"],
        "varian_dilewati": result["varian_dilewati"],
        "pca": {k: v for k, v in result["pca"].items() if k != "titik"},
        "asosiasi": result["asosiasi"],
        "snp_signifikan": significant,
        "snp_teratas": top,
    }
    db.add_all([
        VisualizationResult(analysis_id=analysis_id, plot_type="ringkasan", plot_cache=ringkasan),
        VisualizationResult(analysis_id=analysis_id, plot_type="manhattan",
                            plot_cache=result["plot"]["manhattan"]),
        VisualizationResult(analysis_id=analysis_id, plot_type="qq", plot_cache=result["plot"]["qq"]),
        VisualizationResult(analysis_id=analysis_id, plot_type="pca", plot_cache=result["pca"]),
    ])
    db.add(AnalysisLog(analysis_id=analysis_id, stage="simpan", status="selesai",
                       message=f"{len(rows)} hasil asosiasi disimpan"))


def _redis_ok() -> bool:
    try:
        import redis

        redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1).ping()
        return True
    except Exception:  # noqa: BLE001
        return False


def _worker_available() -> bool:
    if not _redis_ok():
        return False
    try:
        from backend.tasks.celery_app import celery_app

        return bool(celery_app.control.ping(timeout=1.0))
    except Exception:  # noqa: BLE001
        return False


def dispatch(analysis_id: int, background_tasks: BackgroundTasks) -> str:
    """Mengirim analisis ke Celery bila tersedia; jika tidak, ke latar belakang FastAPI."""
    mode = settings.PIPELINE_MODE
    use_celery = (mode == "celery" and _redis_ok()) or (mode == "auto" and _worker_available())
    if use_celery:
        from backend.tasks.pipeline_tasks import run_pipeline_task

        run_pipeline_task.apply_async(args=[analysis_id], retry=False)
        return "celery"
    background_tasks.add_task(run_analysis, analysis_id)
    return "background"
