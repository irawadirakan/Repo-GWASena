"""Uji format masukan PUT /api/analyses/{id}/parameters.

Frontend mengirim ambang QC di dalam objek "qc"; backend harus membacanya,
bukan diam-diam memakai nilai bawaan.
"""
import pytest
from pydantic import ValidationError

from backend.schemas import ParameterIn


def test_format_datar_tetap_diterima():
    p = ParameterIn(trait="bobot_umbi_g", mind=0.2, maf=0.1)
    assert p.mind == 0.2 and p.maf == 0.1 and p.hwe is None


def test_format_qc_dari_frontend_dibaca():
    payload = {
        "trait": "bobot_umbi_g",
        "qc": {"mind": 0.2, "geno": 0.15, "maf": 0.1, "hwe": 1e-6, "king_cutoff": None},
        "n_pc": 3, "model": "MLM", "koreksi": ["fdr"], "alpha": 0.05,
    }
    p = ParameterIn.model_validate(payload)
    assert (p.mind, p.geno, p.maf, p.hwe, p.king_cutoff) == (0.2, 0.15, 0.1, 1e-6, None)
    assert "qc" not in p.model_dump()


def test_nilai_qc_tetap_divalidasi():
    with pytest.raises(ValidationError):
        ParameterIn.model_validate({"trait": "bobot_umbi_g", "qc": {"maf": 0.9}})


def test_field_tak_dikenal_ditolak():
    with pytest.raises(ValidationError):
        ParameterIn.model_validate({"trait": "bobot_umbi_g", "ambang_maf": 0.1})
