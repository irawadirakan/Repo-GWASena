"""Uji alur utama UC-01: login -> buat analisis -> unggah -> parameter -> run -> hasil.

Memakai data dummy 40 sampel x 500 SNP; SNP snp_chr3_0042 sengaja dibuat
berpengaruh terhadap bobot umbi sehingga harus terdeteksi signifikan.
"""
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


def _upload(client, aid, headers, csv_path=CSV):
    with open(VCF, "rb") as g, open(csv_path, "rb") as p:
        return client.post(f"/api/analyses/{aid}/upload", headers=headers,
                           files={"genotipe": (VCF.name, g, "text/plain"),
                                  "fenotipe": (csv_path.name, p, "text/csv")})


def test_alur_utama_sampai_hasil():
    with TestClient(app) as c:
        h = _login(c, "penguji1")
        aid = c.post("/api/analyses", json={"analysis_name": "Uji bobot umbi"}, headers=h).json()["analysis_id"]

        r = _upload(c, aid, h)
        assert r.status_code == 200, r.text
        assert r.json()["genotipe"]["jumlah_snp"] == 500
        assert "bobot_umbi_g" in r.json()["fenotipe"]["sifat_tersedia"]

        r = c.put(f"/api/analyses/{aid}/parameters", json={"trait": "bobot_umbi_g"}, headers=h)
        assert r.status_code == 200, r.text

        r = c.post(f"/api/analyses/{aid}/run", headers=h)
        assert r.status_code == 202, r.text

        st = c.get(f"/api/analyses/{aid}/status", headers=h).json()
        assert st["status"] == "selesai", st
        assert st["progres_persen"] == 100

        res = c.get(f"/api/analyses/{aid}/results", headers=h).json()
        assert res["qc"]["sampel_lolos"] == 39
        assert "snp_chr3_0042" in [s["snp_id"] for s in res["snp_signifikan"]]

        r = c.get(f"/api/analyses/{aid}/results/csv", headers=h)
        assert r.status_code == 200
        assert r.text.startswith("Chr,Pos,SNP_ID")

        assert c.get(f"/api/analyses/{aid}/plots/manhattan", headers=h).json()["titik"]

        # jalankan ulang dengan MLM
        r = c.put(f"/api/analyses/{aid}/parameters",
                  json={"trait": "bobot_umbi_g", "model": "MLM"}, headers=h)
        assert r.status_code == 200, r.text
        assert c.post(f"/api/analyses/{aid}/run", headers=h).status_code == 202
        res = c.get(f"/api/analyses/{aid}/results", headers=h).json()
        assert res["model"] == "MLM"
        assert res["asosiasi"]["komponen_varians"]["heritabilitas"] > 0


def test_id_sampel_tidak_cocok_ditolak():
    with TestClient(app) as c:
        h = _login(c, "penguji2")
        aid = c.post("/api/analyses", json={"analysis_name": "Uji ID"}, headers=h).json()["analysis_id"]
        r = _upload(c, aid, h, CSV_SALAH)
        assert r.status_code == 422
        detail = r.json()["detail"]
        assert "tidak cocok" in detail["pesan"]
        assert any("BP038" in x for x in detail["rincian"])
        r = c.post(f"/api/analyses/{aid}/run", headers=h)
        assert r.status_code == 409


def test_kontrol_akses():
    with TestClient(app) as c:
        assert c.get("/api/analyses").status_code == 401
        h1 = _login(c, "pemilik")
        h2 = _login(c, "lainnya")
        aid = c.post("/api/analyses", json={"analysis_name": "Milik pemilik"}, headers=h1).json()["analysis_id"]
        assert c.get(f"/api/analyses/{aid}", headers=h2).status_code == 403
        assert c.post("/api/auth/login",
                      json={"username": "pemilik", "password": "salah-sandi"}).status_code == 401
