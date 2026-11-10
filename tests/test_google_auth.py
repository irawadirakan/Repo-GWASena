"""Uji login Google (FR-01, NFR-05): hanya ID token terverifikasi yang diterima.

Pemeriksaan ke server Google diganti tiruan (monkeypatch) agar uji tidak butuh internet.
"""
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.api import auth
from backend.core.config import settings
from backend.main import app

CLIENT_ID = "gwasena-uji.apps.googleusercontent.com"


@pytest.fixture
def google_aktif(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", CLIENT_ID)

    def palsu(credential: str) -> dict:
        if credential == "token-sah-budi":
            return {"aud": CLIENT_ID, "iss": "https://accounts.google.com", "sub": "123",
                    "email": "budi.santoso@apps.ipb.ac.id", "email_verified": "true",
                    "name": "Dr. Budi Santoso"}
        raise HTTPException(401, "Token Google tidak valid atau sudah kedaluwarsa.")

    monkeypatch.setattr(auth, "verify_google_credential", palsu)


def test_token_sah_mendaftar_lalu_masuk_lagi_tanpa_duplikasi(google_aktif):
    with TestClient(app) as c:
        r = c.post("/api/auth/google", json={"credential": "token-sah-budi"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["pengguna"]["email"] == "budi.santoso@apps.ipb.ac.id"
        me = c.get("/api/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"})
        assert me.status_code == 200
        r2 = c.post("/api/auth/google", json={"credential": "token-sah-budi"})
        assert r2.json()["pengguna"]["user_id"] == data["pengguna"]["user_id"]


def test_email_saja_tanpa_token_ditolak(google_aktif):
    """Celah lama: mengirim email admin tanpa token membuat siapa pun bisa masuk sebagai admin."""
    with TestClient(app) as c:
        r = c.post("/api/auth/google", json={"email": "admin@gwasena.local", "name": "Penyusup"})
        assert r.status_code == 400


def test_token_palsu_ditolak(google_aktif):
    with TestClient(app) as c:
        r = c.post("/api/auth/google", json={"credential": "aaa.bbb.ccc"})
        assert r.status_code == 401


def test_login_google_mati_bila_client_id_kosong(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    with TestClient(app) as c:
        r = c.post("/api/auth/google", json={"credential": "apa-saja"})
        assert r.status_code == 503


def test_klaim_untuk_aplikasi_lain_ditolak(monkeypatch):
    """aud harus sama dengan GOOGLE_CLIENT_ID; token untuk aplikasi lain tidak boleh dipakai."""
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", CLIENT_ID)

    class Resp:
        def __init__(self, body):
            self.body = body

        def read(self):
            return self.body

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    import json
    klaim = {"aud": "aplikasi-lain", "iss": "accounts.google.com",
             "email": "x@gmail.com", "email_verified": "true"}
    monkeypatch.setattr(auth.urllib.request, "urlopen",
                        lambda url, timeout=10: Resp(json.dumps(klaim).encode()))
    with pytest.raises(HTTPException) as exc:
        auth.verify_google_credential("token")
    assert exc.value.status_code == 401
