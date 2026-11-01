"""M-02: validasi berkas genotipe (VCF atau biner PLINK) dan fenotipe (CSV) serta
pencocokan Sample ID. FR-02, FR-11, BR-01, BR-02.
"""
from pathlib import Path

from pipeline.validation.matching import match_sample_ids
from pipeline.validation.phenotype import PhenotypeData, read_phenotype_csv
from pipeline.validation.plink import read_plink, write_plink
from pipeline.validation.vcf import GenotypeData, read_vcf


def read_genotype(path: str | Path) -> GenotypeData:
    """Memilih pembaca dari ekstensi: .bed -> PLINK biner (dengan .bim/.fam senama), selain itu VCF."""
    return read_plink(path) if str(path).lower().endswith(".bed") else read_vcf(path)


__all__ = [
    "GenotypeData",
    "PhenotypeData",
    "read_genotype",
    "read_vcf",
    "read_plink",
    "write_plink",
    "read_phenotype_csv",
    "match_sample_ids",
]
