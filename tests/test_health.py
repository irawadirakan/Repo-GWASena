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
