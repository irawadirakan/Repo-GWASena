# GWASena

**GWASena** merupakan platform berbasis web yang interaktif dan edukatif untuk melakukan analisis asosiasi genom pada bawang putih (*Allium sativum* L.).

Proyek ini dikembangkan sebagai bagian dari mata kuliah **BIF 1322 Pembangunan Perangkat Lunak**, IPB University, Kelompok 04.

## Teknologi yang Digunakan

| Lapisan | Teknologi |
|---|---|
| Frontend | React + Vite |
| Backend | FastAPI (Python) |
| Basis Data | PostgreSQL 16 (JSONB) |
| Antrean Tugas | Redis + Celery |
| Engine Bioinformatika | Python (NumPy, SciPy) |
| Analisis | Validasi data, Quality Control (QC), PCA, GLM, MLM, dan koreksi |

## Menjalankan Proyek di Komputer Lokal

### Prasyarat

Pastikan perangkat telah memiliki:
- Git
- Python 3.11 atau 3.12
- Node.js 20 LTS
- Docker Desktop

Panduan instalasi lengkap dan pemecahan masalah tersedia di [`docs/SETUP_LOKAL.md`](docs/SETUP_LOKAL.md).

### 1. Clone Repository

```bash
git clone https://github.com/irawadirakan/Repo-GWASena.git
cd Repo-GWASena
```

### 2. Konfigurasi Environment

Salin file konfigurasi:

```bash
cp .env.example .env
```

Untuk Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Sesuaikan konfigurasi `.env` dengan kebutuhan lingkungan lokal.

### 3. Jalankan PostgreSQL dan Redis

```bash
docker compose up -d
```

### 4. Jalankan Backend

Buka terminal pertama dari direktori utama repository.

Buat dan aktifkan virtual environment:

```bash
python -m venv .venv
```

Aktifkan pada Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Aktifkan pada Linux atau macOS:

```bash
source .venv/bin/activate
```

Instal dependensi dan jalankan backend:

```bash
pip install -r backend/requirements-dev.txt
uvicorn backend.main:app --reload
```

Dokumentasi API dapat diakses melalui:

http://localhost:8000/docs

### 5. Jalankan Frontend

Buka terminal kedua:

```bash
cd frontend
npm install
npm run dev
```

Frontend dapat diakses melalui:

http://localhost:5173

### Indikator Keberhasilan

Proyek berhasil dijalankan apabila halaman frontend dapat dibuka dan indikator koneksi API, basis data, serta Redis menampilkan status **Terhubung**.

### Alternatif Menjalankan dengan Docker

Untuk menjalankan seluruh layanan melalui Docker Compose:

```bash
docker compose --profile full up --build
```

## Struktur Repository

Berikut struktur utama repository GWASena:

```text
Repo-GWASena/
│
├── .github/
│   └── workflows/       # Konfigurasi GitHub Actions
│
├── assets/              # Aset pendukung proyek
├── backend/             # Aplikasi backend FastAPI
├── data/                # Data pendukung dan data pengujian
├── docker/              # Konfigurasi Docker per layanan
├── docs/                # Dokumentasi proyek dan panduan
├── frontend/            # Aplikasi frontend React + Vite
├── pipeline/            # Engine analisis bioinformatika
├── scratch/             # Area kerja sementara
├── storage/             # Penyimpanan berkas aplikasi
├── tests/               # Pengujian sistem menggunakan pytest
├── tools/               # Perangkat bantu pengembangan
│
├── .env.example         # Template konfigurasi environment
├── .gitattributes       # Konfigurasi atribut Git
├── .gitignore           # Daftar file yang diabaikan Git
├── docker-compose.yml   # Konfigurasi layanan Docker
├── GITHUB_WORKFLOW.md   # Pedoman kolaborasi GitHub
├── pytest.ini           # Konfigurasi pytest
└── README.md            # Dokumentasi utama proyek
```

Folder dan file seperti `node_modules/`, `.pytest_cache/`, serta `.env` merupakan kebutuhan lokal atau hasil proses pengembangan sehingga tidak dicantumkan sebagai bagian dari struktur sumber utama.

## Alur Analisis GWAS

GWASena dikembangkan untuk mendukung proses analisis asosiasi genom melalui beberapa tahapan utama:

1. Autentikasi pengguna.
2. Pengunggahan dan validasi data genotipe serta fenotipe.
3. Quality Control (QC).
4. Principal Component Analysis (PCA).
5. Analisis asosiasi menggunakan General Linear Model (GLM) dan Mixed Linear Model (MLM).
6. Koreksi pengujian berganda.
7. Visualisasi dan pengunduhan hasil analisis.

## Endpoint API

Endpoint utama yang tersedia meliputi:

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/health` | Memeriksa status API, PostgreSQL, dan Redis |
| GET | `/api/meta` | Informasi organisme target dan status modul |
| POST | `/api/auth/register` | Registrasi pengguna |
| POST | `/api/auth/login` | Login pengguna |
| GET | `/api/auth/me` | Informasi pengguna yang sedang login |
| GET | `/api/analyses` | Mengambil daftar analisis |
| POST | `/api/analyses` | Membuat sesi analisis |
| POST | `/api/analyses/{id}/upload` | Mengunggah dan memvalidasi VCF serta CSV |
| PUT | `/api/analyses/{id}/parameters` | Mengatur parameter QC dan model |
| POST | `/api/analyses/{id}/run` | Menjalankan pipeline analisis |
| GET | `/api/analyses/{id}/status` | Memeriksa status analisis |
| GET | `/api/analyses/{id}/results` | Mengambil hasil analisis |
| GET | `/api/analyses/{id}/results/csv` | Mengunduh hasil dalam format CSV |
| GET | `/api/analyses/{id}/plots/{jenis}` | Mengambil visualisasi hasil |

Dokumentasi interaktif API tersedia melalui Swagger UI:

http://localhost:8000/docs

Dokumentasi alur penggunaan sistem dapat dilihat pada:
- [`docs/ALUR_UTAMA.md`](docs/ALUR_UTAMA.md)
- [`docs/FITUR_AWAL.md`](docs/FITUR_AWAL.md)
- [`docs/SETUP_LOKAL.md`](docs/SETUP_LOKAL.md)

## Alur Kerja Git dan Kolaborasi

Pengembangan GWASena menggunakan strategi branch untuk memisahkan versi stabil, integrasi, dan pekerjaan masing-masing anggota.

| Branch | Fungsi |
|---|---|
| `main` | Versi stabil proyek |
| `develop` | Integrasi pekerjaan seluruh anggota |
| `feature/*` | Pengembangan fitur baru |
| `fix/*` | Perbaikan bug |
| `test/*` | Pengujian sistem |

### Alur Pengembangan

```text
develop
   │
   ├── feature/nama-fitur
   │
   ├── fix/nama-perbaikan
   │
   └── test/nama-pengujian
           │
           ▼
      Pull Request
           │
           ▼
         Review
           │
           ▼
     Merge ke develop
           │
           ▼
     Rilis stabil ke main
```

### Perintah Dasar Git

Memulai pekerjaan baru:

```bash
git switch develop
git pull origin develop
git switch -c feature/nama-fitur
```

Menyimpan perubahan:

```bash
git add .
git commit -m "feat: deskripsi perubahan"
git push -u origin feature/nama-fitur
```

Setiap pekerjaan yang telah selesai diajukan melalui Pull Request dengan target `develop`.

### Standar Commit

| Prefix | Penggunaan |
|---|---|
| `feat:` | Penambahan fitur |
| `fix:` | Perbaikan bug |
| `docs:` | Perubahan dokumentasi |
| `test:` | Penambahan atau perubahan pengujian |
| `refactor:` | Perapian kode |
| `chore:` | Pemeliharaan proyek |

Branch yang telah selesai di-merge tetap dipertahankan sebagai arsip riwayat kontribusi kelompok. Penghapusan branch tidak menjadi kewajiban.

Pedoman kolaborasi lebih lengkap tersedia pada [`GITHUB_WORKFLOW.md`](GITHUB_WORKFLOW.md).

## Tim Pengembang

**Kelompok 04 — BIF 1322 Pembangunan Perangkat Lunak**

IPB University

---

**GWASena — Genomic-Wide Association Study Platform for Garlic (*Allium sativum* L.)**