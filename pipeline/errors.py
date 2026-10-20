"""Galat khusus pipeline. Pesan ditulis dalam bahasa Indonesia agar bisa
langsung ditampilkan ke pengguna (FR-11: penanganan kesalahan input)."""


class PipelineError(Exception):
    """Galat yang pesannya aman ditampilkan ke pengguna."""

    def __init__(self, message: str, details: list[str] | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or []


class ValidationError(PipelineError):
    """Berkas masukan tidak lolos validasi (format, header, atau Sample ID)."""
