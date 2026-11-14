"""Membuat gambar PNG Manhattan plot dan QQ plot (FR-09, AC-09.1).

Masukannya data titik yang sudah disimpan pipeline di tabel visualization_results
(plot_type "manhattan" dan "qq"), jadi analisis tidak perlu dijalankan ulang.
"""
from __future__ import annotations

import io
import re

from matplotlib.figure import Figure  # API Figure (tanpa pyplot): aman dipakai banyak permintaan sekaligus

DPI = 300  # cukup tajam untuk laporan dan poster
WARNA_KROMOSOM = ("#1f4e79", "#7fa7d1")  # dua warna berselang antar kromosom
WARNA_SIGNIFIKAN = "#c0392b"
WARNA_GARIS = "#c0392b"


def _chrom_key(c: str):
    m = re.search(r"(\d+)$", str(c))
    return (0, int(m.group(1)), str(c)) if m else (1, 0, str(c))


def _to_png(fig: Figure) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=DPI, bbox_inches="tight")
    return buf.getvalue()


def select_lead_snps_for_labels(
    sig: list[dict],
    offset: dict,
    total_span: float,
    max_labels: int = 5,
    min_rel_spacing: float = 0.12,
) -> list[dict]:
    """Lead SNP Filtering: pilih paling banyak 1 SNP puncak per kromosom,
    maksimal 5 label teratas secara global, dengan jarak horizontal > 12% lebar kanvas."""
    if not sig:
        return []

    best_per_chrom: dict = {}
    for pt in sig:
        c = pt.get("chromosome")
        cur = best_per_chrom.get(c)
        if cur is None or (pt.get("neglog10p") or 0) > (cur.get("neglog10p") or 0):
            best_per_chrom[c] = pt

    ranked = sorted(best_per_chrom.values(), key=lambda p: p.get("neglog10p") or 0, reverse=True)
    selected: list[dict] = []
    placed_x: list[float] = []
    min_gap = max(0.0, float(total_span) * min_rel_spacing)

    for pt in ranked:
        x_pos = float(offset.get(pt.get("chromosome"), 0) + float(pt.get("position") or 0))
        if any(abs(x_pos - px) <= min_gap for px in placed_x):
            continue
        selected.append(pt)
        placed_x.append(x_pos)
        if len(selected) >= max_labels:
            break
    return selected


def manhattan_png(data: dict, judul: str | None = None) -> bytes:
    """data = {"titik": [{snp_id, chromosome, position, neglog10p, signifikan}], "garis_bonferroni": float}"""
    titik = data.get("titik") or []
    garis = data.get("garis_bonferroni")

    kromosom = sorted({t["chromosome"] for t in titik}, key=_chrom_key)
    # posisi kumulatif agar kromosom tampil berurutan pada satu sumbu x
    offset, tengah, mulai = {}, [], 0
    for c in kromosom:
        posisi = [t["position"] for t in titik if t["chromosome"] == c]
        offset[c] = mulai
        tengah.append(mulai + (min(posisi) + max(posisi)) / 2)
        mulai += max(posisi) + 1

    fig = Figure(figsize=(11, 4.2))
    ax = fig.subplots()
    for i, c in enumerate(kromosom):
        pts = [t for t in titik if t["chromosome"] == c]
        ax.scatter([offset[c] + t["position"] for t in pts], [t["neglog10p"] for t in pts],
                   s=10, color=WARNA_KROMOSOM[i % 2], linewidths=0)
    sig = [t for t in titik if t.get("signifikan")]
    max_y = max([t.get("neglog10p") or 0 for t in titik] + ([float(garis)] if garis is not None else []) + [1.0])
    if sig:
        ax.scatter([offset[t["chromosome"]] + t["position"] for t in sig], [t["neglog10p"] for t in sig],
                   s=26, color=WARNA_SIGNIFIKAN, zorder=3, label="SNP signifikan")
        lead_snps = select_lead_snps_for_labels(sig, offset, mulai, max_labels=5, min_rel_spacing=0.12)
        for t in lead_snps:
            ax.annotate(
                t["snp_id"],
                (offset[t["chromosome"]] + t["position"], t["neglog10p"]),
                textcoords="offset points",
                xytext=(0, 8),
                ha="center",
                va="bottom",
                fontsize=8,
                bbox=dict(boxstyle="round,pad=0.15", facecolor="white", alpha=0.85, edgecolor="none"),
            )
    if garis is not None:
        ax.axhline(garis, color=WARNA_GARIS, linestyle="--", linewidth=0.9,
                   label=f"Ambang Bonferroni (-log10 p = {garis:.2f})")

    ax.set_xticks(tengah)
    ax.set_xticklabels(kromosom, fontsize=8)
    ax.set_xlabel("Chromosome")
    ax.set_ylabel("-log10(p)")
    ax.set_ylim(bottom=0, top=max_y * 1.15)
    ax.spines[["top", "right"]].set_visible(False)
    ax.set_title(judul or "Manhattan plot", fontsize=11)
    if sig or garis is not None:
        ax.legend(fontsize=8, frameon=False, loc="upper right")
    return _to_png(fig)


def qq_png(data: dict, judul: str | None = None) -> bytes:
    """data = {"titik": [{expected, observed}], "lambda_gc": float}"""
    titik = data.get("titik") or []
    lam = data.get("lambda_gc")
    ex = [t["expected"] for t in titik]
    ob = [t["observed"] for t in titik]

    fig = Figure(figsize=(5.5, 5))
    ax = fig.subplots()
    ax.scatter(ex, ob, s=10, color=WARNA_KROMOSOM[0], linewidths=0)
    max_x = max(ex + [1.0])
    max_y = max(ob + [max_x])
    ax.plot([0, max_x], [0, max_x], color=WARNA_GARIS, linestyle="--", linewidth=0.9)
    ax.set_xlabel("Expected -log10(p)")
    ax.set_ylabel("Observed -log10(p)")
    ax.set_xlim(0, max_x * 1.05)
    ax.set_ylim(0, max_y * 1.05)
    ax.spines[["top", "right"]].set_visible(False)
    if lam is not None:
        ax.text(0.04, 0.95, f"λGC = {lam:.3f}", transform=ax.transAxes, va="top", fontsize=9)
    ax.set_title(judul or "QQ plot", fontsize=11)
    return _to_png(fig)
