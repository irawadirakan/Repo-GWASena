"""GLM: y = b0 + PC1..PCk + beta * dosis_SNP + galat, diuji per SNP.

Dihitung serentak untuk semua SNP memakai teorema Frisch-Waugh-Lovell:
fenotipe dan dosis SNP diresidualisasi terhadap kovariat, lalu beta dan
standard error dihitung dari residual tersebut.
"""
from dataclasses import dataclass

import numpy as np
from scipy import stats

from pipeline.errors import PipelineError


@dataclass
class GLMResult:
    beta: np.ndarray
    se: np.ndarray
    t: np.ndarray
    p: np.ndarray
    n_used: int
    df: int


def ols_scan(y: np.ndarray, g: np.ndarray, c: np.ndarray) -> GLMResult:
    """Regresi y = C*b + beta*g_j untuk setiap kolom g_j sekaligus.

    y: (n,), g: (n, m) tanpa NaN, c: (n, k) kovariat TERMASUK intersep.
    Dipakai bersama oleh GLM dan MLM (setelah data ditransformasi).
    """
    n = y.shape[0]
    df = n - c.shape[1] - 1
    if df < 2:
        raise PipelineError(
            "Jumlah sampel terlalu sedikit untuk uji asosiasi.",
            [f"Sampel dengan nilai fenotipe: {n}; kovariat: {c.shape[1] - 1} PC. "
             "Kurangi jumlah PC atau gunakan dataset dengan lebih banyak sampel."],
        )
    proj = c @ np.linalg.pinv(c)            # matriks proyeksi ke ruang kovariat
    y_r = y - proj @ y
    g_r = g - proj @ g

    sxx = np.einsum("ij,ij->j", g_r, g_r)
    sxy = g_r.T @ y_r
    with np.errstate(invalid="ignore", divide="ignore"):
        beta = sxy / sxx
        rss = (y_r @ y_r) - beta * sxy
        se = np.sqrt(np.maximum(rss, 0) / df / sxx)
        t = beta / se
    p = 2 * stats.t.sf(np.abs(t), df)
    invalid = ~np.isfinite(t) | (sxx < 1e-12 * max(1.0, float(np.max(sxx, initial=0.0))))
    for arr in (beta, se, t, p):
        arr[invalid] = np.nan
    return GLMResult(beta=beta, se=se, t=t, p=p, n_used=int(n), df=int(df))


def prepare(y: np.ndarray, g: np.ndarray, covariates: np.ndarray | None):
    """Membuang sampel tanpa fenotipe, imputasi rata-rata genotipe, menyusun kovariat."""
    keep = np.isfinite(y)
    y = y[keep]
    g = g[keep]
    mean = np.nanmean(g, axis=0)
    g = np.where(np.isnan(g), mean, g)
    c = np.ones((y.shape[0], 1))
    if covariates is not None and covariates.size:
        c = np.hstack([c, covariates[keep]])
    return y, g, c


def run_glm(y: np.ndarray, g: np.ndarray, covariates: np.ndarray | None = None) -> GLMResult:
    """y: (n,), g: (n, m) dosis dengan NaN, covariates: (n, k) tanpa intersep."""
    y, g, c = prepare(y, g, covariates)
    return ols_scan(y, g, c)
