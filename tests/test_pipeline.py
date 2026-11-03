"""Uji modul pipeline secara langsung (tanpa API dan basis data)."""
from pathlib import Path

import numpy as np
import pytest

from pipeline.errors import PipelineError, ValidationError
from pipeline.gwas import benjamini_hochberg, bonferroni
from pipeline.runner import run_pipeline
from pipeline.validation import read_phenotype_csv, read_vcf

DATA = Path(__file__).resolve().parents[1] / "data" / "contoh"
VCF = DATA / "genotipe_bawang_putih_mini.vcf"
CSV = DATA / "fenotipe_bawang_putih_mini.csv"


def test_baca_vcf_dan_csv():
    g = read_vcf(VCF)
    p = read_phenotype_csv(CSV)
    assert (g.n_samples, g.n_snps) == (40, 500)
    assert set(p.trait_names) == {"bobot_umbi_g", "diameter_umbi_mm", "jumlah_siung"}


def test_csv_bukan_vcf_ditolak():
    with pytest.raises(ValidationError):
        read_vcf(CSV)


def test_koreksi_multiple_testing():
    p = np.array([0.01, 0.04, 0.03, 0.005])
    assert np.allclose(bonferroni(p), [0.04, 0.16, 0.12, 0.02])
    assert np.allclose(benjamini_hochberg(p), [0.02, 0.04, 0.04, 0.02])


def test_pipeline_menemukan_snp_berpengaruh():
    tahap = []
    r = run_pipeline(VCF, CSV, {"trait": "bobot_umbi_g"},
                     on_stage=lambda s, st, m=None: tahap.append((s, st)))
    assert ("koreksi", "selesai") in tahap
    assert r["qc"]["sampel_lolos"] == 39
    assert [s["snp_id"] for s in r["snp"] if s["signifikan"]] == ["snp_chr3_0042"]


def test_mlm_menemukan_snp_berpengaruh():
    r = run_pipeline(VCF, CSV, {"trait": "bobot_umbi_g", "model": "MLM"})
    assert [s["snp_id"] for s in r["snp"] if s["signifikan"]] == ["snp_chr3_0042"]
    assert 0 < r["asosiasi"]["komponen_varians"]["heritabilitas"] < 1


def test_mlm_mengendalikan_inflasi_pada_data_klonal():
    """Pada populasi berisi klon, GLM menghasilkan banyak positif palsu; MLM tidak."""
    from pipeline.gwas import run_glm, run_mlm
    from pipeline.runner import genomic_inflation

    rng = np.random.default_rng(1)
    base = rng.binomial(2, 0.3, (10, 300)).astype(float)
    g = np.repeat(base, 4, axis=0)               # 10 keluarga klon x 4 tanaman
    y = np.repeat(rng.normal(0, 2, 10), 4) + rng.normal(0, 1, 40)
    assert genomic_inflation(run_mlm(y, g)[0].p) < genomic_inflation(run_glm(y, g).p)


def test_sifat_tidak_ada_ditolak():
    with pytest.raises(PipelineError):
        run_pipeline(VCF, CSV, {"trait": "tinggi_daun"})
