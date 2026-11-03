"""Uji fitur autentikasi Google OAuth (FR-01): login, auto-register, dan token JWT."""
import base64
import json
from fastapi.testclient import TestClient

from backend.main import app


def test_google_auto_register_and_login():
    with TestClient(app) as c:
        # 1. User baru mendaftar otomatis via Google (email & name)
        r = c.post(
            "/api/auth/google",
            json={
                "email": "budi.santoso@apps.ipb.ac.id",
                "name": "Dr. Budi Santoso",
                "google_sub": "google-sub-12345",
            },
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["pengguna"]["email"] == "budi.santoso@apps.ipb.ac.id"
        assert "budi" in data["pengguna"]["username"]

        token = data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Token valid untuk mengakses /api/auth/me
        me = c.get("/api/auth/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["email"] == "budi.santoso@apps.ipb.ac.id"

        # 3. User yang sama login kembali via Google -> berhasil login tanpa duplikasi
        r2 = c.post(
            "/api/auth/google",
            json={
                "email": "budi.santoso@apps.ipb.ac.id",
                "name": "Dr. Budi Santoso",
            },
        )
        assert r2.status_code == 200
        assert r2.json()["pengguna"]["user_id"] == data["pengguna"]["user_id"]


def test_google_auth_with_jwt_credential():
    with TestClient(app) as c:
        # Buat dummy Google ID Token JWT
        header_b64 = base64.urlsafe_b64encode(b'{"alg":"RS256","typ":"JWT"}').decode().rstrip("=")
        payload = {
            "iss": "https://accounts.google.com",
            "sub": "google-user-9988",
            "email": "researcher.gwas@gmail.com",
            "name": "Peneliti GWAS",
            "email_verified": True,
        }
        payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
        sig_b64 = base64.urlsafe_b64encode(b"dummysignature").decode().rstrip("=")
        dummy_credential = f"{header_b64}.{payload_b64}.{sig_b64}"

        r = c.post("/api/auth/google", json={"credential": dummy_credential})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["pengguna"]["email"] == "researcher.gwas@gmail.com"
        assert "access_token" in data


def test_google_auth_missing_email_raises_400():
    with TestClient(app) as c:
        r = c.post("/api/auth/google", json={})
        assert r.status_code == 400
