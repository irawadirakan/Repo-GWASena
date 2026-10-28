"""Orkestrasi alur utama GWAS (UC-01 Run GWAS Pipeline).

    validasi -> QC -> PCA -> uji asosiasi (GLM) -> koreksi multiple testing

Modul ini tidak mengenal FastAPI/basis data. Backend memanggil run_pipeline()
dan menyimpan hasilnya; callback on_stage dipakai untuk melaporkan kemajuan
tiap tahap (FR-10).
"""
import re
from pathlib import Path
from typing import Callable

import numpy as np
from scipy import stats

from pipeline.errors import PipelineError
from pipeline.gwas import benjamini_hochberg, bonferroni, run_glm, run_mlm
from pipeline.pca import run_pca
from pipeline.quality_control import QCParams, run_qc
from pipeline.validation import match_sample_ids, read_phenotype_csv, read_vcf

STAGES = [
    ("validasi", "Validasi berkas"),
    ("qc", "Quality Control"),
    ("pca", "Analisis struktur populasi (PCA)"),
    ("asosiasi", "Uji asosiasi"),
    ("koreksi", "Koreksi multiple testing"),
]
MIN_SAMPLES = 10
SUPPORTED_MODELS = {"GLM", "MLM"}

StageCallback = Callable[[str, str, str | None], None]


def _chrom_key(c: str):
    m = re.search(r"(\d+)$", c)
    return (0, int(m.group(1)), c) if m else (1, 0, c)


def _qq_points(p: np.ndarray) -> list[dict]:
    pv = np.sort(p[np.isfinite(p) & (p > 0)])
    m = pv.size
    if m == 0:
        return []
    expected = -np.log10((np.arange(1, m + 1) - 0.5) / m)
    observed = -np.log10(pv)
    return [{"expected": round(float(e), 4), "observed": round(float(o), 4)}
            for e, o in zip(expected, observed)]


def genomic_inflation(p: np.ndarray) -> float | None:
    pv = p[np.isfinite(p) & (p > 0)]
    if pv.size == 0:
        return None
    chi = stats.chi2.isf(pv, df=1)
    return round(float(np.median(chi) / stats.chi2.ppf(0.5, df=1)), 4)


def run_pipeline(
    genotype_path: str | Path,
    phenotype_path: str | Path,
    params: dict,
    on_stage: StageCallback | None = None,
) -> dict:
    notify = on_stage or (lambda stage, status, message=None: None)

    # 1. Validasi dan penyelarasan sampel
    notify("validasi", "berjalan", None)
    geno = read_vcf(genotype_path)
    pheno = read_phenotype_csv(phenotype_path)
    match_sample_ids(geno.samples, pheno.samples)
    trait = params.get("trait")
    if trait not in pheno.traits:
        raise PipelineError(
            f"Sifat '{trait}' tidak ada di berkas fenotipe.",
            [f"Pilihan sifat: {', '.join(pheno.trait_names)}"],
        )
    order = [pheno.samples.index(s) for s in geno.samples]
    y_all = pheno.traits[trait][order]
    notify("validasi", "selesai", f"{geno.n_samples} sampel, {geno.n_snps} SNP")

    # 2. Quality Control
    notify("qc", "berjalan", None)
    qc_params = QCParams(
        mind=params.get("mind", 0.1),
        geno=params.get("geno", 0.1),
        maf=params.get("maf", 0.05),
        hwe=params.get("hwe"),
        king_cutoff=params.get("king_cutoff"),
    )
    qc = run_qc(geno.dosage, geno.samples, qc_params)
    s_idx = np.flatnonzero(qc.sample_mask)
    v_idx = np.flatnonzero(qc.snp_mask)
    if s_idx.size < MIN_SAMPLES:
        raise PipelineError(
            "Sampel yang lolos QC terlalu sedikit untuk dianalisis.",
            [f"Lolos QC: {s_idx.size} sampel; minimal {MIN_SAMPLES}. "
             "Longgarkan ambang missingness atau periksa kualitas data."],
        )
    if v_idx.size == 0:
        raise PipelineError(
            "Tidak ada SNP yang lolos QC.",
            ["Longgarkan ambang MAF, missingness SNP, atau HWE."],
        )
    g = geno.dosage[np.ix_(s_idx, v_idx)]
    y = y_all[s_idx]
    samples_kept = [geno.samples[i] for i in s_idx]
    notify("qc", "selesai", f"Lolos: {s_idx.size} sampel, {v_idx.size} SNP")

    # 3. PCA
    notify("pca", "berjalan", None)
    pca = run_pca(g, params.get("n_pc", 3))
    notify("pca", "selesai", f"{pca.pcs.shape[1]} PC dihitung")

    # 4. Uji asosiasi
    model = params.get("model", "GLM")
    if model not in SUPPORTED_MODELS:
        raise PipelineError(f"Model {model} belum tersedia pada versi ini.", ["Gunakan model GLM."])
    notify("asosiasi", "berjalan", None)
    variance = None
    if model == "MLM":
        glm, vc = run_mlm(y, g, pca.pcs)
        variance = vc.as_dict()
    else:
        glm = run_glm(y, g, pca.pcs)
    notify("asosiasi", "selesai", f"{model}: {v_idx.size} SNP diuji pada {glm.n_used} sampel")

    # 5. Koreksi multiple testing
    notify("koreksi", "berjalan", None)
    p_bonf = bonferroni(glm.p)
    q_fdr = benjamini_hochberg(glm.p)
    alpha = params.get("alpha", 0.05)
    methods = params.get("koreksi") or ["bonferroni", "fdr"]
    significant = np.zeros(v_idx.size, dtype=bool)
    if "bonferroni" in methods:
        significant |= np.nan_to_num(p_bonf, nan=1.0) < alpha
    if "fdr" in methods:
        significant |= np.nan_to_num(q_fdr, nan=1.0) < alpha
    n_tested = int(np.isfinite(glm.p).sum())
    notify("koreksi", "selesai", f"{int(significant.sum())} SNP signifikan")

    def fnum(x, nd=6):
        return None if not np.isfinite(x) else float(f"{x:.{nd}g}")

    snp_results = []
    for k, j in enumerate(v_idx):
        snp_results.append({
            "variant_index": int(j),  # indeks varian pada VCF asli
            "snp_id": geno.ids[j],
            "chromosome": geno.chrom[j],
            "position": geno.pos[j],
            "ref": geno.ref[j],
            "alt": geno.alt[j],
            "beta": fnum(glm.beta[k]),
            "se": fnum(glm.se[k]),
            "p_value": fnum(glm.p[k]),
            "p_bonferroni": fnum(p_bonf[k]),
            "q_value": fnum(q_fdr[k]),
            "signifikan": bool(significant[k]),
        })

    manhattan = sorted(
        (
            {"snp_id": r["snp_id"], "chromosome": r["chromosome"], "position": r["position"],
             "neglog10p": round(float(-np.log10(max(r["p_value"], 1e-300))), 4), "signifikan": r["signifikan"]}
            for r in snp_results if r["p_value"] is not None
        ),
        key=lambda d: (_chrom_key(d["chromosome"]), d["position"]),
    )

    return {
        "trait": trait,
        "model": model,
        "qc": qc.as_dict(geno.n_samples, geno.n_snps),
        "varian_dilewati": geno.skipped,
        "pca": pca.as_dict(samples_kept),
        "asosiasi": {
            "jumlah_snp_diuji": n_tested,
            "jumlah_sampel": glm.n_used,
            "derajat_bebas": glm.df,
            "alpha": alpha,
            "metode_koreksi": methods,
            "ambang_bonferroni_p": (alpha / n_tested) if n_tested else None,
            "lambda_gc": genomic_inflation(glm.p),
            "jumlah_signifikan": int(significant.sum()),
            "komponen_varians": variance,  # hanya untuk MLM
        },
        "snp": snp_results,
        "plot": {
            "manhattan": {
                "titik": manhattan,
                "garis_bonferroni": round(float(-np.log10(alpha / n_tested)), 4) if n_tested else None,
            },
            "qq": {"titik": _qq_points(glm.p), "lambda_gc": genomic_inflation(glm.p)},
        },
    }
