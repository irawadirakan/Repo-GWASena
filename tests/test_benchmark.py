import io
import zipfile
from fastapi.testclient import TestClient

from backend.main import app


def _login(client, username):
    client.post(
        "/api/auth/register",
        json={"username": username, "email": f"{username}@contoh.id", "password": "rahasia123"}
    )
    r = client.post("/api/auth/login", json={"username": username, "password": "rahasia123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_load_benchmark_vcf_creates_session_if_null():
    with TestClient(app) as client:
        headers = _login(client, "peneliti_bench1")
        resp = client.post("/api/analyses/benchmark", json={"format": "VCF"}, headers=headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "success"
        assert data["dataset_type"] == "VCF"
        assert "analysis_id" in data
        assert data["validation"]["is_valid"] is True
        assert data["validation"]["sample_count"] == 40
        assert data["validation"]["snp_count"] == 500
        assert data["validation"]["qc_status"].startswith("Lolos validasi")
        assert "fenotipe_bawang_putih_mini.csv" in data["files"]["phenotype"]


def test_load_benchmark_plink_creates_session_if_invalid_id():
    with TestClient(app) as client:
        headers = _login(client, "peneliti_bench2")
        resp = client.post("/api/analyses/benchmark", json={"format": "PLINK", "analysis_id": 999999}, headers=headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "success"
        assert data["dataset_type"] == "PLINK"
        assert data["validation"]["is_valid"] is True
        assert data["validation"]["sample_count"] == 40
        assert data["validation"]["snp_count"] == 500
        assert len(data["files"]["genotype"]) == 3


def test_load_benchmark_dedicated_analysis_endpoint():
    with TestClient(app) as client:
        headers = _login(client, "peneliti_bench3")
        resp = client.post("/api/analyses/12345/load-benchmark", json={"format": "VCF"}, headers=headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "success"
        assert data["validation"]["is_valid"] is True


def test_download_benchmark_zip():
    with TestClient(app) as client:
        resp = client.get("/api/analyses/benchmark/download?format=all")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        names = zf.namelist()
        assert "fenotipe_bawang_putih_mini.csv" in names
        assert "genotipe_bawang_putih_mini.vcf" in names
        assert "genotipe_bawang_putih_mini.bed" in names
