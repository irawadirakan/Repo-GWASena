"""Uji unit & integrasi M-07 Dual-Kingdom Genome Annotation (Ensembl Dual-Server, Auto-Detect, & GFF3 Lokal)."""
import io
import json
import urllib.error
import urllib.request
from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import app
from backend.schemas import AnalysisCreate, AnalysisUpdate, ParameterIn
from pipeline.annotation import (
    ENSEMBL_GENOMES_REST_URL,
    ENSEMBL_REST_URL,
    annotate_snp_with_ensembl,
    annotate_snps_auto,
    detect_organism_from_dataset,
    resolve_species_target,
)

DATA = Path(__file__).resolve().parents[1] / "data" / "contoh"
VCF = DATA / "genotipe_bawang_putih_mini.vcf"
CSV = DATA / "fenotipe_bawang_putih_mini.csv"
GFF3 = DATA / "anotasi_bawang_putih_contoh.gff3"


class _DummyHTTPResponse:
    def __init__(self, payload: object):
        self._raw = json.dumps(payload).encode("utf-8")

    def read(self) -> bytes:
        return self._raw

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_resolve_species_target():
    assert resolve_species_target("mus_musculus") == ("mus_musculus", "ensembl")
    assert resolve_species_target("Mus musculus (Mencit)") == ("mus_musculus", "ensembl")
    assert resolve_species_target("bos_taurus") == ("bos_taurus", "ensembl")
    assert resolve_species_target("gallus_gallus") == ("gallus_gallus", "ensembl")
    assert resolve_species_target("sus_scrofa") == ("sus_scrofa", "ensembl")
    assert resolve_species_target("oryza_sativa") == ("oryza_sativa", "ensembl")
    assert resolve_species_target("zea_mays") == ("zea_mays", "ensembl")
    assert resolve_species_target("arabidopsis_thaliana") == ("arabidopsis_thaliana", "ensembl")

    # Universal custom scientific names normalize to Ensembl snake_case
    assert resolve_species_target("Felis catus") == ("felis_catus", "ensembl")
    assert resolve_species_target("Capra hircus") == ("capra_hircus", "ensembl")
    assert resolve_species_target("Solanum tuberosum") == ("solanum_tuberosum", "ensembl")

    # Local GFF3 fallback solely for Allium sativum or empty
    assert resolve_species_target("allium_sativum") == ("allium_sativum", "gff3")
    assert resolve_species_target("Allium sativum") == ("allium_sativum", "gff3")
    assert resolve_species_target(None) == ("allium_sativum", "gff3")
    assert resolve_species_target("") == ("allium_sativum", "gff3")


def test_detect_organism_from_dataset():
    m = detect_organism_from_dataset(["mouse_hs1940.bed", "fenotipe_mencit_hs1940.csv"], ["CD8", "MCH"])
    assert m["organism"] == "mus_musculus"
    assert m["kingdom"] == "hewan"
    assert m["auto_detected"] is True

    g = detect_organism_from_dataset(["genotipe_bawang_putih_mini.vcf"], ["bobot_umbi_g"])
    assert g["organism"] == "allium_sativum"
    assert g["kingdom"] == "tanaman"
    assert g["auto_detected"] is True

    assert detect_organism_from_dataset(["rice_gwas.vcf"])["organism"] == "oryza_sativa"
    assert detect_organism_from_dataset(["soybean_panel.vcf"])["organism"] == "glycine_max"
    assert detect_organism_from_dataset(["tomato_var.vcf"])["organism"] == "solanum_lycopersicum"
    assert detect_organism_from_dataset(["sheep_herd.bed"])["organism"] == "ovis_aries"
    assert detect_organism_from_dataset(["wheat_snp.vcf"])["organism"] == "triticum_aestivum"
    assert detect_organism_from_dataset(["rattus_panel.vcf"])["organism"] == "rattus_norvegicus"

    # Heuristik jumlah kromosom bila nama berkas generik
    h_mouse = detect_organism_from_dataset(["dataset.vcf"], ["trait_a"], num_chromosomes=19)
    assert h_mouse["organism"] == "mus_musculus"
    assert h_mouse["kingdom"] == "hewan"

    h_rice = detect_organism_from_dataset(["dataset.vcf"], ["yield"], num_chromosomes=12)
    assert h_rice["organism"] == "oryza_sativa"
    assert h_rice["kingdom"] == "tanaman"


def test_annotate_snp_with_ensembl_mapping(monkeypatch):
    seen_urls: list[str] = []

    def fake_urlopen(req, timeout=5, context=None):
        seen_urls.append(req.full_url)
        return _DummyHTTPResponse(
            [
                {
                    "id": "ENSMUSG00000099999",
                    "external_name": "FarGene",
                    "description": "Distal gene",
                    "start": 3230000,
                    "end": 3240000,
                    "strand": -1,
                },
                {
                    "id": "ENSMUSG00000064842",
                    "external_name": "IntraGene",
                    "description": "Overlapping gene",
                    "start": 3190000,
                    "end": 3210000,
                    "strand": 1,
                },
                {
                    "id": "ENSMUSG00000011111",
                    "external_name": None,
                    "description": None,
                    "biotype": "protein_coding",
                    "start": 3170000,
                    "end": 3180000,
                    "strand": 1,
                },
            ]
        )

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    genes = annotate_snp_with_ensembl("mus_musculus", "chr1", 3_200_000, window_bp=50_000)
    assert len(seen_urls) == 1
    assert seen_urls[0] == (
        f"{ENSEMBL_REST_URL}/overlap/region/mus_musculus/1:3150000-3250000?feature=gene"
    )
    assert [g["gene_id"] for g in genes] == ["IntraGene", "ENSMUSG00000011111", "FarGene"]
    assert genes[0]["jarak_bp"] == 0
    assert genes[0]["konsekuensi"] == "intragenic_variant"
    assert genes[0]["letak"] == "di dalam gen"
    assert genes[1]["jarak_bp"] == 20_000
    assert genes[1]["konsekuensi"] == "downstream_gene_variant"
    assert "protein coding" in genes[1]["deskripsi"]
    assert genes[2]["untai"] == "-"
    assert genes[2]["konsekuensi"] == "downstream_gene_variant"


def test_ensembl_dual_server_fallback_on_404(monkeypatch):
    seen_urls: list[str] = []

    def fake_urlopen(req, timeout=5, context=None):
        seen_urls.append(req.full_url)
        if req.full_url.startswith(ENSEMBL_REST_URL):
            raise urllib.error.HTTPError(req.full_url, 404, "Not Found", {}, None)
        return _DummyHTTPResponse(
            [
                {
                    "id": "Solyc01g005000",
                    "external_name": "SlGene1",
                    "description": "Tomato candidate gene",
                    "start": 48000,
                    "end": 52000,
                    "strand": 1,
                }
            ]
        )

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    genes = annotate_snp_with_ensembl("Solanum lycopersicum", "chr1", 50_000, window_bp=50_000)
    assert len(seen_urls) == 2
    assert seen_urls[0].startswith(f"{ENSEMBL_REST_URL}/overlap/region/solanum_lycopersicum/1:")
    assert seen_urls[1].startswith(f"{ENSEMBL_GENOMES_REST_URL}/overlap/region/solanum_lycopersicum/1:")
    assert len(genes) == 1
    assert genes[0]["gene_id"] == "SlGene1"
    assert genes[0]["jarak_bp"] == 0


def test_annotate_snp_with_ensembl_timeout_graceful(monkeypatch):
    def failing_urlopen(req, timeout=5, context=None):
        raise urllib.error.URLError("Koneksi Ensembl timeout")

    monkeypatch.setattr(urllib.request, "urlopen", failing_urlopen)
    assert annotate_snp_with_ensembl("mus_musculus", "1", 3_200_000) == []


def test_annotate_snps_auto_dual_kingdom(monkeypatch):
    def fake_urlopen(req, timeout=5, context=None):
        return _DummyHTTPResponse(
            [
                {
                    "id": "ENSMUSG00000064842",
                    "external_name": "Sox21",
                    "description": "SRY-box transcription factor",
                    "start": 3195000,
                    "end": 3205000,
                    "strand": 1,
                }
            ]
        )

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    snp_mencit = [{"snp_id": "rs3683945", "chromosome": "1", "position": 3_197_400, "p_value": 1e-6}]
    res_ensembl = annotate_snps_auto(snp_mencit, "mus_musculus", GFF3, window_bp=50_000)
    assert res_ensembl["status"] == "tersedia"
    assert res_ensembl["sumber"] == "Ensembl REST API (mus_musculus)"
    assert res_ensembl["sumber_tipe"] == "ensembl"
    assert res_ensembl["organism"] == "mus_musculus"
    assert res_ensembl["kandidat"][0]["gen"][0]["gene_id"] == "Sox21"

    snp_garlic = [{"snp_id": "snp_chr1_0001", "chromosome": 1, "position": 402_000, "p_value": 1e-6}]
    res_gff3 = annotate_snps_auto(snp_garlic, "Allium sativum", GFF3, window_bp=50_000)
    assert res_gff3["status"] == "tersedia"
    assert res_gff3["sumber_tipe"] == "gff3"
    assert any(g["gene_id"] == "GC1G0001" for g in res_gff3["kandidat"][0]["gen"])


def test_schemas_organism_field_preserves_extra_forbid():
    p = ParameterIn(trait="CD8", organism="felis_catus")
    assert p.organism == "felis_catus"
    c = AnalysisCreate(analysis_name="GWAS Mencit", organism="mus_musculus")
    assert c.organism == "mus_musculus"
    u = AnalysisUpdate(organism="oryza_sativa")
    assert u.organism == "oryza_sativa"


def test_endpoint_upload_auto_detect_and_ensembl_e2e(monkeypatch):
    def fake_urlopen(req, timeout=5, context=None):
        return _DummyHTTPResponse(
            [
                {
                    "id": "ENSMUSG00000042001",
                    "external_name": "Cd8a",
                    "description": "CD8 antigen, alpha chain [Source:MGI]",
                    "start": 490000,
                    "end": 510000,
                    "strand": 1,
                }
            ]
        )

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    with TestClient(app) as client:
        client.post(
            "/api/auth/register",
            json={"username": "ensembl_tester", "email": "ensembl@contoh.id", "password": "rahasia123"},
        )
        tok = client.post(
            "/api/auth/login",
            json={"username": "ensembl_tester", "password": "rahasia123"},
        ).json()["access_token"]
        h = {"Authorization": f"Bearer {tok}"}

        aid = client.post(
            "/api/analyses",
            json={"analysis_name": "Uji Anotasi Ensembl Mencit"},
            headers=h,
        ).json()["analysis_id"]

        with open(VCF, "rb") as g, open(CSV, "rb") as ph:
            up = client.post(
                f"/api/analyses/{aid}/upload",
                headers=h,
                files={
                    "genotipe": ("mouse_hs1940_test.vcf", g, "text/plain"),
                    "fenotipe": ("fenotipe_mencit.csv", ph, "text/csv"),
                },
            )
        assert up.status_code == 200, up.text
        up_json = up.json()
        assert up_json["organism"] == "mus_musculus"
        assert up_json["trait"] == "bobot_umbi_g"
        assert up_json["trait_name"] == "bobot_umbi_g"
        assert up_json["detected_organism"]["organism"] == "mus_musculus"
        assert up_json["detected_organism"]["auto_detected"] is True

        detail_after_upload = client.get(f"/api/analyses/{aid}", headers=h).json()
        assert detail_after_upload["organism"] == "mus_musculus"
        assert detail_after_upload["trait_name"] == "bobot_umbi_g"
        assert "bobot_umbi_g" in detail_after_upload["phenotype_columns"]

        # Uji override spesies kustom via PUT /parameters ("Felis catus" / felis_catus -> mus_musculus back)
        pr = client.put(
            f"/api/analyses/{aid}/parameters",
            json={"trait": "bobot_umbi_g", "organism": "mus_musculus"},
            headers=h,
        )
        assert pr.status_code == 200, pr.text

        run_resp = client.post(f"/api/analyses/{aid}/run", headers=h)
        assert run_resp.status_code == 202, run_resp.text

        st_resp = client.get(f"/api/analyses/{aid}/status", headers=h).json()
        assert st_resp["trait_name"] == "bobot_umbi_g"
        assert st_resp["ringkasan_qc"]["trait_name"] == "bobot_umbi_g"

        ann = client.get(f"/api/analyses/{aid}/annotation?sertakan_teratas=true", headers=h)
        assert ann.status_code == 200, ann.text
        data = ann.json()
        assert data["status"] == "tersedia"
        assert data["sumber"] == "Ensembl REST API (mus_musculus)"
        assert data["sumber_tipe"] == "ensembl"
        assert data["organism"] == "mus_musculus"
        assert len(data["kandidat"]) > 0
        assert any(g["gene_id"] == "Cd8a" for g in data["kandidat"][0]["gen"])

        rep = client.get(f"/api/analyses/{aid}/report?unduh=true", headers=h)
        assert rep.status_code == 200
        assert "mus_musculus" in rep.text or "Mus musculus" in rep.text
        assert "Interpretasi Hasil Asosiasi Genomik (Manhattan Plot)" in rep.text


def test_legacy_mouse_session_infers_organism_in_history_and_report():
    from backend.core.database import SessionLocal
    from backend.models import SNP, Analysis, Dataset, User, VisualizationResult

    with TestClient(app) as client:
        client.post(
            "/api/auth/register",
            json={"username": "legacy_mouse_tester", "email": "legacy@contoh.id", "password": "rahasia123"},
        )
        tok = client.post(
            "/api/auth/login",
            json={"username": "legacy_mouse_tester", "password": "rahasia123"},
        ).json()["access_token"]
        h = {"Authorization": f"Bearer {tok}"}

        with SessionLocal() as db:
            user = db.query(User).filter(User.username == "legacy_mouse_tester").first()
            # Simulasikan sesi lama yang masih memiliki kolom organism default "Allium sativum"
            a = Analysis(
                user_id=user.user_id,
                analysis_name="GWAS Dataset Sesi Lama",
                status="selesai",
                organism="Allium sativum",
                trait_name="CD8",
                model_name="MLM",
            )
            db.add(a)
            db.commit()
            db.refresh(a)
            aid = a.analysis_id

            ds_geno = Dataset(
                analysis_id=aid,
                file_name="data_cohort.bed",
                file_type="plink_bed",
                file_path="/tmp/data_cohort.bed",
                validation_status="valid",
                sample_count=100,
                snp_count=19,
            )
            db.add(ds_geno)
            db.flush()
            for chr_i in range(1, 20):
                db.add(
                    SNP(
                        dataset_id=ds_geno.dataset_id,
                        analysis_id=aid,
                        variant_code=f"rs13475{chr_i:02d}",
                        snp_code=f"rs13475{chr_i:02d}",
                        chromosome=str(chr_i),
                        position=1000000 + chr_i * 1000,
                    )
                )
            db.add(
                VisualizationResult(
                    analysis_id=aid,
                    plot_type="ringkasan",
                    plot_cache={
                        "trait": "CD8",
                        "model": "MLM",
                        "asosiasi": {"jumlah_signifikan": 0, "ambang_bonferroni_p": 1e-5, "lambda_gc": 1.01},
                        "snp_signifikan": [],
                        "snp_teratas": [],
                    },
                )
            )
            db.commit()

        hist = client.get("/api/analyses", headers=h)
        assert hist.status_code == 200
        row = next(r for r in hist.json() if r["analysis_id"] == aid)
        assert row["organism"] == "mus_musculus"
        assert row["organism_label"] == "Mus musculus"

        det = client.get(f"/api/analyses/{aid}", headers=h)
        assert det.status_code == 200
        assert det.json()["organism"] == "mus_musculus"
        assert det.json()["organism_label"] == "Mus musculus"

        rep = client.get(f"/api/analyses/{aid}/report", headers=h)
        assert rep.status_code == 200
        assert "Mus musculus" in rep.text
        assert "Interpretasi Hasil Asosiasi Genomik (Manhattan Plot)" in rep.text
def test_annotate_with_ensembl_concurrent_and_partial_resilience(monkeypatch):
    from pipeline.annotation.ensembl import annotate_with_ensembl

    def fake_urlopen(req, timeout=3, context=None):
        url = req.full_url
        if '/2:' in url:
            raise urllib.error.URLError('timeout satu snp')
        return _DummyHTTPResponse(
            [
                {
                    'id': 'ENSMUSG00000010001',
                    'external_name': 'Cd8b1',
                    'description': 'CD8 beta chain',
                    'start': 100000,
                    'end': 105000,
                    'strand': 1,
                }
            ]
        )

    monkeypatch.setattr(urllib.request, 'urlopen', fake_urlopen)

    snps = [
        {'snp_id': f'rs_test_{i}', 'chromosome': '2' if i == 2 else '1', 'position': 102000 + i * 100, 'p_value': 1e-6}
        for i in range(1, 7)
    ]
    res = annotate_with_ensembl(snps, species='mus_musculus', window_bp=50000)
    assert res['status'] == 'tersedia'
    assert len(res['kandidat']) == 6
    snp2 = next(k for k in res['kandidat'] if k['snp_id'] == 'rs_test_2')
    assert snp2['gen'] == []
    snp1 = next(k for k in res['kandidat'] if k['snp_id'] == 'rs_test_1')
    assert snp1['gen'][0]['gene_id'] == 'Cd8b1'


def test_list_analyses_batch_summary_consistency():
    from backend.core.database import SessionLocal
    from backend.models import Analysis, AnalysisParameter, Dataset, User

    with TestClient(app) as client:
        client.post(
            '/api/auth/register',
            json={'username': 'batch_hist_tester', 'email': 'batch@contoh.id', 'password': 'rahasia123'},
        )
        tok = client.post(
            '/api/auth/login',
            json={'username': 'batch_hist_tester', 'password': 'rahasia123'},
        ).json()['access_token']
        h = {'Authorization': f'Bearer {tok}'}

        with SessionLocal() as db:
            user = db.query(User).filter(User.username == 'batch_hist_tester').first()
            a1 = Analysis(
                user_id=user.user_id,
                analysis_name='Sesi Batch Padi',
                status='selesai',
                organism='oryza_sativa',
                trait_name='tinggi_tanaman',
            )
            a2 = Analysis(
                user_id=user.user_id,
                analysis_name='Sesi Batch Mencit',
                status='draft',
                organism='mus_musculus',
                trait_name=None,
            )
            db.add_all([a1, a2])
            db.flush()
            db.add(
                AnalysisParameter(
                    analysis_id=a2.analysis_id,
                    parameter_config={'trait': 'CD8', 'organism': 'mus_musculus', 'model': 'MLM'},
                )
            )
            db.add(
                Dataset(
                    analysis_id=a1.analysis_id,
                    file_name='rice_geno.vcf',
                    file_type='vcf',
                    file_path='/tmp/rice_geno.vcf',
                    validation_status='valid',
                )
            )
            db.commit()

        resp = client.get('/api/analyses', headers=h)
        assert resp.status_code == 200
        rows = resp.json()
        by_name = {r['analysis_name']: r for r in rows}
        assert by_name['Sesi Batch Padi']['organism'] == 'oryza_sativa'
        assert by_name['Sesi Batch Padi']['organism_label'] == 'Oryza sativa'
        assert by_name['Sesi Batch Padi']['trait_name'] == 'tinggi_tanaman'
        assert by_name['Sesi Batch Mencit']['organism'] == 'mus_musculus'
        assert by_name['Sesi Batch Mencit']['organism_label'] == 'Mus musculus'
        assert by_name['Sesi Batch Mencit']['trait'] == 'CD8'
        assert by_name['Sesi Batch Mencit']['trait_name'] == 'CD8'
