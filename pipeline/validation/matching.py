"""Pencocokan Sample ID antara berkas genotipe dan fenotipe (BR-02, AC-02.3)."""
from pipeline.errors import ValidationError

MAX_LIST = 20


def match_sample_ids(genotype_ids: list[str], phenotype_ids: list[str]) -> dict:
    """Mewajibkan ID sampel pada kedua berkas sama persis.

    Mengembalikan ringkasan bila cocok; melempar ValidationError berisi daftar
    ID yang tidak sesuai bila tidak cocok.
    """
    g, p = set(genotype_ids), set(phenotype_ids)
    only_g = sorted(g - p)
    only_p = sorted(p - g)
    if only_g or only_p:
        details = []
        if only_g:
            details.append(
                f"{len(only_g)} ID ada di VCF tetapi tidak ada di CSV: "
                + ", ".join(only_g[:MAX_LIST]) + (" …" if len(only_g) > MAX_LIST else "")
            )
        if only_p:
            details.append(
                f"{len(only_p)} ID ada di CSV tetapi tidak ada di VCF: "
                + ", ".join(only_p[:MAX_LIST]) + (" …" if len(only_p) > MAX_LIST else "")
            )
        details.append("Perbaiki salah satu berkas agar ID sampelnya sama, lalu unggah ulang.")
        raise ValidationError("ID sampel pada berkas genotipe dan fenotipe tidak cocok.", details)
    return {"jumlah_sampel_cocok": len(g), "status": "cocok"}
