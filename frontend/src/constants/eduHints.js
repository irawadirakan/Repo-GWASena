/**
 * Katalog Resmi Konten Edukatif GWASena 2.0
 * Acuan: docs/gwasena-v2/DESIGN.md Bagian 8
 */

export const EDU_HINTS = {
  mind: {
    label: 'Missingness per Sampel (mind)',
    defaultValue: 0.10,
    hint: 'Menyaring sampel individu bawang putih yang memiliki terlalu banyak data genotipe kosong/hilang. Nilai 0.10 berarti sampel dengan >10% SNP kosong akan dikeluarkan agar tidak menimbulkan bias.',
  },
  geno: {
    label: 'Missingness per SNP (geno)',
    defaultValue: 0.10,
    hint: 'Menyaring penanda SNP yang gagal terbaca pada banyak sampel. Nilai 0.10 membuang SNP yang hilang pada >10% populasi sampel.',
  },
  maf: {
    label: 'Minor Allele Frequency (maf)',
    defaultValue: 0.05,
    hint: 'Batas frekuensi alel langka minimum. Nilai 0.05 menyaring varian dengan frekuensi <5% karena alel yang terlalu langka memiliki daya statistik rendah dan rentan menghasilkan positif palsu.',
  },
  hwe: {
    label: 'Hardy-Weinberg Equilibrium (hwe)',
    defaultValue: '1e-6',
    hint: 'Menguji penyimpangan frekuensi genotipe dari keseimbangan populasi. Catatan Agronomi Bawang Putih: Karena Allium sativum diperbanyak secara vegetatif (klonal), penyimpangan HWE alami sering terjadi; gunakan ambang longgar (1e-6) agar varian penting tidak terbuang.',
  },
  king_cutoff: {
    label: 'Relatedness / Kinship Cutoff (king_cutoff)',
    defaultValue: 0.177,
    hint: 'Batas koefisien kekerabatan antar-sampel (0.177 setara hubungan derajat pertama / klon dekat). Membantu mengidentifikasi duplikasi klon pada koleksi plasma nutfah.',
  },
  pca: {
    label: 'PCA Otomatis (n_pc = 3)',
    defaultValue: 3,
    hint: 'Principal Component Analysis (PCA) dijalankan secara otomatis setelah tahap QC dan tidak dapat dilewati (FR-04). Komponen utama (PC1–PC3) disertakan sebagai kovariat untuk mengoreksi stratifikasi struktur populasi.',
  },
  glm: {
    label: 'GLM (General Linear Model)',
    hint: 'Menguji asosiasi SNP terhadap sifat fenotipe dengan mengoreksi struktur populasi (kovariat PCA). Komputasi lebih cepat, cocok untuk populasi dengan kekerabatan rendah.',
  },
  mlm: {
    label: 'MLM (Mixed Linear Model)',
    hint: 'Menggabungkan kovariat PCA (efek tetap) DAN matriks kekerabatan genetik / Kinship secara otomatis (efek acak). Sangat direkomendasikan untuk tanaman klonal seperti bawang putih guna menekan positif palsu.',
  },
  bonferroni: {
    label: 'Koreksi Bonferroni',
    hint: 'Koreksi paling ketat (membagi alpha dengan total SNP diuji). Meminimalkan positif palsu secara ekstrem, ideal untuk mendeteksi lokus efek besar utama.',
  },
  fdr: {
    label: 'FDR (False Discovery Rate - Benjamini-Hochberg)',
    hint: 'Mengontrol proporsi temuan positif palsu (q-value). Lebih sensitif dan adaptif dibanding Bonferroni untuk sifat agronomi kuantitatif yang dipengaruhi banyak gen (poligenik).',
  },
};

export const TIPS_EDUKATIF = [
  {
    id: 1,
    judul: 'Genom Raksasa Bawang Putih',
    teks: 'Tahukah Anda? Genom bawang putih (Allium sativum) berukuran sekitar 16 Gigabase—hampir lima kali lebih besar dari genom manusia—dan terdistribusi ke dalam 8 pasang kromosom.',
  },
  {
    id: 2,
    judul: 'Pentingnya Koreksi PCA',
    teks: 'Tanpa koreksi struktur populasi (PCA), perbedaan geografis asal kultivar bawang putih dapat disalahartikan sebagai asosiasi genetik terhadap bobot umbi.',
  },
  {
    id: 3,
    judul: 'Membaca Manhattan Plot',
    teks: 'Pada Manhattan Plot, setiap titik mewakili satu SNP. Semakin tinggi posisi titik pada sumbu Y (-log10 P), semakin kuat bukti statistik asosiasi SNP tersebut dengan sifat fenotipe yang diuji.',
  },
  {
    id: 4,
    judul: 'Mengevaluasi Kualitas via QQ Plot',
    teks: 'QQ Plot membantu memvalidasi kualitas model Anda. Jika titik-titik mengikuti garis lurus di awal lalu melengkung naik tajam hanya di ujung kanan atas, berarti model telah berhasil mengendalikan bias populasi.',
  },
  {
    id: 5,
    judul: 'Sifat Non-Blocking Anotasi Gen',
    teks: 'Setelah uji asosiasi selesai, GWASena memetakan SNP signifikan ke gen kandidat terdekat. Jika server referensi eksternal sedang sibuk, hasil statistik dan grafik Anda tetap aman dan dapat langsung diunduh.',
  },
];
