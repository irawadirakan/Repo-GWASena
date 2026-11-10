"""
Script inisialisasi basis data PostgreSQL gwasena_database.
Membuat database jika belum ada, membentuk 12 tabel SKPL, dan menyemai data awal.
"""
import sys
from pathlib import Path

# Tambahkan root repositori ke sys.path
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from sqlalchemy import inspect, select, func
from backend.core.config import settings
from backend.core.database import engine, init_db, SessionLocal
from backend.models import User, AnalysisModel

def main():
    print("=" * 60)
    print("GWASena — Database Initialization Tool")
    print(f"Target URL: {settings.DATABASE_URL}")
    print("=" * 60)

    print("1. Menjalankan init_db()...")
    init_db()

    print("2. Memverifikasi tabel yang terbentuk:")
    inspector = inspect(engine)
    tables = sorted(inspector.get_table_names())
    for idx, tbl in enumerate(tables, start=1):
        print(f"   [{idx:02d}] {tbl}")

    print("\n3. Memverifikasi data awal (seed):")
    with SessionLocal() as db:
        user_count = db.scalar(select(func.count(User.user_id)))
        model_count = db.scalar(select(func.count(AnalysisModel.model_id)))
        print(f"   - Pengguna terdaftar: {user_count} akun")
        for u in db.scalars(select(User)).all():
            print(f"     * {u.username} ({u.email}) [Role: {u.role}]")
        print(f"   - Model GWAS terdaftar: {model_count} model")
        for m in db.scalars(select(AnalysisModel)).all():
            print(f"     * {m.model_name}: {m.software_version}")

    print("=" * 60)
    print("Inisialisasi basis data gwasena_database selesai dengan sukses!")
    print("=" * 60)

if __name__ == "__main__":
    main()
