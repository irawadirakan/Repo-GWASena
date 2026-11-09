"""Uji penyempurnaan Pertemuan 11: masukan, status proses, pesan berhasil/gagal,
data yang ditampilkan, riwayat (hapus sesi), panel administrator, dan laporan web."""
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.core.database import SessionLocal
from backend.main import app
import pytest

from backend.models import Analysis, AnalysisLog, AnalysisStatus, Sample, User
from backend.services.analysis_runner import recover_stuck_analyses
from pipeline.validation import read_phenotype_csv
from tests.test_alur_utama import CSV, VCF, _login, _upload


def _sesi(c, h, nama="Uji penyempurnaan"):
    r = c.post("/api/analyses", json={"analysis_name": nama}, headers=h)
    assert r.status_code == 201 and r.json()["pesan"]
    return r.json()["analysis_id"]


def _selesai(c, h, nama="Uji selesai", model="GLM"):
    aid = _sesi(c, h, nama)
    assert _upload(c, aid, h).status_code == 200
    assert c.put(f"/api/analyses/{aid}/parameters", json={"trait": "bobot_umbi_g", "model": model},
                 headers=h).status_code == 200
    assert c.post(f"/api/analyses/{aid}/run", headers=h).status_code == 202
    return aid


# ------------------------------------------------------------------ pesan galat validasi
def test_galat_validasi_berbahasa_indonesia():
    with TestClient(app) as c:
        h = _login(c, "uji_pesan")
        aid = _sesi(c, h)
        assert _upload(c, aid, h).status_code == 200
        r = c.put(f"/api/analyses/{aid}/parameters",
                  json={"trait": "bobot_umbi_g", "maf": 0.9, "n_pc": 0, "model": "BLUP", "ambang": 1},
                  headers=h)
        assert r.status_code == 422
        d = r.json()["detail"]
        assert d["pesan"].startswith("Data yang dikirim belum sesuai")
        teks = " ".join(d["rincian"])
        assert "MAF: maksimal 0.5" in teks
        assert "Jumlah PC (n_pc): minimal 1" in teks
        assert "Model: harus salah satu dari" in teks
        assert "ambang: tidak dikenal" in teks


def test_unggah_tanpa_berkas_menyebut_berkas_yang_kurang():
    with TestClient(app) as c:
        h = _login(c, "uji_tanpa_berkas")
        aid = _sesi(c, h)
        with open(CSV, "rb") as p:
            r = c.post(f"/api/analyses/{aid}/upload", headers=h, files={"fenotipe": (CSV.name, p, "text/csv")})
        assert r.status_code == 422
        assert "Berkas genotipe: wajib diunggah." in r.json()["detail"]["rincian"]


# ------------------------------------------------------------------ masukan
def test_csv_desimal_koma_dan_kolom_diabaikan(tmp_path):
    f = tmp_path / "f.csv"
    f.write_text("sample_id;bobot;catatan;konstan\nA;27,1;baik;1\nB;26,6;baik;1\nC;30,2;rusak;1\n")
    p = read_phenotype_csv(f)
    assert list(p.traits) == ["bobot"] and p.traits["bobot"][0] == 27.1
    assert "catatan" in p.ignored and "konstan" in p.ignored


def test_unggah_memberi_peringatan_kolom_diabaikan(tmp_path):
    isi = CSV.read_text().splitlines()
    baru = [isi[0] + ",keterangan"] + [b + ",ok" for b in isi[1:]]
    f = tmp_path / "fenotipe_plus.csv"
    f.write_text("\n".join(baru) + "\n")
    with TestClient(app) as c:
        h = _login(c, "uji_peringatan")
        aid = _sesi(c, h)
        r = _upload(c, aid, h, f)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "keterangan" in body["fenotipe"]["kolom_diabaikan"]
        assert any("keterangan" in w for w in body["peringatan"])
        assert any("kosong pada 1 sampel" in w for w in body["peringatan"])  # BP040 tanpa bobot_umbi_g


def test_sampel_terlalu_sedikit_ditolak_saat_unggah(tmp_path):
    baris = VCF.read_text().splitlines()
    vcf = tmp_path / "kecil.vcf"
    keluar = []
    for b in baris:
        if b.startswith("##"):
            keluar.append(b)
        else:
            keluar.append("\t".join(b.split("\t")[:9 + 5]))
    vcf.write_text("\n".join(keluar) + "\n")
    sampel = [s for s in baris[[i for i, b in enumerate(baris) if b.startswith("#CHROM")][0]].split("\t")[9:14]]
    csv = tmp_path / "kecil.csv"
    csv.write_text("sample_id,bobot_umbi_g\n" + "".join(f"{s},{20 + i}\n" for i, s in enumerate(sampel)))
    with TestClient(app) as c:
        h = _login(c, "uji_sampel_kecil")
        aid = _sesi(c, h)
        with open(vcf, "rb") as g, open(csv, "rb") as p:
            r = c.post(f"/api/analyses/{aid}/upload", headers=h,
                       files={"genotipe": (vcf.name, g, "text/plain"), "fenotipe": (csv.name, p, "text/csv")})
        assert r.status_code == 422
        assert r.json()["detail"]["pesan"] == "Jumlah sampel terlalu sedikit untuk analisis GWAS."
        assert c.get(f"/api/analyses/{aid}/status", headers=h).json()["status"] == "draft"


# ------------------------------------------------------------------ status dan pesan
def test_pesan_status_setiap_tahap():
    with TestClient(app) as c:
        h = _login(c, "uji_status")
        aid = _sesi(c, h)
        st = c.get(f"/api/analyses/{aid}/status", headers=h).json()
        assert st["pesan_status"] == "Berkas belum diunggah." and st["langkah_berikutnya"].endswith("/upload")
        _upload(c, aid, h)
        st = c.get(f"/api/analyses/{aid}/status", headers=h).json()
        assert st["langkah_berikutnya"].endswith("/parameters")
        c.put(f"/api/analyses/{aid}/parameters", json={"trait": "bobot_umbi_g"}, headers=h)
        c.post(f"/api/analyses/{aid}/run", headers=h)
        st = c.get(f"/api/analyses/{aid}/status", headers=h).json()
        assert st["pesan_status"].startswith("Analisis selesai: 1 SNP signifikan")
        assert st["durasi_detik"] is not None and st["langkah_berikutnya"].endswith("/results")
        res = c.get(f"/api/analyses/{aid}/results", headers=h).json()
        assert res["pesan"] == "Ditemukan 1 SNP signifikan."
        titik = c.get(f"/api/analyses/{aid}/plots/manhattan", headers=h).json()["titik"]
        assert {"p_value", "beta"} <= set(titik[0])  # info saat titik diklik (AC-08.2)


def test_pesan_gagal_menyebut_tahap(tmp_path):
    with TestClient(app) as c:
        h = _login(c, "uji_gagal")
        aid = _sesi(c, h)
        _upload(c, aid, h)
        # mind = 0 membuang semua sampel yang punya genotipe hilang -> sampel lolos < 10
        c.put(f"/api/analyses/{aid}/parameters", json={"trait": "bobot_umbi_g", "mind": 0.0}, headers=h)
        c.post(f"/api/analyses/{aid}/run", headers=h)
        st = c.get(f"/api/analyses/{aid}/status", headers=h).json()
        assert st["status"] == "gagal"
        assert st["pesan_status"].startswith("Analisis gagal pada tahap Quality Control")
        assert st["galat"]["rincian"]


def test_analisis_macet_dipulihkan_saat_server_menyala():
    with TestClient(app) as c:
        h = _login(c, "uji_macet")
        aid = _sesi(c, h)
    with SessionLocal() as db:
        db.get(Analysis, aid).status = AnalysisStatus.BERJALAN
        db.commit()
    assert recover_stuck_analyses() >= 1
    with SessionLocal() as db:
        assert db.get(Analysis, aid).status == AnalysisStatus.GAGAL
        log = db.scalars(select(AnalysisLog).where(AnalysisLog.analysis_id == aid)).all()[-1]
        assert "server dimulai ulang" in log.message


# ------------------------------------------------------------------ riwayat
def test_ganti_nama_dan_hapus_sesi():
    with TestClient(app) as c:
        h = _login(c, "uji_hapus")
        lain = _login(c, "uji_hapus_lain")
        aid = _selesai(c, h, "Akan dihapus")
        assert c.patch(f"/api/analyses/{aid}", json={"analysis_name": "  Nama baru "},
                       headers=h).json()["analysis_name"] == "Nama baru"
        assert c.delete(f"/api/analyses/{aid}", headers=lain).status_code == 403
        r = c.delete(f"/api/analyses/{aid}", headers=h)
        assert r.status_code == 200 and "dihapus" in r.json()["pesan"]
        assert c.get(f"/api/analyses/{aid}", headers=h).status_code == 404
        assert aid not in [x["analysis_id"] for x in c.get("/api/analyses", headers=h).json()]


# ------------------------------------------------------------------ administrator
def test_panel_admin_hanya_untuk_administrator():
    with TestClient(app) as c:
        h = _login(c, "uji_bukan_admin")
        assert c.get("/api/admin/users", headers=h).status_code == 403
        with SessionLocal() as db:
            u = db.scalar(select(User).where(User.username == "uji_bukan_admin"))
            u.role = "administrator"
            db.commit()
        _selesai(c, h, "Job admin")
        ring = c.get("/api/admin/ringkasan", headers=h).json()
        assert ring["jumlah_pengguna"] >= 1 and ring["analisis_per_status"]["selesai"] >= 1
        users = c.get("/api/admin/users", headers=h).json()
        assert any(u["username"] == "uji_bukan_admin" and u["jumlah_analisis"] >= 1 for u in users)
        jobs = c.get("/api/admin/analyses?status=selesai", headers=h).json()
        assert jobs and all(j["status"] == "selesai" for j in jobs)
        assert c.get("/api/admin/analyses?status=aktif", headers=h).status_code == 200
        assert c.get("/api/admin/analyses?status=xyz", headers=h).status_code == 422


# ------------------------------------------------------------------ laporan web
def test_laporan_web_lengkap():
    with TestClient(app) as c:
        h = _login(c, "uji_laporan")
        aid = _selesai(c, h, "Uji laporan", "MLM")
        r = c.get(f"/api/analyses/{aid}/report", headers=h)
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/html")
        html = r.text
        for bagian in ("Parameter Analisis", "Quality Control", "PCA", "Uji Asosiasi (MLM)",
                       "Manhattan Plot", "QQ Plot", "SNP Signifikan", "Kandidat Gen", "GC3G9001",
                       "data:image/png;base64", "heritabilitas"):
            assert bagian in html, bagian
        r = c.get(f"/api/analyses/{aid}/report?unduh=true", headers=h)
        assert "attachment" in r.headers["content-disposition"]


def test_health_dan_meta_terkini():
    with TestClient(app) as c:
        fitur = c.get("/api/health").json()["fitur"]
        assert {"ekspor_png", "anotasi_gff3", "login_google", "mode_pipeline"} <= set(fitur)
        modul = {m["id"]: m["status"] for m in c.get("/api/meta").json()["modul"]}
        assert set(modul.values()) == {"berfungsi"}


def test_snp_tanpa_posisi_dilewati(tmp_path):
    """Data asli (mis. mencit HS1940) memuat SNP berposisi -9 yang belum dipetakan."""
    from pipeline.validation import read_genotype
    from pipeline.validation.plink import write_plink

    g = read_genotype(VCF)
    g.pos[0] = -9
    write_plink(g, tmp_path / "x.bed")
    h = read_genotype(tmp_path / "x.bed")
    assert h.n_snps == g.n_snps - 1 and h.skipped == {"posisi_tidak_diketahui": 1}


def test_maf_dan_missing_rate_snp_tersimpan():
    """Kolom snps.maf dan snps.missing_rate terisi dan sesuai hitungan manual."""
    import numpy as np
    from backend.models import SNP
    from pipeline.validation import read_genotype

    with TestClient(app) as c:
        h = _login(c, "uji_maf")
        aid = _selesai(c, h, "Uji MAF")
    g = read_genotype(VCF)
    with SessionLocal() as db:
        snp = db.scalars(select(SNP).where(SNP.analysis_id == aid).order_by(SNP.snp_id)).all()
        sampel = db.scalars(select(Sample).where(Sample.analysis_id == aid).order_by(Sample.sample_id)).all()
    assert len(snp) == g.n_snps and all(s.missing_rate is not None for s in snp)
    lolos = [i for i, s in enumerate(sampel) if s.passed_qc]
    gs = g.dosage[lolos]
    for j in (0, 41, 250):
        f = np.nanmean(gs[:, j]) / 2
        assert snp[j].maf == pytest.approx(min(f, 1 - f), abs=1e-6)
        assert snp[j].missing_rate == pytest.approx(np.isnan(gs[:, j]).mean(), abs=1e-6)
    # SNP yang tersaring karena MAF memang punya MAF < 0,05
    assert all(s.maf < 0.05 or s.missing_rate > 0.1 for s in snp if not s.passed_qc)


def test_role_bawaan_konsisten():
    from backend.models import User

    assert User.__table__.c.role.default.arg == "pengguna_analisis"


def test_swagger_tanpa_keterangan_di_judul():
    """Tampilan /docs hanya menampilkan metode dan alamat endpoint."""
    with TestClient(app) as c:
        paths = c.get("/openapi.json").json()["paths"]
    operasi = [d for o in paths.values() for d in o.values()]
    assert operasi and all("summary" not in d and "description" not in d for d in operasi)
    assert "/api/analyses/{analysis_id}/run" in paths
