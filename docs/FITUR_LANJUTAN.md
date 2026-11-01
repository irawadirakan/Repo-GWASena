# Fitur Lanjutan Backend (Pertemuan 9)

Tiga fitur backend baru. Endpoint lama tidak berubah, jadi frontend yang sudah tersambung tetap berjalan.

| Fitur | Kebutuhan | Endpoint |
|---|---|---|
| Ekspor Manhattan dan QQ plot ke PNG | FR-09, AC-09.1 | `GET /api/analyses/{id}/plots/manhattan/png`, `GET /api/analyses/{id}/plots/qq/png` |
| Unggah genotipe format biner PLINK | FR-02 | `POST /api/analyses/{id}/upload` (field `genotipe` = .bed, ditambah `bim` dan `fam`) |
| Anotasi gen kandidat | FR-07, AC-07.1, AC-07.2 | `GET /api/analyses/{id}/annotation` |

## 1. Ekspor PNG

- Gambar dibuat dari data plot yang sudah tersimpan di `visualization_results`; analisis tidak dijalankan ulang.
- Modul: `pipeline/visualization/png.py` (matplotlib, mode tanpa layar).
- Respons berupa berkas `image/png` dengan nama `gwasena_sesi{id}_{manhattan|qq}.png`.
- Gambar dibuat sekali, disimpan di folder analisis (`plot/manhattan.png`, `plot/qq.png`), dan lokasinya
  dicatat di kolom `visualization_results.file_path` (AC-08.1). Bila analisis dijalankan ulang, gambar dibuat ulang.
- 409 bila analisis belum selesai; 404 untuk jenis selain `manhattan` dan `qq`.
- Paket baru: `matplotlib` (sudah ditambahkan ke `backend/requirements.txt`). matplotlib baru dimuat saat PNG
  diminta, jadi backend tetap menyala walaupun paket ini belum terpasang; endpoint PNG saja yang membalas 503
  dengan petunjuk `pip install -r backend/requirements.txt`.

## 2. Format biner PLINK (.bed/.bim/.fam)

- Modul: `pipeline/validation/plink.py`, ditulis dengan Python dan numpy tanpa memasang PLINK.
- `read_genotype(path)` memilih pembaca dari ekstensi: `.bed` ke PLINK, selain itu VCF.
- Dosis = jumlah alel A1 (A1 dianggap alel alternatif, A2 alel referensi, sesuai `plink2 --make-bed`).
- Validasi: tiga byte penanda .bed, ukuran .bed harus cocok dengan jumlah SNP (.bim) dan sampel (.fam), ID sampel ganda, kolom .bim/.fam.
- `datasets.file_type` bernilai `vcf` atau `plink_bed`.
- Data contoh: `data/contoh/genotipe_bawang_putih_mini.bed`, `.bim`, `.fam` (isi genotipe sama dengan VCF mini).
- Contoh di Swagger: pilih `.bed` pada `genotipe`, `.bim` pada `bim`, `.fam` pada `fam`, dan
  `fenotipe_bawang_putih_mini.csv` pada `fenotipe`.

## 3. Anotasi gen kandidat

- Sumber: berkas anotasi genom GFF3 lokal (`ANNOTATION_GFF3` di `.env`). Ensembl REST API pada rancangan
  awal belum dipakai karena genom bawang putih belum ditemukan di Ensembl Plants (perlu dipastikan kembali).
- Berkas bawaan `data/contoh/anotasi_bawang_putih_contoh.gff3` adalah anotasi **CONTOH** untuk data dummy
  (bukan data biologis), dibuat dengan `python tools/buat_anotasi_contoh.py`. Salah satu gen sengaja
  tumpang tindih dengan `snp_chr3_0042`.
- SNP signifikan dicocokkan dengan gen yang tumpang tindih atau terdekat dalam `ANNOTATION_WINDOW_BP`
  (bawaan 50.000 bp), maksimal 3 gen per SNP.
- Letak SNP memakai istilah Sequence Ontology: `intragenic_variant`, `upstream_gene_variant`,
  `downstream_gene_variant` (memperhitungkan arah untai gen).
- Parameter `sertakan_teratas=true` ikut menganotasi 10 SNP dengan nilai p terkecil; setiap kandidat diberi
  penanda `signifikan` (true/false).
- Bila berkas tidak ada atau rusak: respons 200 dengan `status: "tidak_tersedia"` dan `pesan`, tanpa
  mengganggu hasil analisis lain (AC-07.2).

## Perubahan dari rancangan

| Rancangan sebelumnya | Implementasi | Alasan |
|---|---|---|
| Anotasi gen melalui Ensembl REST API | Anotasi dari berkas GFF3 lokal | Genom bawang putih belum ditemukan di Ensembl Plants; berkas GFF3 dapat diganti dengan anotasi asli tanpa mengubah kode |
| Format PLINK biner dibaca dengan PLINK 2 | Dibaca dengan Python (numpy) | Tidak perlu memasang PLINK di komputer pengembang |

## Pengujian

```
pytest -v
```

Berkas tes baru: `tests/test_ekspor_png.py` (4 kasus), `tests/test_plink.py` (8 kasus), `tests/test_anotasi.py`
(6 kasus). Total 43 kasus uji.
