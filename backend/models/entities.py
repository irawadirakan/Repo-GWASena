"""
Skema basis data GWASena.

Mengikuti SKPL Tabel 6 (12 entitas data yang disimpan oleh sistem):
1. users (User)
2. analyses (Analysis)
3. datasets (Dataset)
4. samples (Sample)
5. snps (SNP)
6. genotypes (Genotype)
7. phenotypes (Phenotype)
8. analysis_parameters (AnalysisParameter)
9. analysis_models (AnalysisModel)
10. association_results (AssociationResult)
11. visualization_results (VisualizationResult)
12. analysis_logs (AnalysisLog)
"""
from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from backend.core.database import Base

# JSONB di PostgreSQL (sesuai SDP), JSON biasa di SQLite (khusus pengujian).
JSONType = JSON().with_variant(JSONB(), "postgresql")
# BIGINT di PostgreSQL; SQLite butuh INTEGER agar autoincrement jalan.
BigIntPK = BigInteger().with_variant(Integer(), "sqlite")


class AnalysisStatus:
    """Nilai kolom Analysis.status (dipakai modul M-03 Orkestrasi)."""
    DRAFT = "draft"                    # sesi dibuat, berkas belum lengkap
    TERVALIDASI = "tervalidasi"        # lolos validasi M-02 (BR-01, BR-02)
    ANTRE = "antre"                    # sudah dikirim ke antrean
    BERJALAN = "berjalan"              # komputasi berlangsung (BR-05: UI terkunci)
    SELESAI = "selesai"
    GAGAL = "gagal"


def _now():
    return mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------- 1. users
class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(30), default="pengguna_analisis")
    created_at: Mapped[datetime] = _now()

    @property
    def hashed_password(self) -> str | None:
        return self.password_hash

    @hashed_password.setter
    def hashed_password(self, value: str | None) -> None:
        self.password_hash = value


# ---------------------------------------------------------------- 2. analysis_models
class AnalysisModel(Base):
    __tablename__ = "analysis_models"

    model_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_id: Mapped[int | None] = mapped_column(
        ForeignKey("analyses.analysis_id", ondelete="CASCADE"), nullable=True
    )
    model_name: Mapped[str] = mapped_column(String(20), unique=True)  # GLM / MLM
    software_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


# ---------------------------------------------------------------- 3. analyses
class Analysis(Base):
    __tablename__ = "analyses"

    analysis_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    analysis_name: Mapped[str] = mapped_column(String(150))
    status: Mapped[str] = mapped_column(String(20), default=AnalysisStatus.DRAFT, index=True)
    organism: Mapped[str] = mapped_column(String(80), default="Allium sativum")
    trait_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    model_id: Mapped[int | None] = mapped_column(ForeignKey("analysis_models.model_id"), nullable=True)
    lambda_gc: Mapped[float | None] = mapped_column(Float, nullable=True)
    significant_count: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    analysis_time: Mapped[datetime] = _now()
    created_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )


# ---------------------------------------------------------------- 4. datasets
class Dataset(Base):
    __tablename__ = "datasets"

    dataset_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.analysis_id", ondelete="CASCADE"), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    # vcf | plink_bed | plink_bim | plink_fam | phenotype_csv
    file_type: Mapped[str] = mapped_column(String(30))
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sample_count: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    snp_count: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    validation_status: Mapped[str] = mapped_column(String(20), default="belum_diperiksa")
    upload_time: Mapped[datetime] = _now()


# ---------------------------------------------------------------- 5. samples
class Sample(Base):
    __tablename__ = "samples"
    __table_args__ = (UniqueConstraint("dataset_id", "sample_code"),)

    sample_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.dataset_id", ondelete="CASCADE"), index=True)
    analysis_id: Mapped[int | None] = mapped_column(
        ForeignKey("analyses.analysis_id", ondelete="CASCADE"), index=True, nullable=True
    )
    sample_code: Mapped[str] = mapped_column(String(100))
    # Nama varietas/aksesi bawang putih, mis. "Lumbu Hijau", "Sangga Sembalun".
    variety: Mapped[str | None] = mapped_column(String(100), nullable=True)
    passed_qc: Mapped[bool | None] = mapped_column(Boolean, default=True, nullable=True)


# ---------------------------------------------------------------- 6. snps
class SNP(Base):
    __tablename__ = "snps"

    snp_id: Mapped[int] = mapped_column(BigIntPK, primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.dataset_id", ondelete="CASCADE"), index=True)
    analysis_id: Mapped[int | None] = mapped_column(
        ForeignKey("analyses.analysis_id", ondelete="CASCADE"), index=True, nullable=True
    )
    variant_code: Mapped[str | None] = mapped_column(String(100), nullable=True)  # ID pada VCF
    snp_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    chromosome: Mapped[str] = mapped_column(String(50))  # bawang putih: 8 kromosom
    # PENTING: BIGINT, bukan INTEGER. Kromosom bawang putih bisa > 2,1 miliar bp,
    # melebihi batas INTEGER PostgreSQL (2.147.483.647).
    position: Mapped[int] = mapped_column(BigInteger)
    ref_allele: Mapped[str | None] = mapped_column(String(50), nullable=True)
    alt_allele: Mapped[str | None] = mapped_column(String(50), nullable=True)
    maf: Mapped[float | None] = mapped_column(Float, nullable=True)
    missing_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    passed_qc: Mapped[bool | None] = mapped_column(Boolean, default=True, nullable=True)


# ---------------------------------------------------------------- 7. genotypes
class Genotype(Base):
    __tablename__ = "genotypes"

    genotype_id: Mapped[int] = mapped_column(BigIntPK, primary_key=True)
    sample_id: Mapped[int] = mapped_column(ForeignKey("samples.sample_id", ondelete="CASCADE"), index=True)
    snp_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("snps.snp_id", ondelete="CASCADE"), index=True)
    # Dosis alel: 0/1/2, NULL = missing.
    genotype_value: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)


# ---------------------------------------------------------------- 8. phenotypes
class Phenotype(Base):
    __tablename__ = "phenotypes"

    phenotype_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sample_id: Mapped[int] = mapped_column(ForeignKey("samples.sample_id", ondelete="CASCADE"), index=True)
    analysis_id: Mapped[int | None] = mapped_column(
        ForeignKey("analyses.analysis_id", ondelete="CASCADE"), index=True, nullable=True
    )
    # Contoh sifat: bobot_umbi_g, diameter_umbi_mm, jumlah_siung
    trait_name: Mapped[str] = mapped_column(String(100))
    phenotype_value: Mapped[float | None] = mapped_column(Float, nullable=True)


# ---------------------------------------------------------------- 9. analysis_parameters
class AnalysisParameter(Base):
    __tablename__ = "analysis_parameters"

    parameter_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_id: Mapped[int] = mapped_column(
        ForeignKey("analyses.analysis_id", ondelete="CASCADE"), unique=True
    )
    # Simpanan konfigurasi lengkap dalam JSON/JSONB
    parameter_config: Mapped[dict] = mapped_column(JSONType, default=dict)
    # Kolom langsung untuk kemudahan query & filtering
    maf_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    mind_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    geno_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    hwe_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    kinship_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    alpha_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    pca_components: Mapped[int | None] = mapped_column(Integer, nullable=True)


# ---------------------------------------------------------------- 10. analysis_logs
class AnalysisLog(Base):
    __tablename__ = "analysis_logs"

    log_id: Mapped[int] = mapped_column(BigIntPK, primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.analysis_id", ondelete="CASCADE"), index=True)
    stage: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status: Mapped[str] = mapped_column(String(20))
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = _now()


# ---------------------------------------------------------------- 11. association_results
class AssociationResult(Base):
    __tablename__ = "association_results"

    result_id: Mapped[int] = mapped_column(BigIntPK, primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.analysis_id", ondelete="CASCADE"), index=True)
    snp_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("snps.snp_id", ondelete="CASCADE"), nullable=True)
    snp_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    chromosome: Mapped[str | None] = mapped_column(String(50), nullable=True)
    position: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    p_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    neg_log10_p: Mapped[float | None] = mapped_column(Float, nullable=True)
    effect_size: Mapped[float | None] = mapped_column(Float, nullable=True)
    std_error: Mapped[float | None] = mapped_column(Float, nullable=True)
    q_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_significant: Mapped[bool | None] = mapped_column(Boolean, default=False, nullable=True)
    candidate_gene: Mapped[str | None] = mapped_column(String(120), nullable=True)
    annotation_info: Mapped[dict | None] = mapped_column(JSONType, nullable=True)


# ---------------------------------------------------------------- 12. visualization_results
class VisualizationResult(Base):
    __tablename__ = "visualization_results"

    visualization_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.analysis_id", ondelete="CASCADE"), index=True)
    plot_type: Mapped[str] = mapped_column(String(20))  # manhattan / qq / pca / ringkasan
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    plot_cache: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    plot_metadata: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    created_at: Mapped[datetime] = _now()
