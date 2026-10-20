"""Uji modul validasi berkas secara langsung (tanpa API dan basis data)."""
from pathlib import Path

import pytest

from pipeline.errors import ValidationError
from pipeline.validation import match_sample_ids, read_phenotype_csv, read_vcf

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


def test_pencocokan_sample_id():
    assert match_sample_ids(["A", "B"], ["B", "A"])["status"] == "cocok"
    with pytest.raises(ValidationError):
        match_sample_ids(["A", "B"], ["A", "C"])
