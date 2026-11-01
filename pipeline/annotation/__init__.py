"""M-07: anotasi gen kandidat (FR-07, Should Have), non-blocking (AC-07.2).

Sumber anotasi: berkas anotasi genom GFF3 lokal. Ensembl REST API pada rancangan awal
belum dipakai karena genom bawang putih belum ditemukan di Ensembl Plants (perlu dipastikan
kembali); modul ini disusun agar sumber lain, misalnya Ensembl, dapat ditambahkan tanpa
mengubah endpoint.
"""
from pipeline.annotation.gff3 import (
    AnnotationUnavailable,
    Gene,
    annotate_from_gff3,
    annotate_snps,
    read_gff3,
)

__all__ = ["AnnotationUnavailable", "Gene", "annotate_from_gff3", "annotate_snps", "read_gff3"]
