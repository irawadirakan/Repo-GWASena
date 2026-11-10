"""M-07: anotasi gen kandidat (FR-07, Should Have), non-blocking (AC-07.2).

Sumber anotasi: berkas anotasi genom GFF3 lokal serta integrasi Ensembl REST API
dual-server (Vertebrates & Ensembl Genomes/Plants) dengan deteksi organisme otomatis.
"""
from pipeline.annotation.ensembl import (
    ENSEMBL_GENOMES_REST_URL,
    ENSEMBL_REST_URL,
    ENSEMBL_SUPPORTED_SPECIES,
    SPECIES_DISPLAY_NAMES,
    annotate_snp_with_ensembl,
    annotate_snps_auto,
    annotate_with_ensembl,
    detect_organism_from_dataset,
    resolve_species_target,
    scientific_name,
)
from pipeline.annotation.gff3 import (
    AnnotationUnavailable,
    Gene,
    annotate_from_gff3,
    annotate_snps,
    read_gff3,
)

__all__ = [
    "ENSEMBL_GENOMES_REST_URL",
    "ENSEMBL_REST_URL",
    "ENSEMBL_SUPPORTED_SPECIES",
    "SPECIES_DISPLAY_NAMES",
    "AnnotationUnavailable",
    "Gene",
    "annotate_snp_with_ensembl",
    "annotate_snps_auto",
    "annotate_with_ensembl",
    "annotate_from_gff3",
    "annotate_snps",
    "detect_organism_from_dataset",
    "read_gff3",
    "resolve_species_target",
    "scientific_name",
]
