"""Pembuatan berkas PNG Manhattan/QQ dan pencatatan lokasinya (FR-08, FR-09, AC-08.1).

Dipakai di dua tempat:
  - analysis_runner: PNG langsung dibuat begitu analisis selesai, sehingga kolom
    visualization_results.file_path terisi tanpa menunggu pengguna mengunduh;
  - endpoint GET /plots/{jenis}/png: membaca berkas yang sudah ada, atau membuatnya
    bila belum ada (mis. matplotlib baru dipasang setelah analisis selesai).
"""
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models import VisualizationResult
from backend.services import dataset_service as ds

PNG_TYPES = ("manhattan", "qq")


class PngUnavailable(RuntimeError):
    """matplotlib belum terpasang."""


def render_png(db: Session, analysis_id: int, jenis: str) -> bytes | None:
    """Mengembalikan isi PNG; None bila data plot belum ada. Melempar PngUnavailable."""
    row = db.scalar(select(VisualizationResult).where(
        VisualizationResult.analysis_id == analysis_id, VisualizationResult.plot_type == jenis))
    if row is None or not row.plot_cache:
        return None
    path = Path(row.file_path) if row.file_path else None
    if path is not None and path.is_file():
        return path.read_bytes()
    try:
        from pipeline.visualization.png import manhattan_png, qq_png
    except ImportError as exc:  # matplotlib belum terpasang
        raise PngUnavailable(str(exc)) from exc
    ring = db.scalar(select(VisualizationResult).where(
        VisualizationResult.analysis_id == analysis_id, VisualizationResult.plot_type == "ringkasan"))
    info = ring.plot_cache if ring and ring.plot_cache else {}
    nama = "Manhattan plot" if jenis == "manhattan" else "QQ plot"
    judul = f"{nama} - {info.get('trait', '')} ({info.get('model', '')})"
    png = manhattan_png(row.plot_cache, judul) if jenis == "manhattan" else qq_png(row.plot_cache, judul)
    folder = ds.analysis_dir(analysis_id) / "plot"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{jenis}.png"
    path.write_bytes(png)
    row.file_path = str(path)
    db.commit()
    return png


def render_all(db: Session, analysis_id: int) -> list[str]:
    """Membuat semua PNG sesudah analisis selesai. Gagal di sini tidak menggagalkan analisis."""
    dibuat = []
    for jenis in PNG_TYPES:
        try:
            if render_png(db, analysis_id, jenis) is not None:
                dibuat.append(jenis)
        except PngUnavailable:
            break
    return dibuat
