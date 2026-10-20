"""M-02: validasi berkas genotipe (VCF) dan fenotipe (CSV) serta pencocokan Sample ID.

FR-02, FR-11, BR-01, BR-02. Format PLINK biner (.bed/.bim/.fam) menyusul.
"""
from pipeline.validation.matching import match_sample_ids
from pipeline.validation.phenotype import PhenotypeData, read_phenotype_csv
from pipeline.validation.vcf import GenotypeData, read_vcf

__all__ = [
    "GenotypeData",
    "PhenotypeData",
    "read_vcf",
    "read_phenotype_csv",
    "match_sample_ids",
]
