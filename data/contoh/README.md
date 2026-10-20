# Data contoh (DUMMY)

Semua berkas di folder ini **dibuat acak untuk menguji alur program**, bukan data
bawang putih sungguhan. Jangan dipakai untuk kesimpulan biologis.

| Berkas | Isi |
|---|---|
| `genotipe_bawang_putih_mini.vcf` | 40 sampel × 500 SNP (chr1–chr8), dua kelompok asal, ±2% genotipe hilang, 4 SNP yang sengaja gagal QC |
| `fenotipe_bawang_putih_mini.csv` | Pasangan VCF di atas: varietas, bobot_umbi_g, diameter_umbi_mm, jumlah_siung |
| `fenotipe_id_tidak_cocok.csv` | 3 ID sengaja salah, untuk menguji pesan galat pencocokan Sample ID |
| `genotipe_bawang_putih_dummy.vcf`, `fenotipe_bawang_putih_dummy.csv` | Contoh kecil 6 sampel × 12 SNP (terlalu kecil untuk dianalisis) |

SNP **snp_chr3_0042** sengaja dibuat berpengaruh terhadap bobot umbi dan sampel
BP040 sengaja punya banyak data hilang; keduanya dipakai untuk menguji analisis
pada minggu 8.
Data dibuat ulang dengan: `python tools/buat_data_dummy.py`.
