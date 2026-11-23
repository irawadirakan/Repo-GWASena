"""
Uji asap (smoke test): memastikan kerangka backend bisa menyala dan membuat tabel.
Memakai SQLite sementara (lihat conftest.py) agar bisa jalan tanpa PostgreSQL.
Jalankan dari root repositori:  pytest -v
"""
from fastapi.testclient import TestClient

from backend.main import app

EXPECTED_TABLES = {
    "users", "analyses", "datasets", "samples", "snps", "genotypes", "phenotypes",
    "analysis_parameters", "analysis_models", "association_results",
    "visualization_results", "analysis_logs",
}


def test_health_database_ok():
    with TestClient(app) as client:
        body = client.get("/api/health").json()
        assert body["components"]["api"]["ok"] is True
        assert body["components"]["database"]["ok"] is True
        assert EXPECTED_TABLES.issubset(set(body["components"]["database"]["tables"]))


def test_models_seeded():
    with TestClient(app) as client:
        names = {m["model_name"] for m in client.get("/api/analyses/models").json()}
        assert names == {"GLM", "MLM"}


def test_meta_garlic():
    with TestClient(app) as client:
        body = client.get("/api/meta").json()
        assert body["organisme"]["nama_ilmiah"].startswith("Allium sativum")


def test_health_siap_analisis_flag():
    # badge status: bendera siap_analisis true bila DB terhubung (Redis tak wajib di mode non-celery)
    with TestClient(app) as client:
        body = client.get("/api/health").json()
        assert "siap_analisis" in body
        assert body["siap_analisis"] is True


def test_meta_batas_unggah_dan_rentang_qc():
    # /api/meta memuat batas unggah tunggal dan rentang valid parameter QC untuk frontend
    with TestClient(app) as client:
        m = client.get("/api/meta").json()
        assert isinstance(m["batas_unggah_mb"], int) and m["batas_unggah_mb"] > 0
        ids = {p["id"] for p in m["parameter_qc"]}
        assert {"mind", "geno", "maf", "hwe", "king_cutoff", "alpha", "n_pc"} <= ids
        maf = next(p for p in m["parameter_qc"] if p["id"] == "maf")
        assert maf["min"] == 0.0 and maf["max"] == 0.5
