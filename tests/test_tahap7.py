"""Uji perbaikan tahap 7: anotasi Ensembl (batas waktu, status, versi genom, cache), dataset contoh,
panel administrator, laporan QC, dan penghapusan dependency demo."""
import csv
import io
import json
import urllib.error
import urllib.request

from fastapi.testclient import TestClient

from backend.main import app
from pipeline.annotation.ensembl import ENSEMBL_GENOMES_REST_URL, ENSEMBL_REST_URL, annotate_with_ensembl
from tests.test_alur_utama import _login, _upload

SNPS = [{"snp_id": f"rs{i}", "chromosome": "1", "position": 3_000_000 + i * 200_000, "p_value": 1e-6}
        for i in range(6)]


class _Resp:
    def __init__(self, payload):
        self._b = json.dumps(payload).encode()

    def read(self):
        return self._b

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


GEN = [{"id": "ENSMUSG1", "external_name": "GenA", "start": 3_000_000, "end": 3_001_000, "strand": 1}]


def test_ensembl_versi_genom_dan_berhasil(monkeypatch):
    def fake(req, timeout=5, context=None):
        if "/info/assembly/" in req.full_url:
            return _Resp({"assembly_name": "GRCm39"})
        return _Resp(GEN)

    monkeypatch.setattr(urllib.request, "urlopen", fake)
    r = annotate_with_ensembl(SNPS, "mus_musculus")
    assert r["status"] == "tersedia"
    assert r["versi_genom"] == "GRCm39"
    assert r["jumlah_gagal"] == 0
    assert all(k["status_anotasi"] == "berhasil" for k in r["kandidat"])
    assert "GRCm39" in r["pesan"]


def test_ensembl_spesies_tidak_tersedia(monkeypatch):
    def fake(req, timeout=5, context=None):
        raise urllib.error.HTTPError(req.full_url, 400, "Bad Request", {}, None)

    monkeypatch.setattr(urllib.request, "urlopen", fake)
    r = annotate_with_ensembl(SNPS, "allium_cepa")
    assert r["status"] == "tidak_tersedia"
    assert "tidak tersedia di Ensembl" in r["pesan"]
    assert all(k["status_anotasi"] == "gagal" for k in r["kandidat"])


def test_ensembl_server_genomes_dipakai_untuk_tanaman(monkeypatch):
    urls = []

    def fake(req, timeout=5, context=None):
        urls.append(req.full_url)
        if req.full_url.startswith(ENSEMBL_REST_URL):
            raise urllib.error.HTTPError(req.full_url, 400, "Bad Request", {}, None)
        if "/info/assembly/" in req.full_url:
            return _Resp({"assembly_name": "Zm-B73-REFERENCE-NAM-5.0"})
        return _Resp(GEN)

    monkeypatch.setattr(urllib.request, "urlopen", fake)
    r = annotate_with_ensembl(SNPS, "zea_mays")
    assert r["status"] == "tersedia" and r["versi_genom"] == "Zm-B73-REFERENCE-NAM-5.0"
    # setelah server ditemukan, permintaan wilayah langsung ke Ensembl Genomes (tanpa coba server utama)
    overlap = [u for u in urls if "/overlap/" in u]
    assert overlap and all(u.startswith(ENSEMBL_GENOMES_REST_URL) for u in overlap)


def test_ensembl_berhenti_dini_bila_semua_gagal(monkeypatch):
    calls = {"overlap": 0}

    def fake(req, timeout=5, context=None):
        if "/info/assembly/" in req.full_url:
            return _Resp({"assembly_name": "GRCm39"})
        calls["overlap"] += 1
        raise urllib.error.URLError("timeout")

    monkeypatch.setattr(urllib.request, "urlopen", fake)
    many = [{"snp_id": f"x{i}", "chromosome": "2", "position": 1_000_000 + i * 300_000} for i in range(40)]
    r = annotate_with_ensembl(many, "mus_musculus", max_workers=1)
    assert r["status"] == "tidak_tersedia"
    assert calls["overlap"] <= 4  # berhenti setelah 3 kegagalan berturut-turut


def test_ensembl_sebagian_gagal_ditandai(monkeypatch):
    def fake(req, timeout=5, context=None):
        if "/info/assembly/" in req.full_url:
            return _Resp({"assembly_name": "GRCm39"})
        if ":3000000-" in req.full_url or ":2950000-" in req.full_url:
            raise urllib.error.URLError("timeout")
        return _Resp(GEN)

    monkeypatch.setattr(urllib.request, "urlopen", fake)
    r = annotate_with_ensembl(SNPS, "mus_musculus", max_workers=1)
    assert r["status"] == "tersedia"
    assert r["jumlah_gagal"] == 1
    assert r["kandidat"][0]["status_anotasi"] == "gagal"
    assert "1 SNP" in r["pesan"]


def _jalankan(c, h, nama):
    aid = c.post("/api/analyses", json={"analysis_name": nama}, headers=h).json()["analysis_id"]
    assert _upload(c, aid, h).status_code == 200
    assert c.put(f"/api/analyses/{aid}/parameters", json={"trait": "bobot_umbi_g"}, headers=h).status_code == 200
    assert c.post(f"/api/analyses/{aid}/run", headers=h).status_code == 202
    assert c.get(f"/api/analyses/{aid}/status", headers=h).json()["status"] == "selesai"
    return aid


def test_anotasi_otomatis_setelah_analisis_dan_cache(monkeypatch):
    monkeypatch.setenv("ANNOTATION_SOURCE", "otomatis")  # pakai GFF3 contoh agar hasilnya pasti
    with TestClient(app) as c:
        h = _login(c, "penguji_tahap7_anotasi")
        aid = _jalankan(c, h, "Uji anotasi otomatis")
        # Kandidat_Gen pada CSV sudah terisi tanpa memanggil endpoint anotasi
        rows = list(csv.DictReader(io.StringIO(
            c.get(f"/api/analyses/{aid}/results/csv?hanya_signifikan=true", headers=h).text)))
        assert rows[0]["SNP_ID"] == "snp_chr3_0042" and rows[0]["Kandidat_Gen"] == "GC3G9001"
        # hasil anotasi teratas diambil dari cache
        r = c.get(f"/api/analyses/{aid}/annotation?sertakan_teratas=true", headers=h).json()
        assert r["dari_cache"] is True and len(r["kandidat"]) >= 10
        r2 = c.get(f"/api/analyses/{aid}/annotation?sertakan_teratas=true&segarkan=true", headers=h).json()
        assert r2["dari_cache"] is False and r2["status"] == "tersedia"


def test_admin_ringkasan_field_antarmuka():
    from backend.core.database import SessionLocal
    from backend.core.security import create_token, hash_password
    from backend.models import User

    with TestClient(app) as c:
        with SessionLocal() as db:
            u = User(username="admin_tahap7", email="admin_tahap7@contoh.id",
                     password_hash=hash_password("rahasia123"), role="administrator")
            db.add(u)
            db.commit()
            db.refresh(u)
            h = {"Authorization": f"Bearer {create_token(u.user_id, u.role)}"}
        r = c.get("/api/admin/ringkasan", headers=h).json()
        for k in ("total_pengguna", "total_analisis", "analisis_aktif", "analisis_selesai", "analisis_gagal"):
            assert isinstance(r[k], int), k
        job = c.get("/api/admin/analyses", headers=h).json()
        assert all("username" in j and "organism" in j for j in job)


def test_laporan_memuat_rasio_qc():
    with TestClient(app) as c:
        h = _login(c, "penguji_tahap7_laporan")
        aid = _jalankan(c, h, "Uji laporan QC")
        html = c.get(f"/api/analyses/{aid}/report", headers=h).text
        assert "39 / 40" in html and "491 / 500" in html


def test_benchmark_memakai_sesi_milik_pengguna():
    with TestClient(app) as c:
        h = _login(c, "penguji_tahap7_bench")
        aid = c.post("/api/analyses", json={"analysis_name": "Sesi saya"}, headers=h).json()["analysis_id"]
        r = c.post("/api/analyses/benchmark", json={"format": "VCF", "analysis_id": aid}, headers=h).json()
        assert r["analysis_id"] == aid and r["sesi_baru"] is False
        # sesi milik orang lain tidak dipakai; dibuatkan sesi baru
        h2 = _login(c, "penguji_tahap7_bench2")
        r2 = c.post("/api/analyses/benchmark", json={"format": "PLINK", "analysis_id": aid}, headers=h2).json()
        assert r2["analysis_id"] != aid and r2["sesi_baru"] is True
        assert c.post("/api/analyses/benchmark", json={"format": "CSV"}, headers=h).status_code == 422
        assert c.post("/api/analyses/benchmark", json={"format": "VCF"}).status_code == 401


def test_dependency_demo_dihapus():
    import backend.api.deps as deps

    assert not hasattr(deps, "get_current_user_or_demo")


def test_deteksi_organisme_kata_utuh():
    from pipeline.annotation import detect_organism_from_dataset

    # "otomatis" tidak boleh terbaca sebagai "tomat"
    r = detect_organism_from_dataset(["Uji anotasi otomatis", "genotipe_bawang_putih_mini.vcf"], ["bobot_umbi_g"])
    assert r["organism"] == "allium_sativum"
    assert detect_organism_from_dataset(["tomat_panel.vcf"])["organism"] == "solanum_lycopersicum"


def test_bawang_putih_bawaan_lewat_ensembl(monkeypatch):
    """Bawaan ANNOTATION_SOURCE=ensembl: bawang putih tidak memakai GFF3 contoh."""
    def fake(req, timeout=5, context=None):
        raise urllib.error.HTTPError(req.full_url, 400, "Bad Request", {}, None)

    monkeypatch.setattr(urllib.request, "urlopen", fake)
    with TestClient(app) as c:
        h = _login(c, "penguji_tahap7_garlic")
        aid = _jalankan(c, h, "Uji bawang putih Ensembl")
        r = c.get(f"/api/analyses/{aid}/annotation", headers=h).json()
        assert r["sumber_tipe"] == "ensembl"
        assert r["status"] == "tidak_tersedia"
        assert "belum tersedia di Ensembl" in r["pesan"]
        assert r["dari_cache"] is False  # hasil gagal tidak disimpan, dicoba lagi lain kali
        rows = list(csv.DictReader(io.StringIO(
            c.get(f"/api/analyses/{aid}/results/csv?hanya_signifikan=true", headers=h).text)))
        assert rows[0]["Kandidat_Gen"] == ""  # tidak terisi gen dari berkas contoh
        assert c.get("/api/health").json()["fitur"]["sumber_anotasi"] == "ensembl"


def test_ensembl_tanpa_internet_cepat_gagal():
    """Bila internet mati, anotasi langsung memberi pesan (tidak menunggu sampai batas waktu)."""
    import time

    t = time.monotonic()
    r = annotate_with_ensembl(SNPS, "zea_mays")
    assert r["status"] == "tidak_tersedia" and "tidak dapat dihubungi" in r["pesan"]
    assert time.monotonic() - t < 2
