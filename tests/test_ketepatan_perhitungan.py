"""Uji ketepatan perhitungan (AC-03.2, AC-06.1).

Setiap perhitungan pipeline dibandingkan dengan cara hitung kedua yang ditulis
terpisah dan "apa adanya" sesuai definisi rumus (lambat tetapi mudah diperiksa):
  - GLM          vs regresi OLS per SNP dengan numpy.linalg.lstsq dan scipy.stats.linregress
  - MLM          vs generalized least squares (GLS) langsung dengan matriks V = s2g*K + s2e*I
  - REML         vs log-likelihood REML yang dihitung langsung tanpa rotasi eigen
  - Bonferroni, Benjamini-Hochberg, lambda GC, QQ  vs definisi rumus
  - QC (missingness, MAF, HWE, KING)               vs hitungan manual per sampel/SNP
  - PCA                                            vs dekomposisi eigen matriks GRM
"""
import numpy as np
import pytest
from scipy import stats

from pipeline.gwas.correction import benjamini_hochberg, bonferroni
from pipeline.gwas.glm import run_glm
from pipeline.gwas.mlm import _reml, run_mlm, vanraden_kinship
from pipeline.pca.pca import run_pca, standardize
from pipeline.quality_control.qc import QCParams, hwe_pvalues, king_kinship, run_qc
from pipeline.runner import _qq_points, genomic_inflation

RNG = np.random.default_rng(2026)


def _data(n=60, m=40, n_pc=2, missing=0.0):
    p = RNG.uniform(0.1, 0.5, m)
    g = RNG.binomial(2, p, size=(n, m)).astype(float)
    if missing:
        g[RNG.random((n, m)) < missing] = np.nan
    pcs = RNG.normal(size=(n, n_pc))
    y = 1.5 * np.nan_to_num(g[:, 3], nan=1.0) + pcs @ np.ones(n_pc) + RNG.normal(size=n)
    return y, g, pcs


# ------------------------------------------------------------------ GLM
def test_glm_sama_dengan_ols_per_snp():
    y, g, pcs = _data()
    hasil = run_glm(y, g, pcs)
    n = len(y)
    for j in range(g.shape[1]):
        x = np.column_stack([np.ones(n), pcs, g[:, j]])        # intersep + PC + SNP
        koef, rss, *_ = np.linalg.lstsq(x, y, rcond=None)
        df = n - x.shape[1]
        sigma2 = rss[0] / df
        se = np.sqrt(sigma2 * np.linalg.inv(x.T @ x)[-1, -1])
        p = 2 * stats.t.sf(abs(koef[-1] / se), df)
        assert hasil.beta[j] == pytest.approx(koef[-1], rel=1e-9)
        assert hasil.se[j] == pytest.approx(se, rel=1e-9)
        assert hasil.p[j] == pytest.approx(p, rel=1e-7)
    assert hasil.df == n - pcs.shape[1] - 2


def test_glm_tanpa_kovariat_sama_dengan_linregress():
    y, g, _ = _data()
    hasil = run_glm(y, g, None)
    for j in range(g.shape[1]):
        lr = stats.linregress(g[:, j], y)
        assert hasil.beta[j] == pytest.approx(lr.slope, rel=1e-9)
        assert hasil.p[j] == pytest.approx(lr.pvalue, rel=1e-7)


# ------------------------------------------------------------------ MLM
def test_mlm_sama_dengan_gls_langsung():
    y, g, pcs = _data(n=50, m=30)
    hasil, vc = run_mlm(y, g, pcs)
    k = vanraden_kinship(g)
    v = vc.var_genetik * k + vc.var_galat * np.eye(len(y))     # V = s2g*K + s2e*I
    v_inv = np.linalg.inv(v)
    for j in range(g.shape[1]):
        x = np.column_stack([np.ones(len(y)), pcs, g[:, j]])
        xtvx = x.T @ v_inv @ x
        b = np.linalg.solve(xtvx, x.T @ v_inv @ y)            # beta GLS
        r = y - x @ b
        df = len(y) - x.shape[1]
        # skala sigma2 diestimasi ulang per SNP seperti pada pipeline (P3D/EMMAX)
        s2 = (r @ v_inv @ r) / df
        se = np.sqrt(s2 * np.linalg.inv(xtvx)[-1, -1])
        assert hasil.beta[j] == pytest.approx(b[-1], rel=1e-6)
        assert hasil.se[j] == pytest.approx(se, rel=1e-6)
    assert 0 <= vc.heritabilitas <= 1
    assert vc.heritabilitas == pytest.approx(vc.var_genetik / (vc.var_genetik + vc.var_galat))


def test_reml_rotasi_eigen_sama_dengan_rumus_langsung():
    y, g, pcs = _data(n=40, m=30)
    c = np.column_stack([np.ones(len(y)), pcs])
    k = vanraden_kinship(g)
    lam, u = np.linalg.eigh(k)
    lam = np.clip(lam, 0, None)
    for delta in (0.1, 1.0, 5.0):
        cepat = _reml(np.log(delta), lam, u.T @ y, u.T @ c)
        # REML langsung (Kang dkk. 2008, persamaan profil): H = K + delta*I
        h = u @ np.diag(lam + delta) @ u.T
        hi = np.linalg.inv(h)
        a = c.T @ hi @ c
        b = np.linalg.solve(a, c.T @ hi @ y)
        r = y - c @ b
        n, p = c.shape
        nmp = n - p
        langsung = 0.5 * (nmp * np.log(nmp / (2 * np.pi)) - nmp - np.linalg.slogdet(h)[1]
                          - np.linalg.slogdet(a)[1] - nmp * np.log(r @ hi @ r))
        assert cepat == pytest.approx(langsung, rel=1e-8)


# ------------------------------------------------------------------ koreksi & ringkasan
def test_bonferroni_dan_bh_sesuai_definisi():
    p = np.array([0.001, 0.04, 0.03, 0.5, np.nan, 0.0001, 0.2])
    ok = np.isfinite(p)
    m = ok.sum()
    assert np.allclose(bonferroni(p)[ok], np.minimum(p[ok] * m, 1))
    # BH: q_(i) = min_{k>=i} p_(k) * m / k
    pv = p[ok]
    urut = np.argsort(pv)
    q_manual = np.empty(m)
    for posisi, idx in enumerate(urut):
        q_manual[idx] = min(min(pv[urut[k]] * m / (k + 1) for k in range(posisi, m)), 1)
    assert np.allclose(benjamini_hochberg(p)[ok], q_manual)
    assert np.isnan(benjamini_hochberg(p)[4]) and np.isnan(bonferroni(p)[4])


def test_lambda_gc_sesuai_definisi_dan_mendekati_satu_pada_data_nol():
    p = RNG.uniform(size=20_000)
    chi = stats.chi2.isf(p, 1)
    assert genomic_inflation(p) == pytest.approx(np.median(chi) / 0.454936, abs=1e-3)
    assert genomic_inflation(p) == pytest.approx(1.0, abs=0.05)


def test_titik_qq_memakai_kuantil_harapan():
    p = np.array([0.5, 0.01, 0.2, 0.9])
    titik = _qq_points(p)
    harapan = -np.log10((np.arange(1, 5) - 0.5) / 4)
    assert [t["expected"] for t in titik] == pytest.approx(np.round(harapan, 4))
    assert [t["observed"] for t in titik] == pytest.approx(np.round(-np.log10(np.sort(p)), 4))


# ------------------------------------------------------------------ QC
def test_qc_missingness_dan_maf_manual():
    _, g, _ = _data(n=30, m=25, missing=0.05)
    g[0, :12] = np.nan              # sampel 0: 48% hilang -> harus tersaring (mind 0.1)
    g[:, 5] = 0; g[:2, 5] = 1       # SNP 5: MAF kecil -> harus tersaring (maf 0.05)
    hasil = run_qc(g, [f"S{i}" for i in range(30)], QCParams(mind=0.1, geno=0.1, maf=0.05))
    miss_sampel = np.isnan(g).mean(axis=1)
    assert np.array_equal(hasil.sample_mask, miss_sampel <= 0.1)
    gs = g[hasil.sample_mask]
    for j in range(25):
        kolom = gs[:, j][~np.isnan(gs[:, j])]
        miss = np.isnan(gs[:, j]).mean()
        frek = kolom.sum() / (2 * len(kolom))
        lolos = miss <= 0.1 and min(frek, 1 - frek) >= 0.05
        assert hasil.snp_mask[j] == lolos, j
    assert not hasil.snp_mask[5]


def test_hwe_chi_square_manual():
    g = np.array([[0] * 50 + [1] * 20 + [2] * 30]).T.astype(float)   # 50 AA, 20 Aa, 30 aa
    n = 100
    p = (2 * 50 + 20) / (2 * n)
    harapan = np.array([n * p * p, 2 * n * p * (1 - p), n * (1 - p) ** 2])
    chi = (((np.array([50, 20, 30]) - harapan) ** 2) / harapan).sum()
    assert hwe_pvalues(g)[0] == pytest.approx(stats.chi2.sf(chi, 1))


def test_king_robust_manual():
    _, g, _ = _data(n=6, m=200)
    phi = king_kinship(g)
    a, b = g[1], g[4]
    het_het = np.sum((a == 1) & (b == 1))
    ibs0 = np.sum(((a == 0) & (b == 2)) | ((a == 2) & (b == 0)))
    manual = (het_het - 2 * ibs0) / (np.sum(a == 1) + np.sum(b == 1))
    assert phi[1, 4] == pytest.approx(manual)
    # sampel dengan dirinya sendiri (klon identik) bernilai 0,5
    g2 = np.vstack([g[0], g[0]])
    assert king_kinship(g2)[0, 1] == pytest.approx(0.5)


# ------------------------------------------------------------------ PCA
def test_pca_sama_dengan_eigen_grm():
    _, g, _ = _data(n=40, m=60)
    hasil = run_pca(g, 3)
    z = standardize(g)
    nilai, vektor = np.linalg.eigh(z @ z.T)
    urut = np.argsort(nilai)[::-1][:3]
    for k, idx in enumerate(urut):
        skor = vektor[:, idx] * np.sqrt(nilai[idx])
        # tanda vektor eigen bebas (+/-), jadi dibandingkan dengan nilai mutlak korelasi
        assert abs(np.corrcoef(skor, hasil.pcs[:, k])[0, 1]) == pytest.approx(1, abs=1e-9)
        assert np.linalg.norm(hasil.pcs[:, k]) == pytest.approx(np.sqrt(nilai[idx]), rel=1e-9)
    assert hasil.variance_explained[:3] == pytest.approx(nilai[urut] / nilai.sum())
