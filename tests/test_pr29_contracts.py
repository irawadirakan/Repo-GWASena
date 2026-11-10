"""Uji kontrak API PR #29: peringatan unggah, status detail, p_value/beta manhattan, ekspor CSV signifikan, laporan HTML, hapus sesi, dan panel admin."""
import io
from pathlib import Path

from fastapi.testclient import TestClient

from backend.core.database import SessionLocal
from backend.core.security import create_token, hash_password
from backend.main import app
from backend.models import User

DATA = Path(__file__).resolve().parents[1] / "data" / "contoh"
VCF = DATA / "genotipe_bawang_putih_mini.vcf"
CSV = DATA / "fenotipe_bawang_putih_mini.csv"


def _login(client, username):
    client.post(
        "/api/auth/register",
        json={"username": username, "email": f"{username}@contoh.id", "password": "rahasia123"},
    )
    r = client.post("/api/auth/login", json={"username": username, "password": "rahasia123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_pr29_upload_peringatan_dan_pipeline_lengkap():
    with TestClient(app) as c:
        h = _login(c, "pr29_tester")
        aid = c.post("/api/analyses", json={"analysis_name": "Uji PR29"}, headers=h).json()["analysis_id"]

        # Buat CSV fenotipe dengan kolom non-numerik tambahan untuk menguji `peringatan`
        csv_lines = CSV.read_text(encoding="utf-8").splitlines()
        modified_csv = "\n".join(
            [csv_lines[0] + ",catatan_teks"] + [line + ",catatan" for line in csv_lines[1:]]
        ).encode("utf-8")

        with open(VCF, "rb") as g:
            r = c.post(
                f"/api/analyses/{aid}/upload",
                headers=h,
                files={
                    "genotipe": (VCF.name, g, "text/plain"),
                    "fenotipe": ("pheno_warn.csv", io.BytesIO(modified_csv), "text/csv"),
                },
            )
        assert r.status_code == 200, r.text
        up = r.json()
        assert "peringatan" in up
        assert any("catatan_teks" in w for w in up["peringatan"]), up["peringatan"]

        # Jalankan analisis
        assert c.put(f"/api/analyses/{aid}/parameters", json={"trait": "bobot_umbi_g"}, headers=h).status_code == 200
        assert c.post(f"/api/analyses/{aid}/run", headers=h).status_code == 202

        # Status detail (pesan_status, durasi_detik, langkah_berikutnya)
        st = c.get(f"/api/analyses/{aid}/status", headers=h).json()
        assert st["status"] == "selesai"
        assert isinstance(st.get("pesan_status"), str) and len(st["pesan_status"]) > 0
        assert isinstance(st.get("durasi_detik"), (int, float))
        assert st.get("langkah_berikutnya") == f"GET /api/analyses/{aid}/results"

        # Manhattan points harus menyertakan p_value & beta
        mplot = c.get(f"/api/analyses/{aid}/plots/manhattan", headers=h).json()
        assert len(mplot["titik"]) > 0
        pt = mplot["titik"][0]
        assert "p_value" in pt
        assert "beta" in pt

        # Ekspor CSV hanya signifikan vs semua
        csv_all = c.get(f"/api/analyses/{aid}/results/csv", headers=h)
        csv_sig = c.get(f"/api/analyses/{aid}/results/csv?hanya_signifikan=true", headers=h)
        assert csv_all.status_code == 200
        assert csv_sig.status_code == 200
        assert len(csv_sig.text.splitlines()) < len(csv_all.text.splitlines())
        assert "snp_chr3_0042" in csv_sig.text

        # Ekspor HTML Report
        rep = c.get(f"/api/analyses/{aid}/report?unduh=true", headers=h)
        assert rep.status_code == 200
        assert "text/html" in rep.headers.get("content-type", "")
        assert "attachment" in rep.headers.get("content-disposition", "")
        assert "Uji PR29" in rep.text
        assert "39 / 40" in rep.text

        # Hapus sesi
        del_res = c.delete(f"/api/analyses/{aid}", headers=h)
        assert del_res.status_code == 200
        assert c.get(f"/api/analyses/{aid}", headers=h).status_code == 404


def test_admin_endpoints():
    with TestClient(app) as c:
        user_headers = _login(c, "regular_user_admin_test")
        # User biasa ditolak (403)
        assert c.get("/api/admin/ringkasan", headers=user_headers).status_code == 403

        # Buat admin langsung di DB untuk testing
        with SessionLocal() as db:
            admin_user = User(
                username="admin_pr29",
                email="admin_pr29@contoh.id",
                password_hash=hash_password("rahasia123"),
                role="administrator",
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            admin_token = create_token(admin_user.user_id, admin_user.role)

        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        r1 = c.get("/api/admin/ringkasan", headers=admin_headers)
        assert r1.status_code == 200
        assert "total_pengguna" in r1.json()
        assert "total_analisis" in r1.json()

        r2 = c.get("/api/admin/users", headers=admin_headers)
        assert r2.status_code == 200
        assert any(u["username"] == "admin_pr29" for u in r2.json())

        r3 = c.get("/api/admin/analyses?status=aktif", headers=admin_headers)
        assert r3.status_code == 200
        assert isinstance(r3.json(), list)
