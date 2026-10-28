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
