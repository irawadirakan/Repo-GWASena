"""
Verifikasi Integrasi Penuh End-to-End PostgreSQL gwasena_database.
Memastikan seluruh 12 entitas SKPL Tabel 6 tersimpan nyata di PostgreSQL.
"""
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from sqlalchemy import func, inspect, select, text
from backend.core.config import settings
from backend.core.database import SessionLocal, engine, init_db
from backend.core.security import verify_password, hash_password
from backend.models import (
    User,
    Analysis,
    AnalysisModel,
    AnalysisParameter,
    AnalysisLog,
    Dataset,
    Sample,
    SNP,
    Genotype,
    Phenotype,
    AssociationResult,
    VisualizationResult,
    AnalysisStatus,
)
from backend.services import dataset_service as ds
from backend.services.analysis_runner import _save_results
from pipeline.validation import read_genotype, read_phenotype_csv, match_sample_ids
from pipeline.runner import run_pipeline

EXPECTED_TABLES = [
    "users",
    "analyses",
    "datasets",
    "samples",
    "snps",
    "genotypes",
    "phenotypes",
    "analysis_parameters",
    "analysis_models",
    "association_results",
    "visualization_results",
    "analysis_logs",
]

def verify():
    print("=" * 70)
    print("VERIFIKASI INTEGRASI PENUH GWASena <-> PostgreSQL (gwasena_database)")
    print(f"Target Database URL: {settings.DATABASE_URL}")
    print("=" * 70)

    # 1. Pastikan inisialisasi tabel
    init_db()
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    print("\n[TAHAP 1] Verifikasi 12 Tabel SKPL:")
    missing = [t for t in EXPECTED_TABLES if t not in existing_tables]
    if missing:
        raise RuntimeError(f"Tabel berikut belum ada di PostgreSQL: {missing}")
    for idx, t in enumerate(EXPECTED_TABLES, start=1):
        cols = [c["name"] for c in inspector.get_columns(t)]
        print(f"  {idx:02d}. Tabel '{t}' OK ({len(cols)} kolom: {', '.join(cols[:5])}...)")

    # 2. Verifikasi User Seed & Autentikasi
    print("\n[TAHAP 2] Verifikasi Pengguna & Autentikasi Seed:")
    with SessionLocal() as db:
        user_demo = db.scalar(select(User).where(User.username == "user_demo"))
        assert user_demo is not None, "user_demo tidak ditemukan!"
        pw_ok = verify_password("password123", user_demo.password_hash)
        assert pw_ok, "Kata sandi user_demo gagal diverifikasi!"
        print(f"  - user_demo: ID={user_demo.user_id}, Email={user_demo.email}, Role={user_demo.role}")
        print(f"  - Verifikasi password 'password123': {'BERHASIL' if pw_ok else 'GAGAL'}")

        # Tambah atau pastikan user pengujian e2e
        test_user = db.scalar(select(User).where(User.username == "user_e2e_test"))
        if not test_user:
            test_user = User(
                username="user_e2e_test",
                email="user.e2e@ipb.ac.id",
                password_hash=hash_password("password123"),
                role="Pengguna Analisis",
            )
            db.add(test_user)
            db.commit()
            db.refresh(test_user)
        print(f"  - Akun uji e2e aktif: ID={test_user.user_id}, Username={test_user.username}")

    # 3. Jalankan Alur Pipeline Nyata dan Simpan ke 12 Tabel
    print("\n[TAHAP 3] Simulasi Analisis End-to-End GWASena:")
    with SessionLocal() as db:
        test_user = db.scalar(select(User).where(User.username == "user_e2e_test"))
        # Buat Sesi Analisis
        analysis = Analysis(
            user_id=test_user.user_id,
            analysis_name="Uji Integrasi Bawang Putih PostgreSQL",
            organism="Allium sativum",
            status=AnalysisStatus.DRAFT,
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        aid = analysis.analysis_id
        print(f"  - Sesi Analisis dibuat: ID={aid}, Nama='{analysis.analysis_name}'")

        # Berkas contoh
        vcf_path = ROOT_DIR / "data" / "contoh" / "genotipe_bawang_putih_mini.vcf"
        csv_path = ROOT_DIR / "data" / "contoh" / "fenotipe_bawang_putih_mini.csv"
        assert vcf_path.is_file(), f"Berkas VCF contoh {vcf_path} tidak ditemukan"
        assert csv_path.is_file(), f"Berkas CSV contoh {csv_path} tidak ditemukan"

        # Simpan Dataset, Sample, SNP, Genotype, Phenotype
        geno_data = read_genotype(vcf_path)
        pheno_data = read_phenotype_csv(csv_path)
        match_sample_ids(geno_data.samples, pheno_data.samples)

        ds_info = ds.store_datasets(
            db,
            analysis_id=aid,
            genotype_name="genotipe_bawang_putih_mini.vcf",
            genotype_path=vcf_path,
            phenotype_name="fenotipe_bawang_putih_mini.csv",
            phenotype_path=csv_path,
            geno=geno_data,
            pheno=pheno_data,
            genotype_type="vcf",
        )
        db.commit()
        print(f"  - Datasets & Genotypes tersimpan ke PostgreSQL: {ds_info['genotipe']['jumlah_sampel']} sampel, {ds_info['genotipe']['jumlah_snp']} SNP")

        # Simpan Parameter Analisis
        glm_model = db.scalar(select(AnalysisModel).where(AnalysisModel.model_name == "GLM"))
        trait = pheno_data.trait_names[0]
        param_config = {
            "trait": trait,
            "model": "GLM",
            "maf": 0.05,
            "mind": 0.1,
            "geno": 0.1,
            "hwe": None,
            "king_cutoff": None,
            "n_pc": 2,
            "koreksi": ["bonferroni", "fdr"],
            "alpha": 0.05,
        }
        analysis.model_id = glm_model.model_id if glm_model else None
        analysis.model_name = "GLM"
        analysis.trait_name = trait

        param = AnalysisParameter(
            analysis_id=aid,
            parameter_config=param_config,
            maf_threshold=0.05,
            mind_threshold=0.1,
            geno_threshold=0.1,
            alpha_threshold=0.05,
            pca_components=2,
        )
        db.add(param)
        db.add(AnalysisLog(analysis_id=aid, stage="validasi", status="selesai", message="Validasi berkas & parameter sukses"))
        db.commit()
        print(f"  - Parameter analisis disimpan untuk trait='{trait}', model='GLM'")

        # Eksekusi Pipeline GWAS & Simpan Hasil Asosiasi + Visualisasi
        result = run_pipeline(str(vcf_path), str(csv_path), param_config)
        _save_results(db, aid, result)
        analysis.status = AnalysisStatus.SELESAI
        db.commit()
        print(f"  - Pipeline sukses: Lambda GC={result['asosiasi']['lambda_gc']}, SNP Signifikan={result['asosiasi']['jumlah_signifikan']}")

    # 4. Ringkasan Baris per Tabel di PostgreSQL
    print("\n[TAHAP 4] Ringkasan Baris Nyata di PostgreSQL (gwasena_database):")
    model_map = {
        "users": User,
        "analyses": Analysis,
        "datasets": Dataset,
        "samples": Sample,
        "snps": SNP,
        "genotypes": Genotype,
        "phenotypes": Phenotype,
        "analysis_parameters": AnalysisParameter,
        "analysis_models": AnalysisModel,
        "association_results": AssociationResult,
        "visualization_results": VisualizationResult,
        "analysis_logs": AnalysisLog,
    }

    with SessionLocal() as db:
        print(f"  {'-' * 55}")
        print(f"  {'Tabel SKPL':<25} | {'Jumlah Baris di PostgreSQL':<25}")
        print(f"  {'-' * 55}")
        for tname in EXPECTED_TABLES:
            m = model_map[tname]
            count = db.scalar(select(func.count()).select_from(m))
            print(f"  {tname:<25} | {count:<25}")
            assert count > 0, f"Tabel {tname} harus memiliki baris data nyata di PostgreSQL!"
        print(f"  {'-' * 55}")

    print("\n" + "=" * 70)
    print("HASIL: SELURUH 12 ENTITAS SKPL TELAH TERINTEGRASI DAN TERISI DI POSTGRESQL!")
    print("=" * 70)

if __name__ == "__main__":
    verify()
