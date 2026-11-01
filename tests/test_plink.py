"""Uji pembaca genotipe format biner PLINK (.bed/.bim/.fam), FR-02.

Data contoh VCF dikonversi ke PLINK biner di dalam tes, lalu hasilnya harus sama
persis dengan membaca VCF secara langsung.
"""
from pathlib import Path

import numpy as np
import pytest

from pipeline.errors import ValidationError
from pipeline.runner import run_pipeline
from pipeline.validation import read_genotype, read_plink, read_vcf, write_plink

DATA = Path(__file__).resolve().parents[1] / "data" / "contoh"
VCF = DATA / "genotipe_bawang_putih_mini.vcf"
CSV = DATA / "fenotipe_bawang_putih_mini.csv"


@pytest.fixture
def bed(tmp_path):
    path = tmp_path / "mini.bed"
    write_plink(read_vcf(VCF), path)
    return path


def test_plink_sama_dengan_vcf(bed):
    v, p = read_vcf(VCF), read_plink(bed)
    assert p.samples == v.samples
    assert (p.chrom, p.pos, p.ids, p.ref, p.alt) == (v.chrom, v.pos, v.ids, v.ref, v.alt)
    assert np.array_equal(np.isnan(p.dosage), np.isnan(v.dosage))
    assert np.allclose(np.nan_to_num(p.dosage, nan=-1), np.nan_to_num(v.dosage, nan=-1))


def test_data_contoh_plink_sama_dengan_vcf():
    """Berkas data/contoh/genotipe_bawang_putih_mini.bed/.bim/.fam untuk dicoba di Swagger."""
    v, p = read_vcf(VCF), read_plink(DATA / "genotipe_bawang_putih_mini.bed")
    assert (p.samples, p.ids) == (v.samples, v.ids)
    assert np.allclose(np.nan_to_num(p.dosage, nan=-1), np.nan_to_num(v.dosage, nan=-1))


def test_read_genotype_memilih_pembaca_dari_ekstensi(bed):
    assert read_genotype(bed).n_snps == read_genotype(VCF).n_snps


def test_hasil_analisis_plink_sama_dengan_vcf(bed):
    params = {"trait": "bobot_umbi_g", "model": "GLM"}
    a, b = run_pipeline(VCF, CSV, params), run_pipeline(bed, CSV, params)
    assert a["qc"]["snp_lolos"] == b["qc"]["snp_lolos"]
    pa = {r["snp_id"]: r["p_value"] for r in a["snp"]}
    pb = {r["snp_id"]: r["p_value"] for r in b["snp"]}
    assert pa.keys() == pb.keys()
    assert all((pa[k] is None and pb[k] is None) or abs(pa[k] - pb[k]) < 1e-12 for k in pa)


def test_bed_rusak_ditolak(bed):
    bed.write_bytes(b"\x00\x00\x00" + bed.read_bytes()[3:])
    with pytest.raises(ValidationError, match="bukan format biner PLINK"):
        read_plink(bed)


def test_ukuran_bed_tidak_cocok_ditolak(bed):
    bed.write_bytes(bed.read_bytes()[:-5])
    with pytest.raises(ValidationError, match="Ukuran berkas .bed"):
        read_plink(bed)


def test_fam_tidak_ada_ditolak(bed):
    bed.with_suffix(".fam").unlink()
    with pytest.raises(ValidationError, match=".fam tidak ditemukan"):
        read_plink(bed)


def test_endpoint_unggah_plink(bed):
    from fastapi.testclient import TestClient

    from backend.main import app
    from tests.test_alur_utama import _login

    bim, fam = bed.with_suffix(".bim"), bed.with_suffix(".fam")
    with TestClient(app) as c:
        h = _login(c, "penguji_plink")
        aid = c.post("/api/analyses", json={"analysis_name": "Uji PLINK"}, headers=h).json()["analysis_id"]

        # .bim dan .fam tidak diunggah -> 422 dengan pesan berkas yang kurang
        with open(bed, "rb") as g, open(CSV, "rb") as p:
            r = c.post(f"/api/analyses/{aid}/upload", headers=h,
                       files={"genotipe": ("mini.bed", g), "fenotipe": (CSV.name, p, "text/csv")})
        assert r.status_code == 422
        assert any(".bim belum diunggah" in x for x in r.json()["detail"]["rincian"])

        with open(bed, "rb") as g, open(bim, "rb") as b, open(fam, "rb") as f, open(CSV, "rb") as p:
            r = c.post(f"/api/analyses/{aid}/upload", headers=h,
                       files={"genotipe": ("mini.bed", g), "bim": ("mini.bim", b),
                              "fam": ("mini.fam", f), "fenotipe": (CSV.name, p, "text/csv")})
        assert r.status_code == 200, r.text
        assert r.json()["genotipe"]["format"] == "PLINK biner"
        assert r.json()["genotipe"]["jumlah_snp"] == 500

        assert c.put(f"/api/analyses/{aid}/parameters", json={"trait": "bobot_umbi_g"},
                     headers=h).status_code == 200
        assert c.post(f"/api/analyses/{aid}/run", headers=h).status_code == 202
        res = c.get(f"/api/analyses/{aid}/results", headers=h).json()
        assert any(s["snp_id"] == "snp_chr3_0042" for s in res["snp_signifikan"])
