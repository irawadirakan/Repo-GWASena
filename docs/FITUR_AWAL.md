# Fitur awal GWASena (minggu 7)

Fitur awal yang sudah dapat **mengirim dan mengambil data** melalui backend dan
basis data:

| Fitur | Endpoint | Data yang disimpan / diambil | Kebutuhan |
|---|---|---|---|
| Daftar akun | POST /api/auth/register | tabel `users` (kata sandi disimpan dalam bentuk hash) | FR-01 |
| Login | POST /api/auth/login | mencocokkan akun di `users`, membalas token | FR-01 |
| Profil | GET /api/auth/me | data akun yang sedang login | FR-01 |
| Riwayat analisis | GET /api/analyses | daftar `analyses` milik pengguna | FR-12 |
| Buat sesi analisis | POST /api/analyses | baris baru di `analyses` | UC-01 |
| Detail sesi | GET /api/analyses/{id} | `analyses`, `datasets`, daftar sifat dari `phenotypes` | FR-12 |
| Unggah & validasi | POST /api/analyses/{id}/upload | `datasets`, `samples`, `snps`, `genotypes`, `phenotypes`, `analysis_logs` | FR-02, FR-11, BR-01, BR-02 |
| Daftar model | GET /api/analyses/models | `analysis_models` (GLM, MLM) | FR-05 |

Pengguna hanya dapat melihat dan mengubah analisis miliknya sendiri (FR-12, BR-04).
Endpoint parameter, run, status, dan hasil sudah terdaftar tetapi membalas **501**
karena dikerjakan pada minggu 8.

## Validasi saat unggah (FR-11)

Sistem menolak berkas dengan kode **422** dan pesan yang jelas bila:
- format bukan `.vcf`/`.vcf.gz` (genotipe) atau `.csv` (fenotipe);
- header VCF tidak standar, jumlah kolom tidak sesuai, atau genotipe tidak dikenali;
- terdapat ID sampel ganda pada VCF atau CSV;
- CSV tidak memiliki kolom ID sampel atau kolom sifat berupa angka;
- ID sampel pada VCF dan CSV tidak sama (daftar ID yang berbeda ditampilkan).

## Panduan untuk frontend

- **Token**: setelah login simpan `access_token`. Setiap request ke `/api/analyses...`
  wajib membawa header `Authorization: Bearer <token>`.
- **Unggah**: kirim sebagai `multipart/form-data` dengan nama kolom `genotipe`
  (berkas .vcf) dan `fenotipe` (berkas .csv).
- **Pesan galat**: bentuknya `{"detail": {"pesan": "...", "rincian": ["...", "..."]}}`.
  Tampilkan `pesan` pada kotak peringatan dan `rincian` sebagai daftar di bawahnya.
- **Alamat**: cukup panggil `/api/...`; Vite meneruskan ke backend port 8000.

Contoh pemanggilan dari React:

```js
// login
const r = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password }),
});
const { access_token } = await r.json();

// unggah berkas
const form = new FormData();
form.append("genotipe", fileVcf);
form.append("fenotipe", fileCsv);
const up = await fetch(`/api/analyses/${id}/upload`, {
  method: "POST",
  headers: { Authorization: `Bearer ${access_token}` },
  body: form,
});
const data = await up.json();
if (!up.ok) tampilkanGalat(data.detail.pesan, data.detail.rincian);
```

## Cara mencoba di Swagger UI (http://localhost:8000/docs)

1. **POST /api/auth/register** → Try it out → isi username, email, password → Execute.
2. **POST /api/auth/login** → salin nilai `access_token` (tanpa tanda kutip).
3. Klik **Authorize** (ikon gembok) → tempel token → Authorize → Close.
4. **POST /api/analyses** → isi `analysis_name` → catat `analysis_id`.
5. **POST /api/analyses/{analysis_id}/upload** → pilih
   `data/contoh/genotipe_bawang_putih_mini.vcf` dan `data/contoh/fenotipe_bawang_putih_mini.csv`.
   Hasil: 40 sampel, 500 SNP, sifat bobot_umbi_g, diameter_umbi_mm, jumlah_siung.
6. **GET /api/analyses** → analisis tadi muncul dengan status `tervalidasi`.
7. **GET /api/analyses/{analysis_id}** → daftar berkas dan sifat yang tersedia.

Uji galat: ulangi langkah 5 dengan fenotipe `data/contoh/fenotipe_id_tidak_cocok.csv`
→ kode 422 berisi ID yang tidak cocok (BP038, BP039, BP040).

## Perubahan dari rancangan

| Rancangan | Implementasi | Alasan |
|---|---|---|
| Unggah lewat /api/datasets/upload | Dipindah ke /api/analyses/{id}/upload | Berkas selalu terikat pada satu sesi analisis |
| Input VCF atau PLINK biner | Baru VCF/VCF.gz + CSV | PLINK biner menyusul |
| Validasi memakai PLINK 2 | Validasi format ditulis dengan Python | Mudah dijalankan di komputer pengembang tanpa memasang PLINK |
