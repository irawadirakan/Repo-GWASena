"""M-06: uji asosiasi SNP-fenotipe dan koreksi multiple testing (FR-05, FR-06).

GLM: regresi linear dengan kovariat PC.
MLM: GLM + efek acak kekerabatan (kinship VanRaden), komponen varians via REML.
"""
from pipeline.gwas.correction import benjamini_hochberg, bonferroni
from pipeline.gwas.glm import GLMResult, run_glm
from pipeline.gwas.mlm import VarianceComponents, run_mlm, vanraden_kinship

__all__ = ["GLMResult", "run_glm", "run_mlm", "VarianceComponents", "vanraden_kinship",
           "bonferroni", "benjamini_hochberg"]
