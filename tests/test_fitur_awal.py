"""Uji fitur awal: daftar, login, buat analisis, unggah dan validasi, kontrol akses."""
from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import app

DATA = Path(__file__).resolve().parents[1] / "data" / "contoh"
VCF = DATA / "genotipe_bawang_putih_mini.vcf"
CSV = DATA / "fenotipe_bawang_putih_mini.csv"
CSV_SALAH = DATA / "fenotipe_id_tidak_cocok.csv"


def _login(client, username):
    client.post("/api/auth/register",
                json={"username": username, "email": f"{username}@contoh.id", "password": "rahasia123"})
    r = client.post("/api/auth/login", json={"username": username, "password": "rahasia123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _upload(client, aid, headers, csv_path=CSV, vcf_path=VCF):
    with open(vcf_path, "rb") as g, open(csv_path, "rb") as p:
        return client.post(f"/api/analyses/{aid}/upload", headers=headers,
                           files={"genotipe": (vcf_path.name, g, "text/plain"),
                                  "fenotipe": (csv_path.name, p, "text/csv")})


def test_daftar_login_dan_profil():
    with TestClient(app) as c:
        h = _login(c, "pengguna1")
        me = c.get("/api/auth/me", headers=h).json()
        assert me["username"] == "pengguna1"
        r = c.post("/api/auth/register",
                   json={"username": "pengguna1", "email": "lain@contoh.id", "password": "rahasia123"})
        assert r.status_code == 409


def test_buat_analisis_dan_unggah_berkas():
    with TestClient(app) as c:
        h = _login(c, "pengguna2")
        aid = c.post("/api/analyses", json={"analysis_name": "GWAS bobot umbi"},
                     headers=h).json()["analysis_id"]

        r = _upload(c, aid, h)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["genotipe"]["jumlah_sampel"] == 40
        assert body["genotipe"]["jumlah_snp"] == 500
        assert "bobot_umbi_g" in body["fenotipe"]["sifat_tersedia"]

        daftar = c.get("/api/analyses", headers=h).json()
        assert daftar[0]["analysis_id"] == aid
        assert daftar[0]["status"] == "tervalidasi"

        detail = c.get(f"/api/analyses/{aid}", headers=h).json()
        assert len(detail["berkas"]) == 2
        assert "jumlah_siung" in detail["sifat_tersedia"]


def test_id_sampel_tidak_cocok_ditolak():
    with TestClient(app) as c:
        h = _login(c, "pengguna3")
        aid = c.post("/api/analyses", json={"analysis_name": "Uji ID"}, headers=h).json()["analysis_id"]
        r = _upload(c, aid, h, CSV_SALAH)
        assert r.status_code == 422
        detail = r.json()["detail"]
        assert "tidak cocok" in detail["pesan"]
        assert any("BP038" in x for x in detail["rincian"])


def test_format_berkas_salah_ditolak():
    with TestClient(app) as c:
        h = _login(c, "pengguna4")
        aid = c.post("/api/analyses", json={"analysis_name": "Uji format"}, headers=h).json()["analysis_id"]
        r = _upload(c, aid, h, CSV, vcf_path=CSV)
        assert r.status_code == 422


def test_kontrol_akses():
    with TestClient(app) as c:
        assert c.get("/api/analyses").status_code == 401
        h1 = _login(c, "pemilik")
        h2 = _login(c, "lainnya")
        aid = c.post("/api/analyses", json={"analysis_name": "Milik pemilik"},
                     headers=h1).json()["analysis_id"]
        assert c.get(f"/api/analyses/{aid}", headers=h2).status_code == 403
        assert c.post("/api/auth/login",
                      json={"username": "pemilik", "password": "salah-sandi"}).status_code == 401
