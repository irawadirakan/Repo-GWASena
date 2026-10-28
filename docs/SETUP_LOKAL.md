# Panduan menjalankan GWASena di komputer pengembang

Target minggu ini: *kerangka frontend, backend, dan basis data sudah dibuat
berdasarkan rancangan, dan aplikasi dapat dijalankan di komputer pengembang.*

## 0. Pasang perangkat (sekali saja)

| Perangkat | Versi | Cek di terminal |
|---|---|---|
| Git | terbaru | `git --version` |
| Python | 3.11 atau 3.12 (hindari versi terbaru yang baru rilis, kadang paket belum siap) | `python --version` |
| Node.js | 20 LTS atau lebih baru | `node --version` |
| Docker Desktop | terbaru (Windows: aktifkan WSL 2 saat instalasi) | `docker --version` |
| VS Code | opsional | – |

Windows: saat memasang Python, **centang "Add python.exe to PATH"**.

## 1. Ambil kode

```bash
git clone https://github.com/Pembangunan-Perangkat-Lunak-BIF-IPB/kelompok-04.git
cd kelompok-04
git checkout -b feature/project-setup     # kerja di branch sendiri, jangan langsung di main
```

Salin seluruh isi kerangka ini ke dalam folder repositori tersebut.

## 2. Berkas konfigurasi

```bash
copy .env.example .env      # Windows
cp .env.example .env        # Mac/Linux
```

## 3. Nyalakan PostgreSQL dan Redis

Buka Docker Desktop dulu sampai statusnya "running", lalu:

```bash
docker compose up -d
docker compose ps           # gwasena-db harus "healthy", gwasena-redis "running"
```

## 4. Jalankan backend (terminal 1)

Semua perintah dijalankan dari **root repositori**, bukan dari dalam folder `backend/`.

```bash
python -m venv .venv
.venv\Scripts\activate                  # Windows (PowerShell/CMD)
source .venv/bin/activate               # Mac/Linux
pip install -r backend/requirements-dev.txt
uvicorn backend.main:app --reload
```

Periksa:
- http://localhost:8000/docs → halaman Swagger berisi daftar endpoint.
- http://localhost:8000/api/health → `"database": {"ok": true, ...}` dan daftar 12 tabel.

## 5. Jalankan frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Buka http://localhost:5173. Ketiga baris status harus hijau ("Terhubung").

## 6. (Opsional) Celery worker (terminal 3)

```bash
.venv\Scripts\activate
celery -A backend.tasks.celery_app:celery_app worker --loglevel=info --pool=solo     # Windows
celery -A backend.tasks.celery_app:celery_app worker --loglevel=info                 # Mac/Linux
```

Lalu buka http://localhost:8000/api/health/worker → `{"ok": true, "reply": "pong"}`.

## 7. Jalankan tes

```bash
pytest -v
```

Ketiga tes harus `PASSED`. Tes memakai SQLite sementara sehingga juga jalan di GitHub Actions.

## 8. Cek isi basis data (opsional, untuk bukti)

```bash
docker exec -it gwasena-db psql -U gwasena -d gwasena -c "\dt"
docker exec -it gwasena-db psql -U gwasena -d gwasena -c "SELECT * FROM analysis_models;"
```

## 9. Simpan ke GitHub

```bash
git add .
git commit -m "chore: inisialisasi kerangka frontend, backend, dan basis data"
git push -u origin feature/project-setup
```

Buat Pull Request ke `develop`, minta satu anggota (mis. QA) me-review, lalu merge.

## 10. Bukti untuk laporan

Ambil tangkapan layar: (1) `docker compose ps`, (2) terminal uvicorn yang berjalan,
(3) halaman `/docs`, (4) respons `/api/health`, (5) halaman frontend dengan status hijau,
(6) hasil `pytest -v`, (7) daftar tabel dari `\dt`, (8) Pull Request di GitHub.

---

## Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| `ModuleNotFoundError: No module named 'backend'` | uvicorn dijalankan dari dalam folder `backend/`. Pindah ke root repositori. |
| PowerShell: "running scripts is disabled" saat aktivasi venv | Jalankan sekali: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `/api/health` → database `ok: false`, "connection refused" | Docker belum menyala / container db belum healthy. Cek `docker compose ps`. |
| Docker: "port 5432 is already allocated" | Ada PostgreSQL lain di laptop. Di `.env` ubah `DB_PORT=5433` **dan** `...@localhost:5433/gwasena`, lalu `docker compose up -d` lagi. |
| "password authentication failed for user gwasena" | Volume lama berisi kredensial lain. `docker compose down -v` lalu `docker compose up -d` (menghapus data DB lokal). |
| Frontend: "Backend belum bisa dihubungi" | Terminal uvicorn tidak berjalan atau error. Lihat log di terminal 1. |
| `pip install` gagal membangun `psycopg`/`pydantic-core` | Versi Python terlalu baru. Pasang Python 3.12 lalu buat ulang `.venv`. |
| Celery di Windows diam/tidak memproses tugas | Wajib tambahkan `--pool=solo`. |
| Laptop tidak kuat Docker | Pasang PostgreSQL langsung (installer resmi), buat user/DB `gwasena` dengan kata sandi `gwasena`. Redis boleh dilewati minggu ini (status merah Redis tidak menghentikan aplikasi). |

---

## Opsi tanpa Docker (untuk anggota yang tidak memakai Docker)

Docker hanya dipakai untuk menjalankan PostgreSQL dan Redis. Untuk pengembangan
lokal, keduanya bisa diganti:

1. Di `.env`, ganti baris DATABASE_URL menjadi:
   ```
   DATABASE_URL=sqlite:///./storage/gwasena_dev.db
   PIPELINE_MODE=background
   ```
2. Lewati langkah `docker compose up -d`. Jalankan backend dan frontend seperti biasa.

Basis data akan berupa satu berkas `storage/gwasena_dev.db` (tidak ikut ke Git).
Di `/api/health`, Redis akan berstatus tidak terhubung; itu normal, analisis tetap
berjalan di latar belakang FastAPI.

Catatan: SQLite hanya untuk memudahkan pengembangan. Demonstrasi dan deployment
tetap memakai PostgreSQL sesuai rancangan.

Alternatif lain: memakai PostgreSQL yang sudah terpasang langsung di laptop
(tanpa Docker). Buat user dan database `gwasena` (kata sandi `gwasena`) lewat
pgAdmin, lalu pakai `DATABASE_URL=postgresql+psycopg://gwasena:gwasena@localhost:5432/gwasena`.
