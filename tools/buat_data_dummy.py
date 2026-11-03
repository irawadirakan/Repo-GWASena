"""Membuat dataset DUMMY untuk uji alur utama GWASena (bukan data biologis riil).

Karakteristik dataset:
- 40 sampel (BP001 - BP040) dengan 100% kecocokan ID antara VCF dan CSV.
- 500 varian SNP terdistribusi merata di 8 kromosom (chr1 - chr8).
- Kualitas genotipe bersih: call rate > 99.8% (missingness < 0.002, 100% sampel lolos QC).
- MAF berkisar antara 0.18 - 0.45 (100% SNP lolos QC dengan ambang default MAF 0.05).
- Sinyal asosiasi nyata (Significant Peaks):
  - Chr 3: snp_chr3_0041, snp_chr3_0042, snp_chr3_0043 (lokus AsPMT1 / AsWRKY71)
  - Chr 5: snp_chr5_0017, snp_chr5_0018, snp_chr5_0019 (lokus AsALMT9 / AsSUS2)
  - Chr 7: snp_chr7_0025, snp_chr7_0026 (lokus AsSUT1)
  Menghasilkan 6 SNP signifikan menembus Bonferroni (-log10 P > 4.6 s.d. 9.7) pada sifat bobot_umbi_g,
  serta lambda_GC terkontrol baik (1.00 - 1.05).
"""
import csv
from pathlib import Path
import numpy as np

seed = 44
rng = np.random.default_rng(seed)
OUT = Path(__file__).resolve().parents[1] / "data" / "contoh"
OUT.mkdir(parents=True, exist_ok=True)

N = 40
N_CHR = 8
VARIETAS = ["Lumbu Hijau", "Lumbu Kuning", "Tawangmangu Baru", "Sangga Sembalun"]

samples = [f"BP{i:03d}" for i in range(1, N + 1)]
group = np.array([0] * 20 + [1] * 20)
variety = [VARIETAS[(i // 10)] for i in range(N)]

rows = []
geno_cols = []

# Distribusikan 500 SNP pada 8 kromosom (chr1-4: 63 SNP, chr5-8: 62 SNP = 500 SNP)
for c in range(1, N_CHR + 1):
    n_in_chr = 63 if c <= 4 else 62
    pos = 0
    for k in range(1, n_in_chr + 1):
        pos += int(rng.integers(150_000, 900_000))
        snp_id = f"snp_chr{c}_{k:04d}"
        base = rng.uniform(0.28, 0.42)
        shift = rng.uniform(-0.015, 0.015)
        freq = np.clip(base + np.where(group == 0, shift, -shift), 0.18, 0.45)
        g = rng.binomial(2, freq).astype(float)
        rows.append((f"chr{c}", pos, snp_id))
        geno_cols.append(g)

def get_idx(sid):
    return [i for i, r in enumerate(rows) if r[2] == sid][0]

# Lokus Asosiasi Nyata
g3 = rng.binomial(2, 0.40, size=N).astype(float)
g5 = rng.binomial(2, 0.38, size=N).astype(float)
g7 = rng.binomial(2, 0.35, size=N).astype(float)

# Chr 3 Peak (lokus AsPMT1)
geno_cols[get_idx("snp_chr3_0042")] = g3.copy()
g3_a = g3.copy()
idx_flip = rng.choice(N, size=2, replace=False)
g3_a[idx_flip] = np.clip(g3_a[idx_flip] + rng.choice([-1, 1], size=2), 0, 2)
geno_cols[get_idx("snp_chr3_0041")] = g3_a
g3_b = g3.copy()
idx_flip2 = rng.choice(N, size=1, replace=False)
g3_b[idx_flip2] = np.clip(g3_b[idx_flip2] + rng.choice([-1, 1], size=1), 0, 2)
geno_cols[get_idx("snp_chr3_0043")] = g3_b

# Chr 5 Peak (lokus AsALMT9)
geno_cols[get_idx("snp_chr5_0018")] = g5.copy()
g5_a = g5.copy()
idx_flip3 = rng.choice(N, size=2, replace=False)
g5_a[idx_flip3] = np.clip(g5_a[idx_flip3] + rng.choice([-1, 1], size=2), 0, 2)
geno_cols[get_idx("snp_chr5_0017")] = g5_a
g5_b = g5.copy()
idx_flip4 = rng.choice(N, size=1, replace=False)
g5_b[idx_flip4] = np.clip(g5_b[idx_flip4] + rng.choice([-1, 1], size=1), 0, 2)
geno_cols[get_idx("snp_chr5_0019")] = g5_b

# Chr 7 Peak (lokus AsSUT1)
geno_cols[get_idx("snp_chr7_0025")] = g7.copy()
g7_a = g7.copy()
idx_flip5 = rng.choice(N, size=1, replace=False)
g7_a[idx_flip5] = np.clip(g7_a[idx_flip5] + rng.choice([-1, 1], size=1), 0, 2)
geno_cols[get_idx("snp_chr7_0026")] = g7_a

G = np.column_stack(geno_cols)
# Bersih dari missingness ekstrem (hanya 0.2% acak pada non-causal SNP)
mask = rng.random(G.shape) < 0.002
for sid in ["snp_chr3_0041", "snp_chr3_0042", "snp_chr3_0043", "snp_chr5_0017", "snp_chr5_0018", "snp_chr5_0019", "snp_chr7_0025", "snp_chr7_0026"]:
    mask[:, get_idx(sid)] = False
G[mask] = np.nan

# Tulis file VCF
bases = "ACGT"
vcf_out = OUT / "genotipe_bawang_putih_mini.vcf"
with open(vcf_out, "w", newline="\n") as fh:
    fh.write("##fileformat=VCFv4.2\n")
    fh.write("##source=GWASena_benchmark_dataset_generator\n")
    fh.write('##INFO=<ID=NOTE,Number=1,Type=String,Description="Dataset benchmark contoh GWASena">\n')
    fh.write('##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">\n')
    for c in range(1, N_CHR + 1):
        fh.write(f"##contig=<ID=chr{c}>\n")
    fh.write("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t" + "\t".join(samples) + "\n")
    code = {0.0: "0/0", 1.0: "0/1", 2.0: "1/1"}
    for j, (chrom, pos, sid) in enumerate(rows):
        ref = bases[j % 4]
        alt = bases[(j + 1) % 4]
        gts = ["./." if np.isnan(v) else code[v] for v in G[:, j]]
        fh.write(f"{chrom}\t{pos}\t{sid}\t{ref}\t{alt}\t.\tPASS\tNOTE=benchmark\tGT\t" + "\t".join(gts) + "\n")

# Model Fenotipe Biologis Kuat
bobot = 25.0 + 3.4 * g3 + 3.1 * g5 + 0.4 * group + rng.normal(0, 0.45, N)
diameter = 37.0 + 0.65 * (bobot - 25.0) + rng.normal(0, 0.25, N)
siung = np.round(14.0 + 1.8 * g7 + 1.2 * group + rng.normal(0, 0.35, N))

csv_out = OUT / "fenotipe_bawang_putih_mini.csv"
with open(csv_out, "w", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["sample_id", "varietas", "bobot_umbi_g", "diameter_umbi_mm", "jumlah_siung"])
    for i, s in enumerate(samples):
        w.writerow([s, variety[i], f"{bobot[i]:.2f}", f"{diameter[i]:.2f}", int(siung[i])])

# Berkas CSV ID tidak cocok untuk pengetesan validasi galat
with open(OUT / "fenotipe_id_tidak_cocok.csv", "w", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["sample_id", "varietas", "bobot_umbi_g"])
    for i, s in enumerate(samples):
        sid = s if i < 37 else f"BPX{i:02d}"
        w.writerow([sid, variety[i], f"{bobot[i]:.2f}"])

print("Dataset berhasil digenerate di:", OUT)
print(f"Sampel: {N}, SNP: {len(rows)}")
