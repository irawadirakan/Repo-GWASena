"""Anotasi gen kandidat (FR-07) dengan cache di basis data.

Hasil anotasi disimpan pada tabel visualization_results (plot_type "anotasi" untuk SNP signifikan
dan "anotasi_teratas" untuk SNP signifikan + 10 SNP teratas), sehingga pemanggilan berikutnya
langsung dijawab tanpa meminta ulang ke Ensembl. Cache hanya disimpan bila seluruh SNP berhasil
dianotasi; hasil yang sebagian gagal akan dicoba lagi pada pemanggilan berikutnya.
"""
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.models import Analysis, AssociationResult, VisualizationResult
from pipeline.annotation import annotate_snps_auto

logger = logging.getLogger("gwasena.anotasi")

PLOT_TYPE = {False: "anotasi", True: "anotasi_teratas"}


def _ringkasan(db: Session, analysis_id: int) -> dict:
    row = db.scalar(select(VisualizationResult).where(
        VisualizationResult.analysis_id == analysis_id, VisualizationResult.plot_type == "ringkasan"))
    return (row.plot_cache if row else None) or {}


def annotate(db: Session, a: Analysis, organism: str, sertakan_teratas: bool = False,
             segarkan: bool = False) -> dict:
    ringkasan = _ringkasan(db, a.analysis_id)
    plot_type = PLOT_TYPE[bool(sertakan_teratas)]
    cache_row = db.scalar(select(VisualizationResult).where(
        VisualizationResult.analysis_id == a.analysis_id, VisualizationResult.plot_type == plot_type))
    if (cache_row and cache_row.plot_cache and not segarkan
            and cache_row.plot_cache.get("organism_input") == organism):
        return {**cache_row.plot_cache, "dari_cache": True}

    snps = list(ringkasan.get("snp_signifikan") or [])
    signifikan = {s["snp_id"] for s in snps}
    label = "SNP signifikan"
    if sertakan_teratas:
        snps += [s for s in ringkasan.get("snp_teratas") or [] if s["snp_id"] not in signifikan]
        label = "SNP (signifikan dan teratas)"

    hasil = annotate_snps_auto(snps, organism, settings.ANNOTATION_GFF3, settings.ANNOTATION_WINDOW_BP,
                               label, timeout_total=settings.ANNOTATION_TIMEOUT_TOTAL)
    for k in hasil["kandidat"]:
        k["signifikan"] = k["snp_id"] in signifikan

    # Simpan gen terdekat ke hasil asosiasi (kolom Kandidat_Gen pada CSV). SNP yang gagal
    # dianotasi tidak ditimpa, agar hasil sebelumnya tidak hilang.
    berhasil = {k["snp_id"]: k for k in hasil["kandidat"] if k.get("status_anotasi", "berhasil") == "berhasil"}
    if berhasil and hasil["status"] == "tersedia":
        rows = db.scalars(select(AssociationResult).where(
            AssociationResult.analysis_id == a.analysis_id,
            AssociationResult.snp_code.in_(list(berhasil)))).all()
        for r in rows:
            k = berhasil[r.snp_code]
            gen = k.get("gen") or []
            r.candidate_gene = (gen[0].get("gene_id") or gen[0].get("gene_name")) if gen else None
            r.annotation_info = k

    if hasil["status"] == "tersedia" and not snps:
        hasil["pesan"] += " Gunakan sertakan_teratas=true untuk melihat kandidat gen di sekitar SNP teratas."
    out = {"analysis_id": a.analysis_id, "trait": ringkasan.get("trait"), "model": ringkasan.get("model"),
           **hasil, "organism_input": organism}

    lengkap = hasil["status"] == "tersedia" and not hasil.get("jumlah_gagal")
    if lengkap:
        if cache_row is None:
            cache_row = VisualizationResult(analysis_id=a.analysis_id, plot_type=plot_type)
            db.add(cache_row)
        cache_row.plot_cache = out
    elif cache_row is not None:
        db.delete(cache_row)
    db.commit()
    return {**out, "dari_cache": False}


def precompute(db: Session, a: Analysis) -> None:
    """Dipanggil setelah analisis selesai agar layar Anotasi Gen langsung terisi."""
    from backend.api.analyses import _resolve_session_organism  # impor di sini untuk menghindari siklus

    try:
        organism, _ = _resolve_session_organism(db, a)
        annotate(db, a, organism, sertakan_teratas=True)
    except Exception:  # noqa: BLE001
        logger.exception("Anotasi otomatis analisis %s gagal; dapat dicoba lagi lewat endpoint anotasi",
                         a.analysis_id)
        db.rollback()
