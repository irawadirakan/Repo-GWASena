"""Pembaca dan validator genotipe format biner PLINK (.bed + .bim + .fam), FR-02.

Ditulis dengan Python dan numpy saja, tanpa perlu memasang PLINK.

- .fam : satu baris per sampel  -> FID IID ayah ibu jenis_kelamin fenotipe (ID sampel = IID)
- .bim : satu baris per SNP     -> kromosom ID cM posisi A1 A2
- .bed : genotipe, mode SNP-major (3 byte penanda 0x6C 0x1B 0x01), 2 bit per sampel

Dosis yang dihasilkan = jumlah alel A1 (0, 1, 2; hilang = NaN), sama seperti dosis
alel alternatif pada pembaca VCF. A1 diperlakukan sebagai alel alternatif dan A2
sebagai alel referensi, sesuai keluaran `plink2 --make-bed`.
"""
from pathlib import Path

import numpy as np

from pipeline.errors import ValidationError
from pipeline.validation.vcf import MAX_ERRORS, GenotypeData

BED_MAGIC = bytes([0x6C, 0x1B, 0x01])
# kode 2 bit -> jumlah alel A1: 00 homozigot A1, 01 hilang, 10 heterozigot, 11 homozigot A2
_CODE_TO_DOSAGE = np.array([2.0, np.nan, 1.0, 0.0])
_BASES = set("ACGT")


def plink_paths(bed_path: str | Path) -> tuple[Path, Path, Path]:
    bed = Path(bed_path)
    return bed, bed.with_suffix(".bim"), bed.with_suffix(".fam")


def _read_lines(path: Path, label: str) -> list[list[str]]:
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise ValidationError(f"Berkas {label} tidak ditemukan.",
                              [f"Unggah berkas {label} bersama berkas .bed."])
    except UnicodeDecodeError:
        raise ValidationError(f"Berkas {label} bukan berkas teks yang valid.")
    return [line.split() for line in text.splitlines() if line.strip()]


def _read_fam(path: Path) -> list[str]:
    rows = _read_lines(path, ".fam")
    errors = [f"Baris {i}: .fam harus berisi 6 kolom, ditemukan {len(r)}."
              for i, r in enumerate(rows, start=1) if len(r) != 6][:MAX_ERRORS]
    if errors:
        raise ValidationError("Isi berkas .fam tidak valid.", errors)
    if not rows:
        raise ValidationError("Berkas .fam tidak memuat sampel.")
    samples = [r[1] for r in rows]
    dup = sorted({s for s in samples if samples.count(s) > 1})
    if dup:
        raise ValidationError("Terdapat ID sampel ganda pada berkas .fam.", [f"ID ganda: {', '.join(dup)}"])
    return samples


def _read_bim(path: Path):
    rows = _read_lines(path, ".bim")
    if not rows:
        raise ValidationError("Berkas .bim tidak memuat SNP.")
    chrom, ids, pos, a1, a2, errors = [], [], [], [], [], []
    for i, r in enumerate(rows, start=1):
        if len(r) != 6:
            errors.append(f"Baris {i}: .bim harus berisi 6 kolom, ditemukan {len(r)}.")
        else:
            try:
                p = int(r[3])
            except ValueError:
                errors.append(f"Baris {i}: posisi '{r[3]}' bukan bilangan bulat.")
            else:
                chrom.append(r[0])
                ids.append(r[1] if r[1] != "." else f"{r[0]}:{p}")
                pos.append(p)
                a1.append(r[4].upper())
                a2.append(r[5].upper())
        if len(errors) >= MAX_ERRORS:
            break
    if errors:
        raise ValidationError("Isi berkas .bim tidak valid.", errors)
    return chrom, ids, pos, a1, a2


def read_plink(bed_path: str | Path) -> GenotypeData:
    bed, bim, fam = plink_paths(bed_path)
    samples = _read_fam(fam)
    chrom, ids, pos, a1, a2 = _read_bim(bim)
    n, m = len(samples), len(ids)
    per_snp = (n + 3) // 4

    try:
        raw = bed.read_bytes()
    except FileNotFoundError:
        raise ValidationError("Berkas .bed tidak ditemukan.")
    if raw[:3] != BED_MAGIC:
        raise ValidationError(
            "Berkas .bed bukan format biner PLINK yang valid.",
            ["Tiga byte pertama .bed harus 0x6C 0x1B 0x01 (mode SNP-major). "
             "Buat ulang dengan 'plink --make-bed' atau 'plink2 --make-bed'."],
        )
    expected = 3 + m * per_snp
    if len(raw) != expected:
        raise ValidationError(
            "Ukuran berkas .bed tidak cocok dengan .bim dan .fam.",
            [f".bim memuat {m} SNP dan .fam memuat {n} sampel, sehingga .bed seharusnya "
             f"{expected} byte, tetapi berukuran {len(raw)} byte. Pastikan ketiga berkas berasal "
             "dari himpunan data yang sama."],
        )

    packed = np.frombuffer(raw, dtype=np.uint8, offset=3).reshape(m, per_snp)
    # pecah tiap byte menjadi 4 kode 2-bit; sampel pertama ada di bit paling rendah
    codes = np.stack([(packed >> shift) & 0b11 for shift in (0, 2, 4, 6)], axis=2).reshape(m, -1)[:, :n]
    dosage_all = _CODE_TO_DOSAGE[codes].T  # (sampel, snp)

    snp_ok = [a1[j] in _BASES and a2[j] in _BASES and a1[j] != a2[j] for j in range(m)]
    # posisi 0 atau negatif (mis. -9) = SNP belum dipetakan ke genom; tidak bisa diplot/dianotasi
    keep = [j for j in range(m) if snp_ok[j] and pos[j] > 0]
    skipped = {k: v for k, v in {
        "bukan_snp": m - sum(snp_ok),
        "posisi_tidak_diketahui": sum(1 for j in range(m) if snp_ok[j] and pos[j] <= 0),
    }.items() if v}
    if not keep:
        raise ValidationError("Berkas PLINK tidak memuat SNP bialelik yang dapat dianalisis.")

    return GenotypeData(
        samples=samples,
        chrom=[chrom[j] for j in keep],
        pos=[pos[j] for j in keep],
        ids=[ids[j] for j in keep],
        ref=[a2[j] for j in keep],
        alt=[a1[j] for j in keep],
        dosage=dosage_all[:, keep],
        skipped=skipped,
    )


def write_plink(geno: GenotypeData, bed_path: str | Path) -> None:
    """Menulis GenotypeData ke .bed/.bim/.fam. Dipakai untuk pengujian dan konversi data contoh."""
    bed, bim, fam = plink_paths(bed_path)
    n, m = geno.n_samples, geno.n_snps
    fam.write_text("".join(f"{s} {s} 0 0 0 -9\n" for s in geno.samples), encoding="utf-8")
    bim.write_text("".join(f"{geno.chrom[j]}\t{geno.ids[j]}\t0\t{geno.pos[j]}\t{geno.alt[j]}\t{geno.ref[j]}\n"
                           for j in range(m)), encoding="utf-8")
    d = geno.dosage.T  # (snp, sampel)
    codes = np.full(d.shape, 1, dtype=np.uint8)  # bawaan: hilang
    codes[d == 2] = 0
    codes[d == 1] = 2
    codes[d == 0] = 3
    per_snp = (n + 3) // 4
    padded = np.zeros((m, per_snp * 4), dtype=np.uint8)
    padded[:, :n] = codes
    q = padded.reshape(m, per_snp, 4)
    packed = (q[:, :, 0] | (q[:, :, 1] << 2) | (q[:, :, 2] << 4) | (q[:, :, 3] << 6)).astype(np.uint8)
    bed.write_bytes(BED_MAGIC + packed.tobytes())
