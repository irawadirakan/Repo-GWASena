"""Uji anotasi gen kandidat dari berkas GFF3 lokal (FR-07, AC-07.1, AC-07.2)."""
from pathlib import Path

from pipeline.annotation import annotate_from_gff3, annotate_snps, read_gff3

DATA = Path(__file__).resolve().parents[1] / "data" / "contoh"
GFF3 = DATA / "anotasi_bawang_putih_contoh.gff3"
SNP_UTAMA = {"snp_id": "snp_chr3_0042", "chromosome": "chr3", "position": 22_560_940, "p_value": 7.6e-13}


def _gff(tmp_path, lines):
    path = tmp_path / "uji.gff3"
    path.write_text("##gff-version 3\n" + "".join(l + "\n" for l in lines), encoding="utf-8")
    return path


def test_gen_tumpang_tindih_ditemukan_dengan_jarak_nol():
    hasil = annotate_from_gff3([SNP_UTAMA], GFF3)
    assert hasil["status"] == "tersedia"
    gen = hasil["kandidat"][0]["gen"]
    assert gen[0]["gene_id"] == "GC3G9001"
    assert gen[0]["jarak_bp"] == 0 and gen[0]["konsekuensi"] == "intragenic_variant"


def test_letak_hulu_dan_hilir_memperhitungkan_untai(tmp_path):
    path = _gff(tmp_path, [
        "chr1\tuji\tgene\t2000\t3000\t.\t+\t.\tID=genPlus;Name=GenPlus",
        "chr1\tuji\tgene\t5000\t6000\t.\t-\t.\tID=genMinus;Name=GenMinus",
    ])
    genes = read_gff3(path)
    # SNP di 1500: sebelum gen + (hulu); SNP di 7000: setelah koordinat akhir gen - (hulu, karena untai -)
    out = annotate_snps([{"snp_id": "a", "chromosome": "chr1", "position": 1500},
                         {"snp_id": "b", "chromosome": "1", "position": 7000}], genes, window_bp=1200)
    assert out[0]["gen"][0]["konsekuensi"] == "upstream_gene_variant"
    assert out[0]["gen"][0]["jarak_bp"] == 500
    assert out[1]["gen"][0]["gene_id"] == "genMinus"
    assert out[1]["gen"][0]["konsekuensi"] == "upstream_gene_variant"


def test_snp_tanpa_gen_dalam_jendela_tidak_diberi_kandidat(tmp_path):
    path = _gff(tmp_path, ["chr1\tuji\tgene\t100000\t101000\t.\t+\t.\tID=jauh"])
    out = annotate_snps([{"snp_id": "x", "chromosome": "chr1", "position": 1000}], read_gff3(path), 50_000)
    assert out[0]["gen"] == []


def test_berkas_tidak_ada_menghasilkan_tidak_tersedia(tmp_path):
    hasil = annotate_from_gff3([SNP_UTAMA], tmp_path / "tidak_ada.gff3")
    assert hasil["status"] == "tidak_tersedia"
    assert hasil["kandidat"] == [] and "tidak tersedia" in hasil["pesan"]


def test_berkas_tanpa_gen_menghasilkan_tidak_tersedia(tmp_path):
    path = _gff(tmp_path, ["chr1\tuji\tmRNA\t1\t100\t.\t+\t.\tID=bukan_gen"])
    assert annotate_from_gff3([SNP_UTAMA], path)["status"] == "tidak_tersedia"


def test_endpoint_anotasi(monkeypatch):
    monkeypatch.setenv("ANNOTATION_SOURCE", "otomatis")  # uji jalur GFF3 lokal
    from fastapi.testclient import TestClient

    from backend.main import app
    from tests.test_alur_utama import _login, _upload

    with TestClient(app) as c:
        h = _login(c, "penguji_anotasi")
        aid = c.post("/api/analyses", json={"analysis_name": "Uji anotasi"}, headers=h).json()["analysis_id"]
        assert _upload(c, aid, h).status_code == 200
        assert c.put(f"/api/analyses/{aid}/parameters", json={"trait": "bobot_umbi_g"},
                     headers=h).status_code == 200
        assert c.get(f"/api/analyses/{aid}/annotation", headers=h).status_code == 409
        assert c.post(f"/api/analyses/{aid}/run", headers=h).status_code == 202

        r = c.get(f"/api/analyses/{aid}/annotation", headers=h)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "tersedia"
        utama = next(k for k in body["kandidat"] if k["snp_id"] == "snp_chr3_0042")
        assert utama["gen"][0]["gene_id"] == "GC3G9001"
        assert utama["signifikan"] is True

        # ikut menganotasi SNP teratas (10 SNP dengan p terkecil, termasuk yang signifikan)
        r = c.get(f"/api/analyses/{aid}/annotation?sertakan_teratas=true", headers=h)
        body = r.json()
        assert r.status_code == 200 and len(body["kandidat"]) >= 10
        assert sum(k["signifikan"] for k in body["kandidat"]) == 1
