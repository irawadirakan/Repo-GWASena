"""Uji ekspor Manhattan plot dan QQ plot ke PNG (FR-09, AC-09.1)."""
import subprocess
import sys
from pathlib import Path

from pipeline.runner import run_pipeline
from pipeline.visualization import manhattan_png, qq_png

DATA = Path(__file__).resolve().parents[1] / "data" / "contoh"
VCF = DATA / "genotipe_bawang_putih_mini.vcf"
CSV = DATA / "fenotipe_bawang_putih_mini.csv"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _plot_data():
    return run_pipeline(VCF, CSV, {"trait": "bobot_umbi_g", "model": "GLM"})["plot"]


def test_manhattan_dan_qq_menghasilkan_png():
    plot = _plot_data()
    m = manhattan_png(plot["manhattan"], "Manhattan plot - bobot_umbi_g (GLM)")
    q = qq_png(plot["qq"], "QQ plot - bobot_umbi_g (GLM)")
    assert m.startswith(PNG_SIGNATURE) and len(m) > 10_000
    assert q.startswith(PNG_SIGNATURE) and len(q) > 5_000


def test_png_tetap_dibuat_tanpa_snp_signifikan():
    data = {"titik": [{"snp_id": "s1", "chromosome": "chr1", "position": 100, "neglog10p": 0.5,
                       "signifikan": False}], "garis_bonferroni": None}
    assert manhattan_png(data).startswith(PNG_SIGNATURE)


def test_endpoint_png():
    from fastapi.testclient import TestClient

    from backend.main import app
    from tests.test_alur_utama import _login, _upload

    with TestClient(app) as c:
        h = _login(c, "penguji_png")
        aid = c.post("/api/analyses", json={"analysis_name": "Uji PNG"}, headers=h).json()["analysis_id"]
        assert _upload(c, aid, h).status_code == 200
        assert c.put(f"/api/analyses/{aid}/parameters", json={"trait": "bobot_umbi_g"},
                     headers=h).status_code == 200

        # sebelum analisis dijalankan: 409
        assert c.get(f"/api/analyses/{aid}/plots/manhattan/png", headers=h).status_code == 409

        assert c.post(f"/api/analyses/{aid}/run", headers=h).status_code == 202
        for jenis in ("manhattan", "qq"):
            r = c.get(f"/api/analyses/{aid}/plots/{jenis}/png", headers=h)
            assert r.status_code == 200, r.text
            assert r.headers["content-type"] == "image/png"
            assert f"gwasena_sesi{aid}_{jenis}.png" in r.headers["content-disposition"]
            assert r.content.startswith(PNG_SIGNATURE)
            # permintaan kedua memakai berkas PNG yang sudah disimpan
            assert c.get(f"/api/analyses/{aid}/plots/{jenis}/png", headers=h).content == r.content

        # PCA tidak tersedia sebagai PNG
        assert c.get(f"/api/analyses/{aid}/plots/pca/png", headers=h).status_code == 404


def test_backend_menyala_tanpa_memuat_matplotlib():
    """Backend tidak boleh gagal menyala hanya karena matplotlib belum terpasang."""
    root = Path(__file__).resolve().parents[1]
    kode = "import sys, backend.main; print('matplotlib' in sys.modules)"
    out = subprocess.run([sys.executable, "-c", kode], cwd=root, capture_output=True, text=True)
    assert out.returncode == 0, out.stderr
    assert out.stdout.strip() == "False"


def test_lead_snp_filtering_prevents_overlap():
    from pipeline.visualization.png import select_lead_snps_for_labels

    # 8 SNP signifikan berdekatan pada Chr 1 + beberapa puncak di kromosom jauh lainnya
    clustered = [
        {"snp_id": f"rs10{i}", "chromosome": "1", "position": 1_000_000 + i * 500, "neglog10p": 6.0 + i * 0.2, "signifikan": True}
        for i in range(8)
    ]
    peaks_other = [
        {"snp_id": "rs200", "chromosome": "2", "position": 500_000, "neglog10p": 7.1, "signifikan": True},
        {"snp_id": "rs400", "chromosome": "4", "position": 500_000, "neglog10p": 8.2, "signifikan": True},
        {"snp_id": "rs600", "chromosome": "6", "position": 500_000, "neglog10p": 7.5, "signifikan": True},
        {"snp_id": "rs800", "chromosome": "8", "position": 500_000, "neglog10p": 6.8, "signifikan": True},
        {"snp_id": "rs1000", "chromosome": "10", "position": 500_000, "neglog10p": 6.5, "signifikan": True},
    ]
    all_pts = clustered + peaks_other
    offset = {"1": 0, "2": 2_000_000, "4": 6_000_000, "6": 10_000_000, "8": 14_000_000, "10": 18_000_000}
    total_span = 20_000_000

    selected = select_lead_snps_for_labels(all_pts, offset, total_span, max_labels=5, min_rel_spacing=0.12)
    assert len(selected) <= 5
    chr1_labels = [s["snp_id"] for s in selected if s["chromosome"] == "1"]
    assert chr1_labels == ["rs107"]
    xs = sorted(offset[s["chromosome"]] + s["position"] for s in selected)
    assert all((xs[i + 1] - xs[i]) > 0.12 * total_span for i in range(len(xs) - 1))

    png_bytes = manhattan_png({"titik": all_pts, "garis_bonferroni": 5.0}, "Manhattan plot - CD8 (MLM)")
    assert png_bytes.startswith(PNG_SIGNATURE)
