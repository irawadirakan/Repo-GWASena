"""Skema masukan API (Pydantic). Keterangan field tampil di Swagger UI."""
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
import re


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$",
                          examples=["isnaini"])
    email: str = Field(max_length=120, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
                       examples=["isnaini@apps.ipb.ac.id"])
    password: str = Field(min_length=8, max_length=128, examples=["rahasia123"])

    @field_validator("username")
    @classmethod
    def validate_username_has_alnum(cls, v: str) -> str:
        if not re.search(r"[A-Za-z0-9]", v):
            raise ValueError("Username wajib mengandung setidaknya satu huruf atau angka (tidak boleh hanya titik/simbol).")
        return v


class LoginIn(BaseModel):
    username: str = Field(description="Username atau email", examples=["isnaini"])
    password: str = Field(examples=["rahasia123"])


class BenchmarkLoadRequest(BaseModel):
    format: str = Field("VCF", description="Format dataset benchmark ('VCF' atau 'PLINK')")
    analysis_id: int | str | None = Field(
        None, description="ID analisis aktif jika ada; jika kosong atau invalid/404, dibuatkan sesi baru"
    )


class GoogleAuthPayload(BaseModel):
    credential: Optional[str] = Field(None, description="Google JWT ID Token dari Google Identity Services")
    name: Optional[str] = Field(None, max_length=150, description="Nama lengkap pengguna dari akun Google")
    email: Optional[str] = Field(None, max_length=120, description="Alamat email Google pengguna")
    google_sub: Optional[str] = Field(None, max_length=150, description="ID unik subjek Google")


# Alias GoogleAuthRequest untuk kompatibilitas kode
GoogleAuthRequest = GoogleAuthPayload


class AnalysisCreate(BaseModel):
    analysis_name: str = Field(min_length=1, max_length=150,
                               examples=["GWAS bobot umbi bawang putih"])
    organism: str | None = Field(None, max_length=80, examples=["Allium sativum"])


class AnalysisUpdate(BaseModel):
    analysis_name: str | None = Field(None, min_length=1, max_length=150,
                               examples=["Analisis genotipe_bawang_putih"])
    organism: str | None = Field(None, max_length=80, examples=["mus_musculus"])


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
    # PCA wajib dijalankan (AC-04.1), jadi minimal 1 PC dipakai sebagai kovariat.
    n_pc: int = Field(3, ge=1, le=10, description="Jumlah komponen utama PCA sebagai kovariat (1-10)")
    koreksi: list[Literal["bonferroni", "fdr"]] = Field(
        default_factory=lambda: ["bonferroni", "fdr"],
        description="Metode koreksi multiple testing")
    alpha: float = Field(0.05, gt=0, lt=1, description="Tingkat signifikansi")
    organism: str | None = Field(None, max_length=80, description="Kode atau nama organisme target (mis. mus_musculus, allium_sativum)")

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
