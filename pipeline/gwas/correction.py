"""Koreksi multiple testing (FR-06)."""
import numpy as np


def bonferroni(p: np.ndarray) -> np.ndarray:
    m = np.isfinite(p).sum()
    out = np.minimum(p * m, 1.0)
    out[~np.isfinite(p)] = np.nan
    return out


def benjamini_hochberg(p: np.ndarray) -> np.ndarray:
    """q-value Benjamini-Hochberg (FDR)."""
    q = np.full_like(p, np.nan, dtype=float)
    ok = np.isfinite(p)
    pv = p[ok]
    m = pv.size
    if m == 0:
        return q
    order = np.argsort(pv)
    ranked = pv[order] * m / np.arange(1, m + 1)
    ranked = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty(m)
    out[order] = np.minimum(ranked, 1.0)
    q[ok] = out
    return q
