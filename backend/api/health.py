"""Endpoint pemeriksaan kesehatan sistem (bukti kerangka berjalan)."""
from fastapi import APIRouter

from backend.core.config import settings
from backend.core.database import check_database

router = APIRouter(prefix="/api/health", tags=["health"])


def check_redis() -> dict:
    try:
        import redis

        client = redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1)
        client.ping()
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc).splitlines()[0]}


def check_features() -> dict:
    """Fitur pendukung yang bergantung pada paket atau pengaturan tambahan."""
    try:
        import matplotlib  # noqa: F401
        png = {"ok": True}
    except ImportError:
        png = {"ok": False, "error": "matplotlib belum terpasang; ekspor PNG tidak tersedia."}
    gff3 = settings.ANNOTATION_GFF3
    return {
        "ekspor_png": png,
        "sumber_anotasi": settings.ANNOTATION_SOURCE,
        "anotasi_gff3": {"ok": gff3.is_file(), "berkas": gff3.name,
                         "dipakai": settings.ANNOTATION_SOURCE in ("otomatis", "gff3")},
        "login_google": {"ok": bool(settings.GOOGLE_CLIENT_ID),
                         **({} if settings.GOOGLE_CLIENT_ID else {"error": "GOOGLE_CLIENT_ID belum diisi."})},
        "mode_pipeline": settings.PIPELINE_MODE,
    }


@router.get("")
def health():
    db = check_database()
    rd = check_redis()
    return {
        "status": "ok" if db["ok"] else "degraded",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "components": {"api": {"ok": True}, "database": db, "redis": rd},
        "fitur": check_features(),
    }


@router.get("/worker")
def worker_health():
    """Mengirim tugas 'ping' ke Celery worker dan menunggu balasan (maks. 5 detik)."""
    if not check_redis()["ok"]:
        return {"ok": False, "error": "Redis tidak dapat dihubungi, worker tidak bisa dicek."}
    try:
        from backend.tasks.pipeline_tasks import ping

        result = ping.apply_async(retry=False).get(timeout=5)
        return {"ok": result == "pong", "reply": result}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"Worker tidak merespons: {exc}"}
