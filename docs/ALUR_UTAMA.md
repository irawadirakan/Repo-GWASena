# Alur utama UC-01 "Run GWAS Pipeline" (backend)

Alur ini memungkinkan pengguna memasukkan data sampai sistem memberi hasil:

```
login → buat analisis → unggah VCF + CSV → atur parameter → jalankan → pantau status → lihat hasil → unduh CSV
```

## Endpoint

| No | Method | Endpoint | Fungsi | Kebutuhan |
|---|---|---|---|---|
| 0 | POST | /api/auth/register | Daftar akun | FR-01 |
| 0 | POST | /api/auth/login | Login, mendapat token | FR-01 |
| 1 | POST | /api/analyses | Membuat sesi analisis | UC-01 |
| 2 | POST | /api/analyses/{id}/upload | Unggah VCF + CSV, validasi format, cocokkan Sample ID | FR-02, FR-11, BR-01, BR-02 |
| 3 | PUT | /api/analyses/{id}/parameters | Simpan parameter QC, model, PC, koreksi | FR-03, FR-05, BR-03 |
| 4 | POST | /api/analyses/{id}/run | Menjalankan QC → PCA → GLM atau MLM → koreksi di latar belakang | FR-03–FR-06, NFR-02 |
| 5 | GET | /api/analyses/{id}/status | Status per tahap, progres, galat, tips edukatif | FR-10, BR-05 |
| 6 | GET | /api/analyses/{id}/results | Ringkasan QC, PCA, SNP signifikan, SNP teratas | FR-06 |
| 7 | GET | /api/analyses/{id}/results/csv | Unduh hasil asosiasi CSV | FR-09 |
| – | GET | /api/analyses/{id}/plots/{manhattan\|qq\|pca} | Data titik untuk grafik (dipakai frontend) | FR-08 |
| – | GET | /api/analyses | Daftar analisis milik pengguna | FR-12 |

Semua endpoint analisis memerlukan login, dan pengguna hanya dapat membuka analisis
miliknya sendiri (FR-12, BR-04).

## Cara mencoba di Swagger UI (http://localhost:8000/docs)

1. **POST /api/auth/register** → Try it out → isi username, email, password → Execute.
2. **POST /api/auth/login** → isi username dan password → Execute → salin nilai `access_token`.
3. Klik tombol **Authorize** (gembok, kanan atas) → tempel token → Authorize → Close.
4. **POST /api/analyses** → isi `analysis_name` → catat `analysis_id` pada respons.
5. **POST /api/analyses/{analysis_id}/upload** → isi analysis_id → pilih berkas:
   - genotipe: `data/contoh/genotipe_bawang_putih_mini.vcf`
   - fenotipe: `data/contoh/fenotipe_bawang_putih_mini.csv`
6. **PUT /api/analyses/{analysis_id}/parameters** → body minimal `{"trait": "bobot_umbi_g"}` (GLM),
   atau `{"trait": "bobot_umbi_g", "model": "MLM"}`.
7. **POST /api/analyses/{analysis_id}/run** → respons 202.
8. **GET /api/analyses/{analysis_id}/status** → tunggu sampai `status` = `selesai`.
9. **GET /api/analyses/{analysis_id}/results** → lihat `qc`, `asosiasi`, `snp_signifikan`.
10. **GET /api/analyses/{analysis_id}/results/csv** → klik *Download file*.

Hasil yang diharapkan dengan data contoh: 40 sampel → 39 lolos QC (BP040 tersaring
karena banyak data hilang), 500 SNP → 491 lolos, dan **snp_chr3_0042** muncul sebagai
SNP signifikan, baik dengan GLM maupun MLM. Pada MLM, hasil juga memuat
`komponen_varians` (varians genetik, varians galat, dan pseudo-heritabilitas).

Untuk mencoba penanganan galat (FR-11), ulangi langkah 5 dengan fenotipe
`data/contoh/fenotipe_id_tidak_cocok.csv`: sistem menolak dengan kode 422 dan
menampilkan daftar ID yang tidak cocok.

## Cara eksekusi

`PIPELINE_MODE=auto` (bawaan): bila Celery worker menyala, analisis dikirim ke worker;
bila tidak, analisis dijalankan di latar belakang FastAPI. Respons `run` memuat
`mode_eksekusi` (`celery` atau `background`). Menyalakan worker (opsional):

```
celery -A backend.tasks.celery_app:celery_app worker --loglevel=info --pool=solo
```

## Keputusan implementasi yang perlu dicatat di progress report

| Rancangan | Implementasi minggu ini | Alasan |
|---|---|---|
| QC dan PCA dengan PLINK 2; GLM/MLM dengan GAPIT | QC, PCA, GLM, dan koreksi dihitung dengan Python (numpy/scipy) di folder pipeline/ | Lebih mudah dijalankan di komputer pengembang; struktur per tahap disiapkan agar dapat diganti PLINK 2/GAPIT tanpa mengubah API |
| MLM dengan GAPIT | MLM dengan kinship VanRaden dan komponen varians REML yang diestimasi sekali (pendekatan P3D/EMMAX, seperti mode cepat GAPIT) | Dapat dijalankan tanpa R; tetap memperhitungkan kekerabatan |
| Input VCF atau PLINK biner | Baru VCF/VCF.gz + CSV | PLINK biner menyusul |
| Filter HWE dan relatedness aktif | Tersedia, tetapi nonaktif secara bawaan | Bawang putih umumnya diperbanyak klonal |
| Unggah lewat /api/datasets/upload | Dipindah ke /api/analyses/{id}/upload | Berkas selalu terikat pada satu sesi analisis |
| Uji HWE | Uji chi-square (bukan uji eksak PLINK) | Penyederhanaan versi Python |
