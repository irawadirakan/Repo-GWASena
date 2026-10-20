"""Pembaca dan validator berkas fenotipe CSV.

Format: satu kolom ID sampel (nama kolom 'sample_id', 'id', 'sampel', atau
'sample') dan minimal satu kolom sifat numerik, misalnya bobot_umbi_g.
Kolom teks lain (mis. 'varietas') boleh ada dan disimpan sebagai keterangan.
Nilai kosong / NA dianggap data hilang.
"""
import csv
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from pipeline.errors import ValidationError

ID_COLUMNS = ("sample_id", "id", "sampel", "sample", "sample_code", "iid")
VARIETY_COLUMNS = ("varietas", "variety", "aksesi", "kultivar")
MISSING = {"", "na", "nan", "null", "-", "."}


@dataclass
class PhenotypeData:
    samples: list[str]
    traits: dict[str, np.ndarray]  # nama sifat -> nilai (NaN = hilang)
    variety: dict[str, str] = field(default_factory=dict)

    @property
    def trait_names(self) -> list[str]:
        return list(self.traits)


def read_phenotype_csv(path: str | Path) -> PhenotypeData:
    path = Path(path)
    try:
        with open(path, "r", encoding="utf-8-sig", errors="strict", newline="") as fh:
            sample = fh.read(4096)
            fh.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
            except csv.Error:
                dialect = csv.excel
            rows = list(csv.reader(fh, dialect))
    except UnicodeDecodeError:
        raise ValidationError("Berkas fenotipe bukan CSV teks (UTF-8) yang valid.")
    except OSError as exc:
        raise ValidationError("Berkas fenotipe tidak dapat dibaca.", [str(exc)])

    rows = [r for r in rows if any(c.strip() for c in r)]
    if len(rows) < 2:
        raise ValidationError("CSV fenotipe kosong atau hanya berisi header.")

    header = [h.strip() for h in rows[0]]
    lower = [h.lower() for h in header]
    id_idx = next((lower.index(c) for c in ID_COLUMNS if c in lower), None)
    if id_idx is None:
        raise ValidationError(
            "Kolom ID sampel tidak ditemukan pada CSV fenotipe.",
            [f"Gunakan salah satu nama kolom: {', '.join(ID_COLUMNS)}."],
        )
    var_idx = next((lower.index(c) for c in VARIETY_COLUMNS if c in lower), None)

    errors: list[str] = []
    samples: list[str] = []
    for i, r in enumerate(rows[1:], start=2):
        if len(r) != len(header):
            errors.append(f"Baris {i}: jumlah kolom {len(r)}, seharusnya {len(header)}.")
            continue
        sid = r[id_idx].strip()
        if not sid:
            errors.append(f"Baris {i}: ID sampel kosong.")
        samples.append(sid)
    if errors:
        raise ValidationError("Isi CSV fenotipe tidak valid.", errors[:15])

    dup = sorted({s for s in samples if samples.count(s) > 1})
    if dup:
        raise ValidationError("Terdapat ID sampel ganda pada CSV fenotipe.", [f"ID ganda: {', '.join(dup)}"])

    data_rows = rows[1:]
    traits: dict[str, np.ndarray] = {}
    for j, name in enumerate(header):
        if j in (id_idx, var_idx):
            continue
        values, numeric = [], True
        for r in data_rows:
            v = r[j].strip().replace(",", ".") if dialect.delimiter != "," else r[j].strip()
            if v.lower() in MISSING:
                values.append(np.nan)
                continue
            try:
                values.append(float(v))
            except ValueError:
                numeric = False
                break
        if numeric:
            arr = np.asarray(values, dtype=float)
            if np.isfinite(arr).sum() >= 2:
                traits[name] = arr

    if not traits:
        raise ValidationError(
            "CSV fenotipe tidak memiliki kolom sifat numerik.",
            ["Minimal satu kolom berisi angka, mis. bobot_umbi_g."],
        )

    variety = {}
    if var_idx is not None:
        variety = {r[id_idx].strip(): r[var_idx].strip() for r in data_rows if r[var_idx].strip()}
    return PhenotypeData(samples=samples, traits=traits, variety=variety)
