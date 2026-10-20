"""Pembaca dan validator berkas VCF (.vcf atau .vcf.gz).

Genotipe diubah menjadi dosis alel alternatif: 0/0 -> 0, 0/1 -> 1, 1/1 -> 2,
genotipe hilang (./.) -> NaN. Hanya SNP bialelik yang dipakai.
"""
import gzip
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from pipeline.errors import ValidationError

REQUIRED_COLUMNS = ["#CHROM", "POS", "ID", "REF", "ALT", "QUAL", "FILTER", "INFO", "FORMAT"]
MAX_ERRORS = 15  # batasi jumlah pesan galat yang ditampilkan


@dataclass
class GenotypeData:
    samples: list[str]
    chrom: list[str]
    pos: list[int]
    ids: list[str]
    ref: list[str]
    alt: list[str]
    dosage: np.ndarray  # bentuk (n_sampel, n_snp), float dengan NaN
    skipped: dict = field(default_factory=dict)  # alasan -> jumlah varian dilewati

    @property
    def n_samples(self) -> int:
        return len(self.samples)

    @property
    def n_snps(self) -> int:
        return len(self.pos)


def _open_text(path: Path):
    if str(path).lower().endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    return open(path, "r", encoding="utf-8", errors="replace")


def _gt_to_dosage(field_value: str) -> float:
    gt = field_value.split(":", 1)[0].replace("|", "/")
    if gt in ("./.", ".", ""):
        return np.nan
    parts = gt.split("/")
    if len(parts) != 2 or "." in parts:
        return np.nan
    try:
        a, b = int(parts[0]), int(parts[1])
    except ValueError:
        raise ValueError(f"nilai genotipe '{field_value}' tidak dikenali")
    if a > 1 or b > 1:
        raise ValueError(f"genotipe multialelik '{field_value}'")
    return float(a + b)


def read_vcf(path: str | Path) -> GenotypeData:
    path = Path(path)
    errors: list[str] = []
    samples: list[str] | None = None
    chrom, pos, ids, ref, alt, rows = [], [], [], [], [], []
    skipped = {"multialelik": 0, "bukan_snp": 0}
    seen_fileformat = False

    try:
        with _open_text(path) as fh:
            for lineno, raw in enumerate(fh, start=1):
                line = raw.rstrip("\r\n")
                if not line:
                    continue
                if line.startswith("##"):
                    if line.startswith("##fileformat=VCF"):
                        seen_fileformat = True
                    continue
                if line.startswith("#"):
                    header = line.split("\t")
                    if header[: len(REQUIRED_COLUMNS)] != REQUIRED_COLUMNS:
                        raise ValidationError(
                            "Header VCF tidak sesuai standar.",
                            [
                                "Baris header harus diawali kolom: " + ", ".join(REQUIRED_COLUMNS)
                                + " dan dipisahkan tab."
                            ],
                        )
                    samples = header[len(REQUIRED_COLUMNS):]
                    if not samples:
                        raise ValidationError("VCF tidak memuat kolom sampel.")
                    dup = sorted({s for s in samples if samples.count(s) > 1})
                    if dup:
                        raise ValidationError(
                            "Terdapat ID sampel ganda pada VCF.", [f"ID ganda: {', '.join(dup)}"]
                        )
                    continue

                if samples is None:
                    if not seen_fileformat:
                        raise ValidationError(
                            "Berkas bukan VCF yang valid.",
                            ["Baris pertama VCF seharusnya '##fileformat=VCFv4.x', "
                             "diikuti baris header #CHROM."],
                        )
                    raise ValidationError(
                        "Baris header #CHROM tidak ditemukan sebelum data varian."
                    )
                cols = line.split("\t")
                if len(cols) != len(REQUIRED_COLUMNS) + len(samples):
                    errors.append(
                        f"Baris {lineno}: jumlah kolom {len(cols)}, seharusnya "
                        f"{len(REQUIRED_COLUMNS) + len(samples)}."
                    )
                    if len(errors) >= MAX_ERRORS:
                        break
                    continue
                if not cols[8].split(":")[0] == "GT":
                    errors.append(f"Baris {lineno}: kolom FORMAT harus diawali GT.")
                    if len(errors) >= MAX_ERRORS:
                        break
                    continue
                try:
                    p = int(cols[1])
                except ValueError:
                    errors.append(f"Baris {lineno}: posisi '{cols[1]}' bukan bilangan bulat.")
                    if len(errors) >= MAX_ERRORS:
                        break
                    continue
                r, a = cols[3].upper(), cols[4].upper()
                if "," in a:
                    skipped["multialelik"] += 1
                    continue
                if len(r) != 1 or len(a) != 1 or r not in "ACGT" or a not in "ACGT":
                    skipped["bukan_snp"] += 1
                    continue
                try:
                    row = [_gt_to_dosage(v) for v in cols[9:]]
                except ValueError as exc:
                    errors.append(f"Baris {lineno}: {exc}.")
                    if len(errors) >= MAX_ERRORS:
                        break
                    continue
                chrom.append(cols[0])
                pos.append(p)
                ids.append(cols[2] if cols[2] != "." else f"{cols[0]}:{p}")
                ref.append(r)
                alt.append(a)
                rows.append(row)
    except (OSError, EOFError, gzip.BadGzipFile) as exc:
        raise ValidationError("Berkas VCF tidak dapat dibaca (mungkin rusak).", [str(exc)])
    except UnicodeDecodeError:
        raise ValidationError("Berkas VCF bukan berkas teks yang valid.")

    if not seen_fileformat and samples is None:
        raise ValidationError(
            "Berkas bukan VCF yang valid.",
            ["Baris pertama VCF seharusnya '##fileformat=VCFv4.x'."],
        )
    if errors:
        raise ValidationError("Isi VCF tidak valid.", errors)
    if samples is None:
        raise ValidationError("Baris header #CHROM tidak ditemukan.")
    if not rows:
        raise ValidationError("VCF tidak memuat SNP bialelik yang dapat dianalisis.")

    dosage = np.asarray(rows, dtype=float).T  # (sampel, snp)
    return GenotypeData(
        samples=samples, chrom=chrom, pos=pos, ids=ids, ref=ref, alt=alt,
        dosage=dosage, skipped={k: v for k, v in skipped.items() if v},
    )
