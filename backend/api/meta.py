"""Informasi statis sistem: organisme target, format input, dan tahapan pipeline."""
from fastapi import APIRouter

from pipeline.organism import GARLIC

router = APIRouter(prefix="/api/meta", tags=["meta"])

PIPELINE_MODULES = [
    {"id": "M-01", "nama": "Sesi dan Kontrol Akses", "fr": ["FR-01", "FR-12"], "status": "berfungsi"},
    {"id": "M-02", "nama": "Manajemen Input dan Validasi Data", "fr": ["FR-02", "FR-11"], "status": "berfungsi"},
    {"id": "M-03", "nama": "Orkestrasi Eksekusi Pipeline", "fr": ["FR-10"], "status": "kerangka"},
    {"id": "M-04", "nama": "Quality Control", "fr": ["FR-03"], "status": "belum"},
    {"id": "M-05", "nama": "Analisis Struktur Populasi (PCA)", "fr": ["FR-04"], "status": "belum"},
    {"id": "M-06", "nama": "Uji Asosiasi dan Koreksi Multiple Testing", "fr": ["FR-05", "FR-06"], "status": "belum"},
    {"id": "M-07", "nama": "Anotasi Gen", "fr": ["FR-07"], "status": "belum"},
    {"id": "M-08", "nama": "Visualisasi dan Ekspor Hasil", "fr": ["FR-08", "FR-09"], "status": "belum"},
]


@router.get("")
def meta():
    return {
        "organisme": GARLIC,
        "format_input": {
            "genotipe": [".vcf", ".vcf.gz", ".bed + .bim + .fam (PLINK biner, menyusul)"],
            "fenotipe": [".csv"],
        },
        "modul": PIPELINE_MODULES,
    }
