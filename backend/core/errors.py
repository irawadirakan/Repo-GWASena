"""Format pesan galat yang seragam dan berbahasa Indonesia (FR-11, NFR-04).

Semua galat dikirim dalam bentuk {"detail": {"pesan": "...", "rincian": [...]}} (atau
{"detail": "..."} untuk galat sederhana), sehingga antarmuka cukup menampilkan
`pesan` sebagai judul dan `rincian` sebagai daftar langkah perbaikan.
"""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("gwasena")

LABEL = {
    "trait": "Sifat (trait)", "model": "Model", "mind": "Missingness sampel (mind)",
    "geno": "Missingness SNP (geno)", "maf": "MAF", "hwe": "Ambang HWE", "king_cutoff": "Ambang KING",
    "n_pc": "Jumlah PC (n_pc)", "koreksi": "Metode koreksi", "alpha": "Alpha", "qc": "Parameter QC",
    "username": "Username", "email": "Email", "password": "Kata sandi", "analysis_name": "Nama sesi",
    "genotipe": "Berkas genotipe", "fenotipe": "Berkas fenotipe", "bim": "Berkas .bim", "fam": "Berkas .fam",
    "credential": "Token Google", "maks_titik": "Batas titik (maks_titik)", "analysis_id": "ID analisis",
}


def _field(loc) -> str:
    parts = [str(p) for p in loc if p not in ("body", "query", "path", "form", "file")]
    if not parts:
        return "Data"
    nama = parts[-1] if not parts[-1].isdigit() else parts[-2] if len(parts) > 1 else parts[-1]
    return LABEL.get(nama, nama)


def translate(err: dict) -> str:
    """Menerjemahkan satu galat validasi Pydantic menjadi kalimat bahasa Indonesia."""
    f = _field(err.get("loc", ()))
    t = err.get("type", "")
    ctx = err.get("ctx") or {}
    if t == "missing":
        return f"{f}: wajib diisi." if not f.startswith("Berkas") else f"{f}: wajib diunggah."
    if t == "greater_than_equal":
        return f"{f}: minimal {ctx.get('ge')}."
    if t == "greater_than":
        return f"{f}: harus lebih besar dari {ctx.get('gt')}."
    if t == "less_than_equal":
        return f"{f}: maksimal {ctx.get('le')}."
    if t == "less_than":
        return f"{f}: harus lebih kecil dari {ctx.get('lt')}."
    if t in ("literal_error", "enum"):
        return f"{f}: harus salah satu dari {ctx.get('expected', '')}."
    if t in ("float_parsing", "float_type", "int_parsing", "int_type", "int_from_float"):
        return f"{f}: harus berupa angka" + (" bulat." if t.startswith("int") else ".")
    if t == "bool_parsing":
        return f"{f}: harus true atau false."
    if t == "extra_forbidden":
        return f"{f}: tidak dikenal. Periksa kembali ejaan nama field."
    if t == "string_too_short":
        return f"{f}: minimal {ctx.get('min_length')} karakter."
    if t == "string_too_long":
        return f"{f}: maksimal {ctx.get('max_length')} karakter."
    if t == "string_pattern_mismatch":
        return f"{f}: formatnya tidak sesuai."
    if t in ("list_type", "dict_type", "model_type", "model_attributes_type"):
        return f"{f}: bentuk datanya tidak sesuai."
    if t in ("json_invalid", "json_type"):
        return "Isi permintaan bukan JSON yang valid."
    if t == "value_error":
        return f"{f}: {str(err.get('msg', '')).removeprefix('Value error, ')}"
    return f"{f}: {err.get('msg', 'nilai tidak valid')}."


def register(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validasi(_: Request, exc: RequestValidationError):
        rincian = [translate(e) for e in exc.errors()]
        return JSONResponse(status_code=422, content={"detail": {
            "pesan": "Data yang dikirim belum sesuai. Periksa kembali isian berikut.", "rincian": rincian}})

    @app.exception_handler(Exception)
    async def _internal(request: Request, exc: Exception):
        logger.exception("Galat tak terduga pada %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": {
            "pesan": "Terjadi kesalahan internal pada server.",
            "rincian": ["Coba ulangi beberapa saat lagi.",
                        "Bila terus terjadi, laporkan ke tim pengembang beserta waktu kejadian dan langkah yang dilakukan."]}})
