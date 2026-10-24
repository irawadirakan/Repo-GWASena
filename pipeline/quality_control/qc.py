"""Penyaringan sampel dan SNP berdasarkan missingness, MAF, HWE, dan kekerabatan.

Urutan mengikuti praktik umum PLINK:
  1. missingness sampel (--mind)   2. missingness SNP (--geno)
  3. MAF (--maf)                    4. HWE (--hwe, opsional)
  5. kekerabatan KING (--king-cutoff, opsional)
"""
from dataclasses import dataclass, field

import numpy as np
from scipy import stats


@dataclass
class QCParams:
    mind: float = 0.1          # maks. proporsi genotipe hilang per sampel
    geno: float = 0.1          # maks. proporsi genotipe hilang per SNP
    maf: float = 0.05          # min. frekuensi alel minor
    hwe: float | None = None   # ambang p-value HWE; None = tidak difilter
    king_cutoff: float | None = None  # ambang kinship KING; None = tidak difilter


@dataclass
class QCResult:
    sample_mask: np.ndarray            # True = sampel lolos
    snp_mask: np.ndarray               # True = SNP lolos
    summary: list[dict] = field(default_factory=list)  # baris tabel ringkasan QC
    removed_samples: dict = field(default_factory=dict)  # kriteria -> daftar ID

    def as_dict(self, n_samples: int, n_snps: int) -> dict:
        return {
            "sampel_awal": n_samples,
            "snp_awal": n_snps,
            "sampel_lolos": int(self.sample_mask.sum()),
            "snp_lolos": int(self.snp_mask.sum()),
            "kriteria": self.summary,
            "sampel_tersaring": self.removed_samples,
        }


def _maf(g: np.ndarray) -> np.ndarray:
    with np.errstate(invalid="ignore", divide="ignore"):
        p = np.nanmean(g, axis=0) / 2.0
    return np.minimum(p, 1 - p)


def hwe_pvalues(g: np.ndarray) -> np.ndarray:
    """Uji Hardy-Weinberg chi-square (df=1) per SNP."""
    n_aa = np.sum(g == 0, axis=0).astype(float)
    n_ab = np.sum(g == 1, axis=0).astype(float)
    n_bb = np.sum(g == 2, axis=0).astype(float)
    n = n_aa + n_ab + n_bb
    with np.errstate(invalid="ignore", divide="ignore"):
        p = (2 * n_aa + n_ab) / (2 * n)
        q = 1 - p
        exp = np.vstack([n * p * p, 2 * n * p * q, n * q * q])
        obs = np.vstack([n_aa, n_ab, n_bb])
        chi = np.nansum(np.where(exp > 0, (obs - exp) ** 2 / exp, 0.0), axis=0)
    pv = stats.chi2.sf(chi, df=1)
    pv[(n == 0) | (p <= 0) | (p >= 1)] = 1.0
    return pv


def king_kinship(g: np.ndarray) -> np.ndarray:
    """Koefisien kinship KING-robust antar pasangan sampel (matriks n x n)."""
    n = g.shape[0]
    het = (g == 1).astype(float)
    hom0 = (g == 0).astype(float)
    hom2 = (g == 2).astype(float)
    valid = (~np.isnan(g)).astype(float)
    het_both = het @ het.T
    opp_hom = hom0 @ hom2.T + hom2 @ hom0.T
    # hitung heterozigot hanya pada SNP yang teramati di kedua sampel
    het_i = het @ valid.T
    het_j = valid @ het.T
    with np.errstate(invalid="ignore", divide="ignore"):
        phi = (het_both - 2 * opp_hom) / (het_i + het_j)
    np.fill_diagonal(phi, 0.5)
    return np.nan_to_num(phi, nan=0.0)


def run_qc(g: np.ndarray, sample_ids: list[str], params: QCParams) -> QCResult:
    n, m = g.shape
    s_mask = np.ones(n, dtype=bool)
    v_mask = np.ones(m, dtype=bool)
    summary: list[dict] = []
    removed: dict[str, list[str]] = {}

    # 1. missingness per sampel
    miss_s = np.isnan(g).mean(axis=1)
    bad = s_mask & (miss_s > params.mind)
    s_mask &= ~bad
    removed["missingness"] = [sample_ids[i] for i in np.flatnonzero(bad)]
    summary.append({"kriteria": "Missingness", "ambang": params.mind,
                    "sampel_tersaring": int(bad.sum()), "snp_tersaring": None})

    # 2. missingness per SNP (dihitung pada sampel yang tersisa)
    miss_v = np.isnan(g[s_mask]).mean(axis=0) if s_mask.any() else np.ones(m)
    bad_v = v_mask & (miss_v > params.geno)
    v_mask &= ~bad_v
    summary[-1]["snp_tersaring"] = int(bad_v.sum())

    # 3. MAF
    maf = _maf(g[np.ix_(s_mask, v_mask)]) if s_mask.any() and v_mask.any() else np.array([])
    bad_v = np.zeros(m, dtype=bool)
    idx = np.flatnonzero(v_mask)
    bad_v[idx] = ~(np.nan_to_num(maf, nan=0.0) >= params.maf)
    v_mask &= ~bad_v
    summary.append({"kriteria": "MAF", "ambang": params.maf,
                    "sampel_tersaring": 0, "snp_tersaring": int(bad_v.sum())})

    # 4. HWE (opsional)
    n_hwe = 0
    if params.hwe is not None and v_mask.any():
        pv = hwe_pvalues(g[np.ix_(s_mask, v_mask)])
        bad_v = np.zeros(m, dtype=bool)
        bad_v[np.flatnonzero(v_mask)] = pv < params.hwe
        v_mask &= ~bad_v
        n_hwe = int(bad_v.sum())
    summary.append({"kriteria": "HWE", "ambang": params.hwe,
                    "sampel_tersaring": 0, "snp_tersaring": n_hwe,
                    "keterangan": None if params.hwe is not None else "tidak difilter"})

    # 5. kekerabatan (opsional): buang satu sampel dari setiap pasangan terlalu dekat
    n_rel = 0
    removed["relatedness"] = []
    if params.king_cutoff is not None and s_mask.sum() > 1 and v_mask.any():
        keep_idx = np.flatnonzero(s_mask)
        phi = king_kinship(g[np.ix_(keep_idx, np.flatnonzero(v_mask))])
        np.fill_diagonal(phi, 0)
        dropped = set()
        for a in range(len(keep_idx)):
            if a in dropped:
                continue
            for b in range(a + 1, len(keep_idx)):
                if b not in dropped and phi[a, b] > params.king_cutoff:
                    dropped.add(b)
        for b in dropped:
            s_mask[keep_idx[b]] = False
            removed["relatedness"].append(sample_ids[keep_idx[b]])
        n_rel = len(dropped)
    summary.append({"kriteria": "Relatedness", "ambang": params.king_cutoff,
                    "sampel_tersaring": n_rel, "snp_tersaring": 0,
                    "keterangan": None if params.king_cutoff is not None else "tidak difilter"})

    summary.append({"kriteria": "Total tersaring", "ambang": None,
                    "sampel_tersaring": int(n - s_mask.sum()), "snp_tersaring": int(m - v_mask.sum())})
    summary.append({"kriteria": "Total lolos QC", "ambang": None,
                    "sampel_tersaring": int(s_mask.sum()), "snp_tersaring": int(v_mask.sum()),
                    "keterangan": "jumlah sampel dan SNP yang lolos"})
    return QCResult(sample_mask=s_mask, snp_mask=v_mask, summary=summary,
                    removed_samples={k: v for k, v in removed.items() if v})
