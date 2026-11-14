"""Pengaturan bersama pengujian: SQLite sementara, Redis sengaja tidak tersedia
(pipeline berjalan di latar belakang FastAPI), dan folder unggahan sementara."""
import os
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="gwasena_test_"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_tmp / 'test.db').as_posix()}"
os.environ["REDIS_URL"] = "redis://localhost:6399/0"
os.environ["UPLOAD_DIR"] = str(_tmp / "uploads")
os.environ["PIPELINE_MODE"] = "background"
os.environ["SECRET_KEY"] = "kunci-uji"

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _kosongkan_cache_ensembl():
    """Cache Ensembl di memori dikosongkan tiap uji agar data palsu satu uji tidak terbawa ke uji lain."""
    from pipeline.annotation.ensembl import clear_cache

    clear_cache()
    yield
    clear_cache()


@pytest.fixture(autouse=True)
def _tanpa_internet(monkeypatch):
    """Pengujian tidak boleh bergantung pada Ensembl sungguhan: koneksi keluar ditolak secara bawaan.
    Uji yang membutuhkan respons Ensembl memasang urlopen palsu sendiri (monkeypatch akan menimpanya)."""
    import urllib.error
    import urllib.request

    def _tolak(*a, **k):
        raise urllib.error.URLError("koneksi internet dimatikan saat pengujian")

    monkeypatch.setattr(urllib.request, "urlopen", _tolak)
    monkeypatch.delenv("ANNOTATION_SOURCE", raising=False)
