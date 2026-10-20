"""Membuat dataset DUMMY bawang putih untuk uji alur utama (bukan data biologis).

40 sampel x 500 SNP pada chr1-chr8, dua kelompok asal (struktur populasi),
sedikit genotipe hilang, dan satu SNP berpengaruh (snp_chr3_0042) terhadap
bobot umbi. Jalankan dari root repositori:  python tools/buat_data_dummy.py
"""
import csv
from pathlib import Path

import numpy as np

rng = np.random.default_rng(2026)
OUT = Path(__file__).resolve().parents[1] / "data" / "contoh"
N, M_PER_CHR, N_CHR = 40, 62, 8   # 62 x 8 = 496 SNP + 4 SNP "bermasalah"
VARIETAS = ["Lumbu Hijau", "Lumbu Kuning", "Tawangmangu Baru", "Sangga Sembalun"]

samples = [f"BP{i:03d}" for i in range(1, N + 1)]
group = np.array([0] * 20 + [1] * 20)               # dua kelompok asal
variety = [VARIETAS[(i // 10)] for i in range(N)]

rows, geno_cols = [], []
causal_col = None
for c in range(1, N_CHR + 1):
    pos = 0
    for k in range(M_PER_CHR):
        pos += int(rng.integers(150_000, 900_000))
        base = rng.uniform(0.1, 0.5)
        shift = rng.uniform(-0.15, 0.15)
        freq = np.clip(base + np.where(group == 0, shift, -shift), 0.02, 0.98)
        g = rng.binomial(2, freq).astype(float)
        snp_id = f"snp_chr{c}_{k + 1:04d}"
        if c == 3 and k + 1 == 42:
            g = rng.binomial(2, np.full(N, 0.4)).astype(float)
            causal_col = len(geno_cols)
        rows.append((f"chr{c}", pos, snp_id))
        geno_cols.append(g)

# 4 SNP yang seharusnya tersaring QC
extra = [
    ("chr8", 60_000_000, "snp_qc_monomorfik", np.zeros(N)),                     # MAF = 0
    ("chr8", 60_500_000, "snp_qc_maf_rendah", np.r_[1.0, np.zeros(N - 1)]),     # MAF ~ 0,0125
    ("chr8", 61_000_000, "snp_qc_banyak_hilang", np.where(np.arange(N) < 10, np.nan, 1.0)),
    ("chr8", 61_500_000, "snp_qc_heterozigot", np.ones(N)),                     # gagal HWE
]
for chrom, pos, sid, g in extra:
    rows.append((chrom, pos, sid))
    geno_cols.append(g.astype(float))

G = np.column_stack(geno_cols)
# genotipe hilang acak (~2%), dan satu sampel dengan banyak data hilang
mask = rng.random(G.shape) < 0.02
G[mask] = np.nan
G[39, rng.choice(G.shape[1], size=120, replace=False)] = np.nan   # BP040 ~24% hilang

bases = "ACGT"
with open(OUT / "genotipe_bawang_putih_mini.vcf", "w", newline="\n") as fh:
    fh.write("##fileformat=VCFv4.2\n##source=GWASena_dummy_generator\n")
    fh.write('##INFO=<ID=NOTE,Number=1,Type=String,Description="Data dummy untuk uji alur, bukan data biologis">\n')
    fh.write('##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">\n')
    for c in range(1, N_CHR + 1):
        fh.write(f"##contig=<ID=chr{c}>\n")
    fh.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t" + "\t".join(samples) + "\n")
    code = {0.0: "0/0", 1.0: "0/1", 2.0: "1/1"}
    for j, (chrom, pos, sid) in enumerate(rows):
        ref = bases[j % 4]
        alt = bases[(j + 1) % 4]
        gts = ["./." if np.isnan(v) else code[v] for v in G[:, j]]
        fh.write(f"{chrom}\t{pos}\t{sid}\t{ref}\t{alt}\t.\tPASS\tNOTE=dummy\tGT\t" + "\t".join(gts) + "\n")

g_causal = np.nan_to_num(G[:, causal_col], nan=np.nanmean(G[:, causal_col]))
bobot = 25 + 4.0 * g_causal + 3.0 * group + rng.normal(0, 1.5, N)
diameter = 38 + 0.6 * (bobot - 25) + rng.normal(0, 1.0, N)
siung = np.round(14 + 2 * group + rng.normal(0, 1.5, N))

with open(OUT / "fenotipe_bawang_putih_mini.csv", "w", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["sample_id", "varietas", "bobot_umbi_g", "diameter_umbi_mm", "jumlah_siung"])
    for i, s in enumerate(samples):
        b = "NA" if i == 7 else f"{bobot[i]:.1f}"     # satu nilai fenotipe hilang
        w.writerow([s, variety[i], b, f"{diameter[i]:.1f}", int(siung[i])])

# CSV dengan ID tidak cocok, untuk menguji pesan galat (FR-11, AC-02.3)
with open(OUT / "fenotipe_id_tidak_cocok.csv", "w", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["sample_id", "varietas", "bobot_umbi_g"])
    for i, s in enumerate(samples):
        sid = s if i < 37 else f"BPX{i:02d}"
        w.writerow([sid, variety[i], f"{bobot[i]:.1f}"])

print("Selesai:", OUT)
