"""Membuat berkas anotasi genom GFF3 CONTOH untuk data dummy bawang putih.

BUKAN anotasi asli: nama dan posisi gen dibuat untuk menguji fitur anotasi (FR-07).
Gen ditempatkan berkala pada chr1-chr8, ditambah satu gen yang sengaja tumpang tindih
dengan SNP berpengaruh snp_chr3_0042 (chr3:22.560.940) dan satu gen di hulunya.
Jalankan dari root repositori:  python tools/buat_anotasi_contoh.py
"""
from pathlib import Path

import numpy as np

rng = np.random.default_rng(2027)
OUT = Path(__file__).resolve().parents[1] / "data" / "contoh" / "anotasi_bawang_putih_contoh.gff3"
PANJANG_KROMOSOM = 36_000_000  # cukup menutup posisi SNP data dummy (kecuali SNP uji QC di chr8)
JARAK_GEN = 1_500_000

genes = []
for c in range(1, 9):
    start, k = 400_000, 0
    while start < PANJANG_KROMOSOM:
        k += 1
        length = int(rng.integers(2_000, 9_000))
        strand = "+" if rng.random() < 0.5 else "-"
        genes.append((f"chr{c}", start, start + length, strand, f"GC{c}G{k:04d}",
                      "Gen contoh buatan untuk pengujian (bukan anotasi asli)"))
        start += JARAK_GEN + int(rng.integers(-200_000, 200_000))

# gen yang sengaja berkaitan dengan snp_chr3_0042 (posisi 22.560.940)
genes += [
    ("chr3", 22_558_100, 22_563_900, "+", "GC3G9001",
     "Gen contoh buatan yang tumpang tindih dengan snp_chr3_0042 (bukan anotasi asli)"),
    ("chr3", 22_590_000, 22_596_500, "-", "GC3G9002",
     "Gen contoh buatan sekitar 29 kb dari snp_chr3_0042 (bukan anotasi asli)"),
]
genes.sort(key=lambda g: (int(g[0][3:]), g[1]))

with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
    fh.write("##gff-version 3\n")
    fh.write("# Anotasi CONTOH untuk data dummy GWASena (Allium sativum). Bukan data biologis.\n")
    for c in range(1, 9):
        fh.write(f"##sequence-region chr{c} 1 {PANJANG_KROMOSOM if c != 8 else 62_000_000}\n")
    for seqid, start, end, strand, gid, desc in genes:
        attrs = f"ID={gid};Name={gid};description={desc.replace(';', '%3B')}"
        fh.write(f"{seqid}\tcontoh\tgene\t{start}\t{end}\t.\t{strand}\t.\t{attrs}\n")

print(f"{len(genes)} gen ditulis ke {OUT}")
