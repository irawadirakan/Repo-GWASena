"""Uji penyelesaian fitur Pertemuan 10: data yang tersimpan setelah analisis harus
sesuai rancangan (AC-04.2, AC-08.1, FR-07, FR-09) dan Manhattan plot bisa diringkas."""
import csv
import io
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.core.database import SessionLocal
from backend.main import app
from backend.models import SNP, AnalysisParameter, AssociationResult, Sample, VisualizationResult
from pipeline.visualization.downsample import smart_downsample
from tests.test_alur_utama import _login, _upload


def _jalankan(c, h, nama="Uji integrasi"):
    aid = c.post("/api/analyses", json={"analysis_name": nama}, headers=h).json()["analysis_id"]
    assert _upload(c, aid, h).status_code == 200
    r = c.put(f"/api/analyses/{aid}/parameters",
              json={"trait": "bobot_umbi_g", "model": "GLM", "n_pc": 3}, headers=h)
    assert r.status_code == 200, r.text
    assert c.post(f"/api/analyses/{aid}/run", headers=h).status_code == 202
    assert c.get(f"/api/analyses/{aid}/status", headers=h).json()["status"] == "selesai"
    return aid


def test_data_tersimpan_sesuai_rancangan():
    with TestClient(app) as c:
        h = _login(c, "penguji_integrasi")
        aid = _jalankan(c, h)
        with SessionLocal() as db:
            # passed_qc: 1 sampel (missingness tinggi) dan 9 SNP tersaring pada data contoh
            sampel = db.scalars(select(Sample).where(Sample.analysis_id == aid)).all()
            snp = db.scalars(select(SNP).where(SNP.analysis_id == aid)).all()
            assert sum(not s.passed_qc for s in sampel) == 1
            assert sum(s.passed_qc for s in snp) == 491

            # AC-04.2: nilai PC per sampel tersimpan bersama parameter analisis
            param = db.scalar(select(AnalysisParameter).where(AnalysisParameter.analysis_id == aid))
            pca = param.parameter_config["pca_kovariat"]
            assert pca["jumlah_pc"] == 3 and len(pca["nilai_per_sampel"]) == 39

            # AC-08.1: PNG langsung dibuat dan lokasinya dicatat
            for jenis in ("manhattan", "qq"):
                row = db.scalar(select(VisualizationResult).where(
                    VisualizationResult.analysis_id == aid, VisualizationResult.plot_type == jenis))
                assert row.file_path and Path(row.file_path).is_file()


def test_anotasi_mengisi_kolom_candidate_gene():
    with TestClient(app) as c:
        h = _login(c, "penguji_kandidat")
        aid = _jalankan(c, h, "Uji kandidat gen")
        assert c.get(f"/api/analyses/{aid}/annotation", headers=h).status_code == 200
        with SessionLocal() as db:
            res = db.scalar(select(AssociationResult).where(
                AssociationResult.analysis_id == aid, AssociationResult.snp_code == "snp_chr3_0042"))
            assert res.candidate_gene == "GC3G9001"


def test_csv_lengkap_dan_hanya_signifikan():
    with TestClient(app) as c:
        h = _login(c, "penguji_csv")
        aid = _jalankan(c, h, "Uji CSV")
        semua = list(csv.reader(io.StringIO(c.get(f"/api/analyses/{aid}/results/csv", headers=h).text)))
        assert semua[0][-2:] == ["Signifikan", "Kandidat_Gen"]
        assert len(semua) == 1 + 491  # semua SNP yang lolos QC
        diuji = c.get(f"/api/analyses/{aid}/results", headers=h).json()["asosiasi"]["jumlah_snp_diuji"]

        r = c.get(f"/api/analyses/{aid}/results/csv?hanya_signifikan=true", headers=h)
        assert "snp_signifikan" in r.headers["content-disposition"]
        baris = list(csv.reader(io.StringIO(r.text)))
        assert len(baris) == 2 and baris[1][2] == "snp_chr3_0042"
        # P_Bonferroni tetap dihitung dari semua SNP yang diuji, bukan dari 1 baris yang diekspor
        p, p_bonf = float(baris[1][7]), float(baris[1][8])
        assert abs(p_bonf / p - diuji) < 1e-6


def test_endpoint_manhattan_bisa_diringkas():
    with TestClient(app) as c:
        h = _login(c, "penguji_ringkas")
        aid = _jalankan(c, h, "Uji ringkas")
        penuh = c.get(f"/api/analyses/{aid}/plots/manhattan", headers=h).json()
        assert penuh["diringkas"] is False and penuh["jumlah_ditampilkan"] == penuh["jumlah_asli"]
        kecil = c.get(f"/api/analyses/{aid}/plots/manhattan?maks_titik=100", headers=h).json()
        assert kecil["diringkas"] is True and kecil["jumlah_ditampilkan"] <= 110
        assert any(t["snp_id"] == "snp_chr3_0042" for t in kecil["titik"])


def test_downsampling_mempertahankan_titik_penting():
    titik = [{"snp_id": f"s{i}", "chromosome": f"chr{1 + i // 5000}", "position": (i % 5000) * 1000,
              "neglog10p": (i * 7919 % 1000) / 1000, "signifikan": False} for i in range(50_000)]
    titik[12345].update(neglog10p=9.0, signifikan=True)
    titik[40000].update(neglog10p=3.5)
    hasil = smart_downsample(titik, 5_000)
    ids = {t["snp_id"] for t in hasil["titik"]}
    assert hasil["diringkas"] and hasil["jumlah_ditampilkan"] <= 5_000
    assert {"s12345", "s40000"} <= ids
    # urutan kromosom-posisi tetap terjaga
    urut = [int(t["snp_id"][1:]) for t in hasil["titik"]]
    assert urut == sorted(urut)


def test_downsampling_tidak_mengubah_data_kecil():
    titik = [{"snp_id": "a", "chromosome": "chr1", "position": 1, "neglog10p": 1.0, "signifikan": False}]
    assert smart_downsample(titik, 100)["titik"] == titik
