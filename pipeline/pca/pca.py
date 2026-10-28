"""PCA pada matriks genotipe terstandardisasi (setara pendekatan PLINK --pca)."""
from dataclasses import dataclass

import numpy as np


@dataclass
class PCAResult:
    pcs: np.ndarray                 # (n_sampel, k)
    variance_explained: np.ndarray  # proporsi variansi per PC

    def as_dict(self, sample_ids: list[str]) -> dict:
        return {
            "jumlah_pc": int(self.pcs.shape[1]),
            "variansi_dijelaskan": [round(float(v), 4) for v in self.variance_explained],
            "titik": [
                {"sample_id": sid, **{f"PC{j + 1}": round(float(self.pcs[i, j]), 5)
                                       for j in range(self.pcs.shape[1])}}
                for i, sid in enumerate(sample_ids)
            ],
        }


def standardize(g: np.ndarray) -> np.ndarray:
    """Imputasi rata-rata untuk data hilang lalu standardisasi per SNP."""
    mean = np.nanmean(g, axis=0)
    filled = np.where(np.isnan(g), mean, g)
    p = mean / 2.0
    sd = np.sqrt(2 * p * (1 - p))
    sd[sd == 0] = 1.0
    return (filled - mean) / sd


def run_pca(g: np.ndarray, n_pc: int) -> PCAResult:
    n, m = g.shape
    k = max(0, min(n_pc, n - 1, m))
    if k == 0:
        return PCAResult(pcs=np.zeros((n, 0)), variance_explained=np.zeros(0))
    z = standardize(g)
    u, s, _ = np.linalg.svd(z, full_matrices=False)
    var = s ** 2
    total = var.sum() if var.sum() > 0 else 1.0
    return PCAResult(pcs=u[:, :k] * s[:k], variance_explained=var[:k] / total)
