"""M-04: Quality Control (FR-03).

Versi ini dihitung dengan Python (numpy/scipy) agar mudah dijalankan di
komputer pengembang. Struktur fungsinya disiapkan agar kelak dapat diganti
pemanggilan PLINK 2 tanpa mengubah backend.
"""
from pipeline.quality_control.qc import QCParams, QCResult, run_qc

__all__ = ["QCParams", "QCResult", "run_qc"]
