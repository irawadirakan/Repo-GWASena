"""Menjalankan pipeline untuk satu analisis dan menyimpan hasilnya (M-03, FR-10)."""
import logging
import math
from fastapi import BackgroundTasks
from sqlalchemy import insert, select, update

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
    Sample,
    VisualizationResult,
)
from backend.services import plot_service
from backend.services.dataset_service import GENOTYPE_TYPES, dataset_paths
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
            return

        # PNG Manhattan dan QQ langsung dibuat agar file_path tercatat (AC-08.1).
        # Bila matplotlib belum terpasang, PNG dibuat nanti saat endpoint /png dipanggil.
        try:
            plot_service.render_all(db, analysis_id)
        except Exception:  # noqa: BLE001
            logger.exception("PNG analisis %s gagal dibuat; dapat dibuat ulang lewat endpoint /png", analysis_id)
            db.rollback()


def _save_results(db, analysis_id: int, result: dict) -> None:
    geno_ds = db.scalar(select(Dataset).where(Dataset.analysis_id == analysis_id,
                                              Dataset.file_type.in_(GENOTYPE_TYPES)))
    snp_ids = db.scalars(select(SNP.snp_id).where(SNP.dataset_id == geno_ds.dataset_id)
                         .order_by(SNP.snp_id)).all() if geno_ds else []

    # Perbarui data ringkasan di tabel analyses
    analysis = db.scalar(select(Analysis).where(Analysis.analysis_id == analysis_id))
    if analysis:
        analysis.trait_name = result.get("trait")
        analysis.model_name = result.get("model")
        analysis.lambda_gc = result.get("asosiasi", {}).get("lambda_gc")
        analysis.significant_count = result.get("asosiasi", {}).get("jumlah_signifikan", 0)

    rows = []
    for r in result["snp"]:
        p_val = r.get("p_value")
        neg_log = None
        if p_val is not None and p_val > 0:
            neg_log = round(float(-math.log10(max(p_val, 1e-300))), 4)
        v_idx = r.get("variant_index", 0)
        snp_pk = snp_ids[v_idx] if v_idx < len(snp_ids) else None
        rows.append({
            "analysis_id": analysis_id,
            "snp_id": snp_pk,
            "snp_code": r.get("snp_id"),
            "chromosome": str(r.get("chromosome")),
            "position": r.get("position"),
            "p_value": p_val,
            "neg_log10_p": neg_log,
            "effect_size": r.get("beta"),
            "std_error": r.get("se"),
            "q_value": r.get("q_value"),
            "is_significant": bool(r.get("signifikan", False)),
            "candidate_gene": None,
            "annotation_info": None,
        })
    if rows:
        db.execute(insert(AssociationResult), rows)

    # Tandai sampel dan SNP yang tidak lolos QC (kolom passed_qc)
    lolos = result.get("qc_lolos") or {}
    if geno_ds is not None and lolos:
        sampel_lolos = set(lolos.get("sampel") or [])
        for s in db.scalars(select(Sample).where(Sample.dataset_id == geno_ds.dataset_id)).all():
            s.passed_qc = s.sample_code in sampel_lolos
        varian_lolos = set(lolos.get("varian_index") or [])
        stat = result.get("statistik_snp") or {}
        maf, miss = stat.get("maf") or [], stat.get("missing_rate") or []
        baris_snp = [
            {"snp_id": pk, "passed_qc": i in varian_lolos,
             "maf": maf[i] if i < len(maf) else None,
             "missing_rate": miss[i] if i < len(miss) else None}
            for i, pk in enumerate(snp_ids)
        ]
        # ORM bulk UPDATE berdasarkan primary key (snp_id), dikirim per 5.000 baris
        for k in range(0, len(baris_snp), 5000):
            db.execute(update(SNP), baris_snp[k:k + 5000])

    # Nilai PC yang dipakai sebagai kovariat disimpan sebagai bagian parameter analisis (AC-04.2)
    param = db.scalar(select(AnalysisParameter).where(AnalysisParameter.analysis_id == analysis_id))
    if param is not None:
        pca = result["pca"]
        param.parameter_config = {
            **(param.parameter_config or {}),
            "pca_kovariat": {
                "jumlah_pc": pca.get("jumlah_pc"),
                "variansi_dijelaskan": pca.get("variansi_dijelaskan"),
                "nilai_per_sampel": pca.get("titik"),
            },
        }

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
        VisualizationResult(analysis_id=analysis_id, plot_type="ringkasan", plot_cache=ringkasan, plot_metadata={"judul": "Ringkasan Hasil Analisis"}),
        VisualizationResult(analysis_id=analysis_id, plot_type="manhattan",
                            plot_cache=result["plot"]["manhattan"], plot_metadata={"garis_bonferroni": result["plot"]["manhattan"].get("garis_bonferroni")}),
        VisualizationResult(analysis_id=analysis_id, plot_type="qq", plot_cache=result["plot"]["qq"], plot_metadata={"lambda_gc": result["plot"]["qq"].get("lambda_gc")}),
        VisualizationResult(analysis_id=analysis_id, plot_type="pca", plot_cache=result["pca"], plot_metadata={"variansi_dijelaskan": result["pca"].get("variansi_dijelaskan")}),
    ])
    db.add(AnalysisLog(analysis_id=analysis_id, stage="simpan", status="selesai",
                       message=f"{len(rows)} hasil asosiasi disimpan ke database"))


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


def recover_stuck_analyses() -> int:
    """Menandai gagal analisis yang tertinggal berstatus antre/berjalan setelah server dimulai ulang.

    Pada mode latar belakang FastAPI, proses analisis ikut berhenti ketika server mati,
    sehingga statusnya tidak akan pernah berubah dan sesi terkunci selamanya. Bila Celery
    worker aktif, analisis dibiarkan karena mungkin masih dikerjakan worker.
    """
    if settings.PIPELINE_MODE == "celery" or (settings.PIPELINE_MODE == "auto" and _worker_available()):
        return 0
    with SessionLocal() as db:
        macet = db.scalars(select(Analysis).where(
            Analysis.status.in_([AnalysisStatus.ANTRE, AnalysisStatus.BERJALAN]))).all()
        for a in macet:
            a.status = AnalysisStatus.GAGAL
            db.add(AnalysisLog(analysis_id=a.analysis_id, stage=None, status="gagal",
                               message="Analisis terhenti karena server dimulai ulang.\n"
                                       "Jalankan ulang analisis dengan menekan tombol Jalankan."))
        db.commit()
        return len(macet)
