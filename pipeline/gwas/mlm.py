"""MLM (Mixed Linear Model): y = C*b + beta*g + u + e,  u ~ N(0, s2g*K),  e ~ N(0, s2e*I).

K adalah matriks kekerabatan (kinship) VanRaden dari SNP yang lolos QC.
Komponen varians diestimasi SEKALI pada model nol dengan REML, lalu dipakai
untuk menguji setiap SNP (pendekatan P3D/EMMAX, sama dengan cara cepat yang
dipakai GAPIT). Cocok untuk bawang putih yang banyak memiliki klon/kerabat dekat.
"""
from dataclasses import dataclass

import numpy as np
from scipy import optimize

from pipeline.gwas.glm import GLMResult, ols_scan, prepare
from pipeline.pca.pca import standardize


@dataclass
class VarianceComponents:
    delta: float          # s2e / s2g
    var_genetik: float    # s2g
    var_galat: float      # s2e
    heritabilitas: float  # pseudo-heritabilitas = s2g / (s2g + s2e)

    def as_dict(self) -> dict:
        return {k: round(float(v), 6) for k, v in self.__dict__.items()}


def vanraden_kinship(g: np.ndarray) -> np.ndarray:
    z = standardize(g)
    return z @ z.T / z.shape[1]


def _reml(log_delta: float, lam: np.ndarray, ys: np.ndarray, cs: np.ndarray) -> float:
    """Log-likelihood REML (Kang dkk. 2008) pada data yang sudah dirotasi eigen."""
    d = np.exp(log_delta)
    w = 1.0 / (lam + d)
    ctw = cs.T * w
    a = ctw @ cs
    beta = np.linalg.solve(a, ctw @ ys)
    r = ys - cs @ beta
    rss = float((w * r * r).sum())
    n, p = cs.shape
    nmp = n - p
    _, logdet_a = np.linalg.slogdet(a)
    return 0.5 * (nmp * np.log(nmp / (2 * np.pi)) - nmp - np.log(lam + d).sum()
                  - logdet_a - nmp * np.log(rss))


def estimate_delta(lam: np.ndarray, ys: np.ndarray, cs: np.ndarray) -> float:
    grid = np.linspace(-10, 10, 101)
    ll = np.array([_reml(x, lam, ys, cs) for x in grid])
    best = grid[int(np.nanargmax(ll))]
    res = optimize.minimize_scalar(lambda x: -_reml(x, lam, ys, cs),
                                   bounds=(best - 0.2, best + 0.2), method="bounded")
    return float(np.exp(res.x if res.success else best))


def run_mlm(y: np.ndarray, g: np.ndarray, covariates: np.ndarray | None = None
            ) -> tuple[GLMResult, VarianceComponents]:
    y, g, c = prepare(y, g, covariates)
    k = vanraden_kinship(g)
    lam, u = np.linalg.eigh(k)
    lam = np.clip(lam, 0, None)
    ys, cs, gs = u.T @ y, u.T @ c, u.T @ g

    delta = estimate_delta(lam, ys, cs)
    w = 1.0 / (lam + delta)
    sw = np.sqrt(w)

    # komponen varians pada model nol
    ctw = cs.T * w
    beta0 = np.linalg.solve(ctw @ cs, ctw @ ys)
    r = ys - cs @ beta0
    var_g = float((w * r * r).sum() / (len(y) - cs.shape[1]))
    var_e = delta * var_g
    vc = VarianceComponents(delta=delta, var_genetik=var_g, var_galat=var_e,
                            heritabilitas=1.0 / (1.0 + delta))

    result = ols_scan(sw * ys, sw[:, None] * gs, sw[:, None] * cs)
    return result, vc
