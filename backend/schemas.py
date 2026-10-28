"""Skema masukan API (Pydantic). Keterangan field tampil di Swagger UI."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$",
                          examples=["isnaini"])
    email: str = Field(max_length=120, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
                       examples=["isnaini@apps.ipb.ac.id"])
    password: str = Field(min_length=8, max_length=128, examples=["rahasia123"])


class LoginIn(BaseModel):
    username: str = Field(description="Username atau email", examples=["isnaini"])
    password: str = Field(examples=["rahasia123"])


class AnalysisCreate(BaseModel):
    analysis_name: str = Field(min_length=1, max_length=150,
                               examples=["GWAS bobot umbi bawang putih"])


class ParameterIn(BaseModel):
    # Field yang tidak dikenal ditolak (422), supaya salah nama field dari frontend
    # langsung kelihatan dan tidak diam-diam diabaikan.
    model_config = ConfigDict(extra="forbid")

    trait: str = Field(description="Nama kolom sifat pada CSV fenotipe yang dianalisis",
                       examples=["bobot_umbi_g"])
    model: Literal["GLM", "MLM"] = Field(
        "GLM", description="Model uji asosiasi, satu model per sesi (BR-03). GLM: kovariat PC. "
                           "MLM: kovariat PC + kinship; disarankan bila banyak klon/kerabat dekat.")
    mind: float = Field(0.1, ge=0, le=1,
                        description="Maks. proporsi genotipe hilang per sampel (missingness sampel)")
    geno: float = Field(0.1, ge=0, le=1,
                        description="Maks. proporsi genotipe hilang per SNP (missingness SNP)")
    maf: float = Field(0.05, ge=0, le=0.5, description="Min. frekuensi alel minor (MAF)")
    hwe: float | None = Field(
        None, gt=0, lt=1,
        description="Ambang p-value Hardy-Weinberg. Kosongkan (null) agar tidak difilter; "
                    "disarankan untuk bawang putih yang diperbanyak klonal.")
    king_cutoff: float | None = Field(
        None, gt=0, le=0.5,
        description="Ambang kinship KING untuk membuang sampel berkerabat dekat. "
                    "null = tidak difilter (sampel klonal akan banyak terbuang bila diaktifkan).")
    n_pc: int = Field(3, ge=0, le=10, description="Jumlah komponen utama PCA sebagai kovariat")
    koreksi: list[Literal["bonferroni", "fdr"]] = Field(
        default_factory=lambda: ["bonferroni", "fdr"],
        description="Metode koreksi multiple testing")
    alpha: float = Field(0.05, gt=0, lt=1, description="Tingkat signifikansi")

    @model_validator(mode="before")
    @classmethod
    def ratakan_qc(cls, data):
        """Terima dua format: ambang QC langsung di level atas, atau dikelompokkan
        di dalam objek "qc" seperti yang dikirim frontend:
        {"trait": ..., "qc": {"mind": 0.1, "geno": 0.1, "maf": 0.05, "hwe": null, "king_cutoff": null}}
        Kalau keduanya diisi, nilai di level atas yang dipakai."""
        if isinstance(data, dict) and "qc" in data:
            data = dict(data)
            qc = data.pop("qc") or {}
            if not isinstance(qc, dict):
                raise ValueError('"qc" harus berupa objek berisi mind, geno, maf, hwe, king_cutoff')
            for kunci, nilai in qc.items():
                data.setdefault(kunci, nilai)
        return data
