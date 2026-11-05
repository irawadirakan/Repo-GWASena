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
};

export const TIPS_EDUKATIF = [
  {
    id: 1,
    judul: 'Skala Genomik & Kerapatan Penanda',
    teks: 'Analisis GWAS mengintegrasikan ribuan hingga jutaan varian SNP untuk memetakan arsitektur genetik sifat kuantitatif secara presisi pada aksesi tanaman.',
  },
  {
    id: 2,
    judul: 'Missingness Sampel (mind)',
    teks: 'Ambang batas mind menyaring sampel yang memiliki banyak genotipe kosong agar tidak menimbulkan distorsi pada inferensi alel populasi.',
  },
  {
    id: 3,
    judul: 'Missingness SNP (geno)',
    teks: 'Filter geno membuang penanda SNP yang gagal terbaca pada sebagian besar sampel demi menjaga keandalan statistik pengujian asosiasi.',
  },
  {
    id: 4,
    judul: 'Minor Allele Frequency (maf)',
    teks: 'SNP dengan MAF di bawah 0.05 disaring karena alel yang terlalu langka memiliki kekuatan statistik rendah dan rentan positif palsu.',
  },
  {
    id: 5,
    judul: 'Keseimbangan Hardy-Weinberg (HWE)',
    teks: 'Pada plasma nutfah klonal atau silang khusus, penyimpangan HWE lumrah terjadi sehingga filter ini dianjurkan dinonaktifkan atau dilonggarkan.',
  },
  {
    id: 6,
    judul: 'Koefisien Kekerabatan KING',
    teks: 'Filter KING mendeteksi dan menyaring individu duplikat atau kembar klon agar struktur kekerabatan ekstrem tidak mendistorsi analisis asosiasi.',
  },
  {
    id: 7,
    judul: 'Pentingnya Koreksi PCA',
    teks: 'Dekomposisi PCA PC1–PC3 menyerap stratifikasi geografis aksesi sehingga mencegah korelasi semu antara asal daerah dan sifat fenotipe agronomi.',
  },
  {
    id: 8,
    judul: 'Kelebihan Model GLM',
    teks: 'Model Linier Umum mengoreksi struktur populasi sebagai kovariat tetap dengan komputasi cepat, ideal untuk populasi tanpa kekerabatan klonal kompleks.',
  },
  {
    id: 9,
    judul: 'Keunggulan Model MLM',
    teks: 'Model Linier Campuran memadukan kovariat PCA dan matriks kinship untuk menekan angka positif palsu pada populasi berkerabat dekat.',
  },
  {
    id: 10,
    judul: 'Koreksi Ketat Bonferroni',
    teks: 'Mengendalikan family-wise error rate secara ketat dengan membagi alpha terhadap total SNP, efektif menemukan lokus utama berefek besar.',
  },
  {
    id: 11,
    judul: 'Sensitivitas Koreksi FDR',
    teks: 'False Discovery Rate Benjamini-Hochberg lebih adaptif untuk mendeteksi banyak varian poligenik yang masing-masing berkontribusi kecil pada fenotipe.',
  },
  {
    id: 12,
    judul: 'Membaca Manhattan Plot',
    teks: 'Sumbu Y menampilkan minus log10 p-value; semakin menjulang titik di atas garis batas, semakin kuat bukti signifikansi asosiasi lokus.',
  },
  {
    id: 13,
    judul: 'Evaluasi Deviasi QQ Plot',
    teks: 'Keselarasan titik terhadap garis diagonal menunjukkan pengendalian bias populasi yang baik, dengan lonjakan di ujung atas menandakan asosiasi sejati.',
  },
  {
    id: 14,
    judul: 'Radius Pemetaan Gen Kandidat',
    teks: 'SNP signifikan dipetakan ke gen terdekat dalam radius window 50.000 pasang basa untuk mengidentifikasi fungsi biologis terkait fenotipe.',
  },
  {
    id: 15,
    judul: 'Anotasi Gen Non-Blocking',
    teks: 'Proses anotasi genomik referensi berjalan secara asinkron tanpa memblokir unduhan hasil statistik asosiasi atau visualisasi plot utama Anda.',
  },
];

export const EDU_TIPS = TIPS_EDUKATIF;
