"""Informasi statis sistem: organisme target, format input, batas unggah, dan tahapan pipeline."""
from fastapi import APIRouter

from backend.core.config import settings
from pipeline.organism import GARLIC

router = APIRouter(prefix="/api/meta", tags=["meta"])

# Rentang nilai valid tiap parameter QC. Dipakai frontend agar batas slider dan keterangan
# di layar konsisten dengan validasi backend (menjawab temuan tester soal slider 0.5 vs 1.0).
PARAMETER_QC = [
    {"id": "mind", "nama": "Missingness sampel", "default": 0.1, "min": 0.0, "max": 1.0,
     "keterangan": "Maks. proporsi genotipe hilang per sampel."},
    {"id": "geno", "nama": "Missingness SNP", "default": 0.1, "min": 0.0, "max": 1.0,
     "keterangan": "Maks. proporsi genotipe hilang per SNP."},
    {"id": "maf", "nama": "MAF minimum", "default": 0.05, "min": 0.0, "max": 0.5,
     "keterangan": "Frekuensi alel minor minimum."},
    {"id": "hwe", "nama": "Ambang HWE", "default": None, "min": 0.0, "max": 1.0, "opsional": True,
     "keterangan": "Ambang p-value Hardy-Weinberg; kosong = tidak difilter."},
    {"id": "king_cutoff", "nama": "Ambang kinship KING", "default": None, "min": 0.0, "max": 0.5,
     "opsional": True, "keterangan": "Ambang kekerabatan KING; kosong = tidak difilter."},
    {"id": "alpha", "nama": "Tingkat signifikansi (alpha)", "default": 0.05, "min": 0.0, "max": 1.0,
     "keterangan": "Batas signifikansi sebelum koreksi."},
    {"id": "n_pc", "nama": "Jumlah PC", "default": 3, "min": 1, "max": 10,
     "keterangan": "Jumlah komponen utama PCA sebagai kovariat."},
]

PIPELINE_MODULES = [
    {"id": "M-01", "nama": "Sesi dan Kontrol Akses", "fr": ["FR-01", "FR-12"], "status": "berfungsi"},
    {"id": "M-02", "nama": "Manajemen Input dan Validasi Data", "fr": ["FR-02", "FR-11"], "status": "berfungsi"},
    {"id": "M-03", "nama": "Orkestrasi Eksekusi Pipeline", "fr": ["FR-10"], "status": "berfungsi"},
    {"id": "M-04", "nama": "Quality Control", "fr": ["FR-03"], "status": "berfungsi"},
    {"id": "M-05", "nama": "Analisis Struktur Populasi (PCA)", "fr": ["FR-04"], "status": "berfungsi"},
    {"id": "M-06", "nama": "Uji Asosiasi dan Koreksi Multiple Testing", "fr": ["FR-05", "FR-06"], "status": "berfungsi"},
    {"id": "M-07", "nama": "Anotasi Gen (Ensembl REST API)", "fr": ["FR-07"], "status": "berfungsi"},
    {"id": "M-08", "nama": "Visualisasi dan Ekspor Hasil (CSV, PNG, Web Report)", "fr": ["FR-08", "FR-09"],
     "status": "berfungsi"},
    {"id": "M-09", "nama": "Panel Administrator", "fr": ["FR-13"], "status": "berfungsi"},
]


@router.get("")
def meta():
    return {
        "organisme": GARLIC,
        "format_input": {
            "genotipe": [".vcf", ".vcf.gz", ".bed + .bim + .fam (PLINK biner)"],
            "fenotipe": [".csv"],
        },
        # satu sumber kebenaran batas unggah agar frontend menampilkan angka yang benar-benar
        # diberlakukan server (menjawab temuan tester: UI 50 MB tetapi berkas lebih besar lolos)
        "batas_unggah_mb": settings.MAX_UPLOAD_MB,
        "parameter_qc": PARAMETER_QC,
        "modul": PIPELINE_MODULES,
    }
