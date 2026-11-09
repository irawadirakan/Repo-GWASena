/**
 * Katalog Resmi Konten Edukatif GWASena
 * Acuan: Panduan Parameter Ilmiah GWASena Design System
 */

export const EDU_HINTS = {
  mind: {
    label: 'Missingness per Sampel (mind)',
    defaultValue: 0.10,
    hint: 'Menyaring sampel individu yang memiliki proporsi data genotipe hilang (missing) melebihi batas toleransi. Nilai 0.10 berarti sampel dengan >10% SNP kosong akan dikeluarkan agar tidak menimbulkan bias.',
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
    hint: 'Menguji penyimpangan frekuensi genotipe dari keseimbangan populasi. Pada populasi klonal, vegetatif, atau hasil seleksi buatan, penyimpangan HWE alami lumrah terjadi sehingga filter ini disarankan nonaktif atau menggunakan ambang longgar (1e-6).',
  },
  king_cutoff: {
    label: 'Relatedness / Kinship Cutoff (king_cutoff)',
    defaultValue: 0.177,
    hint: 'Batas koefisien kekerabatan antar-sampel (0.177 setara hubungan derajat pertama / klon dekat). Membantu mengidentifikasi duplikasi klon pada koleksi plasma nutfah.',
  },
  pca: {
    label: 'PCA Otomatis (n_pc = 3)',
    defaultValue: 3,
    hint: 'Principal Component Analysis (PCA) dijalankan secara otomatis setelah tahap QC. Komponen utama (PC1–PC3) disertakan sebagai kovariat untuk mengoreksi stratifikasi struktur populasi.',
  },
  glm: {
    label: 'GLM (General Linear Model)',
    hint: 'Menguji asosiasi SNP terhadap sifat fenotipe dengan mengoreksi struktur populasi (kovariat PCA). Komputasi lebih cepat, cocok untuk populasi dengan kekerabatan rendah.',
  },
  mlm: {
    label: 'MLM (Mixed Linear Model)',
    hint: 'Menggabungkan kovariat PCA (efek tetap) dan matriks kekerabatan genetik / Kinship secara otomatis (efek acak). Sangat direkomendasikan untuk populasi dengan struktur kekerabatan kompleks atau klonal guna menekan positif palsu.',
  },
  bonferroni: {
    label: 'Koreksi Bonferroni',
    hint: 'Koreksi paling ketat (membagi alpha dengan total SNP diuji). Meminimalkan positif palsu secara ekstrem, ideal untuk mendeteksi lokus efek besar utama.',
  },
  fdr: {
    label: 'FDR (False Discovery Rate - Benjamini-Hochberg)',
    hint: 'Mengontrol proporsi temuan positif palsu (q-value). Lebih sensitif dan adaptif dibanding Bonferroni untuk sifat agronomi kuantitatif yang dipengaruhi banyak gen (poligenik).',
  },
  alpha: {
    label: 'Ambang Alpha Signifikansi (α)',
    defaultValue: 0.05,
    hint: 'Tingkat signifikansi statistik (Type I Error Rate) yang menentukan batas penolakan hipotesis nol. Nilai default 0.05 lazim digunakan. Nilai 0.01 lebih ketat untuk menekan temuan positif palsu, sedangkan 0.10 bersifat eksploratori untuk mendeteksi sinyal asosiasi yang lebih lemah pada sifat poligenik kompleks.',
  },
};

export const TIPS_EDUKATIF = [
  {
    id: 1,
    judul: '1. Konsep Utama Genome-Wide Association Study (GWAS)',
    teks: 'GWAS menguji korelasi statistik antara ratusan ribu penanda SNP di seluruh genom dengan keragaman sifat fenotipe target untuk menemukan lokus sifat kuantitatif (QTL).',
  },
  {
    id: 2,
    judul: '2. Minor Allele Frequency (MAF)',
    teks: 'Ambang batas MAF (umumnya 0.05) menyaring varian alel yang sangat langka. Alel berfrekuensi rendah rentan terhadap kesalahan sekuensing dan menurunkan kekuatan statistik pengujian.',
  },
  {
    id: 3,
    judul: '3. Pengendalian Missingness (mind & geno)',
    teks: 'Penyaringan missingness memastikan integritas matriks data. Sampel dan penanda SNP dengan proporsi data hilang lebih dari 10% disaring agar imputasi genotipe tidak terdistorsi.',
  },
  {
    id: 4,
    judul: '4. Kesetimbangan Hardy-Weinberg (HWE)',
    teks: 'Deviasi ekstrem dari HWE pada populasi alami sering mencerminkan galat genotyping atau duplikasi segmental genom. Pada populasi persilangan buatan atau tanaman klonal, filter ini dinonaktifkan.',
  },
  {
    id: 5,
    judul: '5. Koefisien Kekerabatan KING (kinship)',
    teks: 'Algoritma KING mengestimasi hubungan kekerabatan antar-aksesi secara tangguh tanpa mengasumsikan frekuensi alel homogen, mencegah duplikasi sampel atau klon identik.',
  },
  {
    id: 6,
    judul: '6. Stratifikasi Populasi & Kovariat PCA',
    teks: 'PCA mengekstraksi variasi genetik geografis terbesar ke dalam komponen utama (PC1–PC3). Memasukkan PC sebagai kovariat mencegah temuan asosiasi positif palsu (spurious associations).',
  },
  {
    id: 7,
    judul: '7. Karakteristik Model GLM',
    teks: 'General Linear Model (GLM) mengoreksi struktur populasi menggunakan kovariat tetap (PC1–PC3). Model ini efisien secara komputasi dan cocok untuk populasi terstruktur sederhana.',
  },
  {
    id: 8,
    judul: '8. Keunggulan Model Campuran (MLM)',
    teks: 'Mixed Linear Model (MLM / Q+K) mengintegrasikan matriks kekerabatan kinship sebagai efek acak di samping efek tetap PCA, mengontrol latar belakang genetik kompleks dengan sangat kuat.',
  },
  {
    id: 9,
    judul: '9. Peran Efek Tetap vs Efek Acak',
    teks: 'Dalam MLM, efek tetap mengestimasi koefisien regresi alel SNP dan kovariat utama, sedangkan efek acak memodelkan kovarians politeknik yang tidak teramati di antara semua individu.',
  },
  {
    id: 10,
    judul: '10. Evaluasi Inflasi Genomik (Lambda GC)',
    teks: 'Faktor inflasi genomik (λ GC) ideal bernilai mendekati 1.00 (toleransi ≤ 1.05). Nilai λ > 1.10 menandakan adanya bias stratifikasi yang belum terkoreksi secara sempurna oleh model.',
  },
  {
    id: 11,
    judul: '11. Anatomi & Sumbu Manhattan Plot',
    teks: 'Sumbu X menampilkan posisi fisik SNP sepanjang kromosom, sementara sumbu Y adalah -log10(p-value). Puncak sinyal pencakar langit mengindikasikan lokus dengan bukti asosiasi terkuat.',
  },
  {
    id: 12,
    judul: '12. Validasi Model via Quantile-Quantile (QQ) Plot',
    teks: 'QQ Plot membandingkan distribusi p-value empiris terhadap distribusi teoretis seragam (null hypothesis). Penyimpangan tajam di ujung kanan menandakan sinyal asosiasi sejati.',
  },
  {
    id: 13,
    judul: '13. Ambang Ketat Koreksi Bonferroni',
    teks: 'Koreksi Bonferroni (alpha / total SNP) mengendalikan Family-Wise Error Rate (FWER) secara sangat ketat. Cocok untuk memastikan penanda SNP yang dilaporkan benar-benar lolos uji ketat.',
  },
  {
    id: 14,
    judul: '14. Adaptabilitas False Discovery Rate (FDR)',
    teks: 'Metode Benjamini-Hochberg (FDR) mengontrol proporsi penemuan positif palsu (q-value). Sangat ideal untuk mendeteksi penanda pada sifat agronomi yang dipengaruhi banyak lokus minor (poligenik).',
  },
  {
    id: 15,
    judul: '15. Linkage Disequilibrium & Anotasi Gen GFF3',
    teks: 'SNP penanda tidak selalu merupakan mutasi kausal langsung, melainkan berada dalam ketidakseimbangan pautan (LD) dengan kandidat gen fungsional di sekitarnya dalam jendela ±50 kb.',
  },
];

// Alias untuk kompatibilitas penuh (Evaluasi Tester Poin 17)
export const EDUCATIONAL_TIPS = TIPS_EDUKATIF;
