# GWASena — GitHub Workflow Guidelines

## 1. Tujuan

Dokumen ini menjadi pedoman pengelolaan repository GitHub GWASena untuk menjaga konsistensi pengembangan, mempermudah kolaborasi, dan mempertahankan riwayat kontribusi setiap anggota kelompok.

## 2. Struktur Branch

| Branch | Fungsi |
|---|---|
| `main` | Versi stabil proyek |
| `develop` | Integrasi pekerjaan anggota kelompok |
| `feature/*` | Pengembangan fitur baru |
| `fix/*` | Perbaikan bug |
| `test/*` | Pengujian sistem |

Branch yang sudah digunakan sebelumnya tetap dipertahankan sebagai arsip riwayat pekerjaan kelompok.

## 3. Aturan Pengembangan

1. Pengembangan fitur tidak dilakukan langsung pada `main` atau `develop`.
2. Setiap pekerjaan baru menggunakan branch tersendiri.
3. Branch pekerjaan dibuat dari `develop` terbaru.
4. Setiap perubahan disimpan melalui commit dengan pesan yang jelas.
5. Pekerjaan dikirim ke GitHub melalui Pull Request dengan target `develop`.
6. Perubahan ditinjau sebelum digabungkan.
7. Branch historis tidak dihapus setelah merge.

## 4. Standar Penamaan Branch

Format:

`jenis/nama-pekerjaan`

Contoh:
- `feature/gwas-analysis`
- `feature/gene-annotation`
- `feature/history-page`
- `fix/vcf-validation`
- `test/qc-pipeline`

Gunakan huruf kecil dan tanda hubung untuk memisahkan kata.

## 5. Standar Commit

Gunakan format:

`jenis: deskripsi perubahan`

Contoh:
- `feat: add PCA visualization`
- `fix: resolve VCF validation`
- `docs: update installation guide`
- `test: add QC pipeline tests`
- `refactor: simplify analysis service`
- `chore: update dependencies`

## 6. Alur Pull Request

1. Anggota membuat branch pekerjaan dari `develop`.
2. Anggota mengembangkan fitur atau melakukan perbaikan.
3. Perubahan di-commit dan di-push ke GitHub.
4. Anggota membuat Pull Request dengan base `develop`.
5. Anggota lain melakukan review.
6. Pull Request dapat di-merge setelah disetujui dan pemeriksaan yang diperlukan berhasil.

## 7. Kebijakan Pemeliharaan Branch

Seluruh branch historis dipertahankan untuk mendokumentasikan proses pengembangan dan kontribusi kelompok.

Penghapusan branch tidak menjadi kewajiban setelah merge. Perubahan kebijakan penghapusan branch harus disepakati bersama anggota kelompok.

## 8. Perlindungan Branch Utama

- `main` digunakan untuk versi stabil.
- `develop` digunakan sebagai pusat integrasi.
- Hindari force push pada branch bersama.
- Hindari commit langsung ke branch utama.
- Pastikan perubahan telah ditinjau sebelum integrasi.

Dokumen ini menjadi pedoman kerja bersama bagi seluruh anggota tim pengembangan GWASena.


