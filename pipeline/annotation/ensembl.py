"""Integrasi Ensembl REST API Dual-Server, deteksi organisme otomatis, & fallback GFF3 Lokal (M-07).

Mendukung seluruh spesies hewan dan tumbuhan yang terindeks pada:
- Ensembl REST utama (https://rest.ensembl.org)
- Ensembl Genomes / Plants fallback (https://rest.ensemblgenomes.org)
serta fallback ke berkas GFF3 lokal untuk Allium sativum atau bila kosong.
"""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
import logging
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from .gff3 import AnnotationUnavailable, annotate_from_gff3

logger = logging.getLogger(__name__)

ENSEMBL_REST_URL = "https://rest.ensembl.org"
ENSEMBL_GENOMES_REST_URL = "https://rest.ensemblgenomes.org"

SPECIES_ALIASES: dict[str, str] = {
    # Hewan
    "mus_musculus": "mus_musculus",
    "mus musculus": "mus_musculus",
    "mencit": "mus_musculus",
    "tikus lab": "mus_musculus",
    "mouse": "mus_musculus",
    "rattus_norvegicus": "rattus_norvegicus",
    "rattus norvegicus": "rattus_norvegicus",
    "rat": "rattus_norvegicus",
    "tikus": "rattus_norvegicus",
    "bos_taurus": "bos_taurus",
    "bos taurus": "bos_taurus",
    "sapi": "bos_taurus",
    "sapi ternak": "bos_taurus",
    "cattle": "bos_taurus",
    "cow": "bos_taurus",
    "gallus_gallus": "gallus_gallus",
    "gallus gallus": "gallus_gallus",
    "ayam": "gallus_gallus",
    "chicken": "gallus_gallus",
    "sus_scrofa": "sus_scrofa",
    "sus scrofa": "sus_scrofa",
    "babi": "sus_scrofa",
    "pig": "sus_scrofa",
    "ovis_aries": "ovis_aries",
    "ovis aries": "ovis_aries",
    "domba": "ovis_aries",
    "sheep": "ovis_aries",
    "capra_hircus": "capra_hircus",
    "capra hircus": "capra_hircus",
    "kambing": "capra_hircus",
    "goat": "capra_hircus",
    "equus_caballus": "equus_caballus",
    "equus caballus": "equus_caballus",
    "kuda": "equus_caballus",
    "horse": "equus_caballus",
    "danio_rerio": "danio_rerio",
    "danio rerio": "danio_rerio",
    "ikan zebra": "danio_rerio",
    "zebrafish": "danio_rerio",
    # Tumbuhan (Ensembl)
    "oryza_sativa": "oryza_sativa",
    "oryza sativa": "oryza_sativa",
    "padi": "oryza_sativa",
    "rice": "oryza_sativa",
    "zea_mays": "zea_mays",
    "zea mays": "zea_mays",
    "jagung": "zea_mays",
    "maize": "zea_mays",
    "corn": "zea_mays",
    "glycine_max": "glycine_max",
    "glycine max": "glycine_max",
    "kedelai": "glycine_max",
    "soybean": "glycine_max",
    "soy": "glycine_max",
    "solanum_lycopersicum": "solanum_lycopersicum",
    "solanum lycopersicum": "solanum_lycopersicum",
    "tomat": "solanum_lycopersicum",
    "tomato": "solanum_lycopersicum",
    "solanum_tuberosum": "solanum_tuberosum",
    "solanum tuberosum": "solanum_tuberosum",
    "kentang": "solanum_tuberosum",
    "potato": "solanum_tuberosum",
    "triticum_aestivum": "triticum_aestivum",
    "triticum aestivum": "triticum_aestivum",
    "gandum": "triticum_aestivum",
    "wheat": "triticum_aestivum",
    "arabidopsis_thaliana": "arabidopsis_thaliana",
    "arabidopsis thaliana": "arabidopsis_thaliana",
    "arabidopsis": "arabidopsis_thaliana",
    # Spesies Referensi Lokal (GFF3)
    "allium_sativum": "allium_sativum",
    "allium sativum": "allium_sativum",
    "allium sativum l.": "allium_sativum",
    "bawang putih": "allium_sativum",
    "garlic": "allium_sativum",
}

LOCAL_GFF3_SPECIES = {"allium_sativum"}

ENSEMBL_SUPPORTED_SPECIES = {
    code for code in set(SPECIES_ALIASES.values()) if code not in LOCAL_GFF3_SPECIES
}

SPECIES_DISPLAY_NAMES: dict[str, str] = {
    "mus_musculus": "Mencit (Mus musculus)",
    "rattus_norvegicus": "Tikus (Rattus norvegicus)",
    "bos_taurus": "Sapi (Bos taurus)",
    "gallus_gallus": "Ayam (Gallus gallus)",
    "sus_scrofa": "Babi (Sus scrofa)",
    "ovis_aries": "Domba (Ovis aries)",
    "capra_hircus": "Kambing (Capra hircus)",
    "equus_caballus": "Kuda (Equus caballus)",
    "danio_rerio": "Ikan Zebra (Danio rerio)",
    "oryza_sativa": "Padi (Oryza sativa)",
    "zea_mays": "Jagung (Zea mays)",
    "glycine_max": "Kedelai (Glycine max)",
    "solanum_lycopersicum": "Tomat (Solanum lycopersicum)",
    "solanum_tuberosum": "Kentang (Solanum tuberosum)",
    "triticum_aestivum": "Gandum (Triticum aestivum)",
    "arabidopsis_thaliana": "Arabidopsis thaliana",
    "allium_sativum": "Bawang Putih (Allium sativum - GFF3 Lokal)",
}

# Urutan aturan penting agar kata kunci spesifik (mis. mus_musculus / solanum_tuberosum)
# dipindai lebih dulu sebelum kata kunci yang lebih umum.
_DATASET_DETECTION_RULES: list[tuple[tuple[str, ...], str, str, str]] = [
    (("mus_musculus", "mus musculus", "mouse", "mice", "mencit", "hs1940", "mus"), "mus_musculus", "hewan", "Mencit (Mus musculus)"),
    (("rattus_norvegicus", "rattus", "rat", "tikus"), "rattus_norvegicus", "hewan", "Tikus (Rattus norvegicus)"),
    (("bos_taurus", "bos taurus", "cattle", "bovine", "cow", "sapi"), "bos_taurus", "hewan", "Sapi (Bos taurus)"),
    (("gallus_gallus", "gallus", "chicken", "ayam"), "gallus_gallus", "hewan", "Ayam (Gallus gallus)"),
    (("sus_scrofa", "porcine", "swine", "pig", "babi"), "sus_scrofa", "hewan", "Babi (Sus scrofa)"),
    (("ovis_aries", "ovis", "sheep", "domba"), "ovis_aries", "hewan", "Domba (Ovis aries)"),
    (("capra_hircus", "capra", "goat", "kambing"), "capra_hircus", "hewan", "Kambing (Capra hircus)"),
    (("equus_caballus", "equus", "horse", "kuda"), "equus_caballus", "hewan", "Kuda (Equus caballus)"),
    (("danio_rerio", "danio", "zebrafish"), "danio_rerio", "hewan", "Ikan Zebra (Danio rerio)"),
    (("solanum_tuberosum", "potato", "kentang"), "solanum_tuberosum", "tanaman", "Kentang (Solanum tuberosum)"),
    (("solanum_lycopersicum", "tomato", "tomat", "solanum"), "solanum_lycopersicum", "tanaman", "Tomat (Solanum lycopersicum)"),
    (("oryza_sativa", "oryza", "rice", "padi"), "oryza_sativa", "tanaman", "Padi (Oryza sativa)"),
    (("zea_mays", "zea mays", "zea", "maize", "corn", "jagung"), "zea_mays", "tanaman", "Jagung (Zea mays)"),
    (("glycine_max", "soybean", "glycine", "kedelai", "soy"), "glycine_max", "tanaman", "Kedelai (Glycine max)"),
    (("triticum_aestivum", "triticum", "wheat", "gandum"), "triticum_aestivum", "tanaman", "Gandum (Triticum aestivum)"),
    (("arabidopsis_thaliana", "arabidopsis"), "arabidopsis_thaliana", "tanaman", "Arabidopsis thaliana"),
    (("allium_sativum", "allium", "garlic", "bawang", "umbi"), "allium_sativum", "tanaman", "Bawang Putih (Allium sativum)"),
]


def _keyword_matches(corpus: str, keyword: str) -> bool:
    """Cocokkan kata kunci pada korpus teks dengan pembatas non-alfanumerik agar akurat."""
    escaped = re.escape(keyword)
    if len(keyword) <= 4:
        return bool(re.search(rf"(?<![a-z0-9]){escaped}(?![a-z0-9])", corpus))
    return keyword in corpus


def scientific_name(organism: str | None) -> str:
    """Kembalikan nama ilmiah binomial murni (contoh: 'Mus musculus', 'Allium sativum')."""
    code, _ = resolve_species_target(organism)
    parts = [p for p in code.split("_") if p]
    if not parts:
        return "Allium sativum"
    return " ".join([parts[0].capitalize(), *parts[1:]])


def detect_organism_from_dataset(
    filenames: list[str],
    traits: list[str] | None = None,
    num_chromosomes: int | None = None,
    vcf_header: str | None = None,
    snp_ids: list[str] | None = None,
) -> dict:
    """Deteksi otomatis organisme dari nama berkas, header VCF, nama sifat, & profil kromosom/SNP."""
    parts = [
        *[str(f) for f in (filenames or []) if f],
        *[str(t) for t in (traits or []) if t],
        str(vcf_header or ""),
    ]
    corpus = " ".join(parts).lower()

    for keywords, code, kingdom, label in _DATASET_DETECTION_RULES:
        for kw in keywords:
            if _keyword_matches(corpus, kw):
                return {
                    "organism": code,
                    "organism_label": scientific_name(code),
                    "kingdom": kingdom,
                    "label": label,
                    "detected_by": "nama berkas/profil dataset",
                    "matched_keyword": kw,
                    "source": "gff3" if code in LOCAL_GFF3_SPECIES else "ensembl",
                    "auto_detected": True,
                }

    # Heuristik profil kromosom & pola ID SNP (rs... dengan > 12 kromosom -> Mus musculus)
    traits_text = " ".join(str(t) for t in (traits or [])).lower()
    has_rs_snps = any(str(s).strip().lower().startswith("rs") for s in (snp_ids or []))
    if num_chromosomes is not None and (num_chromosomes in (19, 20) or (num_chromosomes > 12 and has_rs_snps)):
        return {
            "organism": "mus_musculus",
            "organism_label": "Mus musculus",
            "kingdom": "hewan",
            "label": "Mencit (Mus musculus)",
            "detected_by": f"heuristik jumlah kromosom ({num_chromosomes})" + (" & ID SNP rs" if has_rs_snps else ""),
            "source": "ensembl",
            "auto_detected": True,
        }
    if num_chromosomes == 12:
        return {
            "organism": "oryza_sativa",
            "organism_label": "Oryza sativa",
            "kingdom": "tanaman",
            "label": "Padi (Oryza sativa)",
            "detected_by": "heuristik jumlah kromosom (12)",
            "source": "ensembl",
            "auto_detected": True,
        }
    if num_chromosomes == 8 and ("bobot_umbi_g" in traits_text or "umbi" in traits_text):
        return {
            "organism": "allium_sativum",
            "organism_label": "Allium sativum",
            "kingdom": "tanaman",
            "label": "Bawang Putih (Allium sativum)",
            "detected_by": "heuristik profil kromosom (8) & sifat umbi",
            "source": "gff3",
            "auto_detected": True,
        }

    return {
        "organism": "allium_sativum",
        "organism_label": "Allium sativum",
        "kingdom": "tanaman",
        "label": "Bawang Putih (Allium sativum - GFF3 Lokal)",
        "detected_by": "default referensi lokal",
        "source": "gff3",
        "auto_detected": False,
    }


def _format_custom_display_name(species_code: str) -> str:
    """Format kode ensembl (felis_catus) menjadi nama ilmiah mudah dibaca (Felis catus)."""
    if species_code in SPECIES_DISPLAY_NAMES:
        return SPECIES_DISPLAY_NAMES[species_code]
    parts = [p for p in species_code.split("_") if p]
    if not parts:
        return species_code
    return " ".join([parts[0].capitalize(), *parts[1:]])


def resolve_species_target(organism: str | None) -> tuple[str, str]:
    """Petakan input organisme atau nama ilmiah kustom menjadi (kode_ensembl, mode_anotasi).

    ``allium_sativum`` (atau kosong) diarahkan ke ``"gff3"`` lokal; spesies hewan
    maupun tumbuhan lain (termasuk ketikan bebas pengguna seperti ``"Felis catus"``)
    dinormalisasi ke ``snake_case`` dan diarahkan ke ``"ensembl"``.
    """
    raw = (organism or "").strip().lower()
    if not raw:
        return "allium_sativum", "gff3"

    base = re.sub(r"\s*\([^)]*\)", "", raw).strip()
    canonical = SPECIES_ALIASES.get(raw) or SPECIES_ALIASES.get(base)

    if canonical is None:
        normalized = re.sub(r"\s+", "_", base)
        normalized = re.sub(r"[^a-z0-9_]", "", normalized).strip("_")
        canonical = normalized or "allium_sativum"

    if canonical in LOCAL_GFF3_SPECIES:
        return canonical, "gff3"
    return canonical, "ensembl"


def _ssl_context() -> ssl.SSLContext | None:
    """Bangun SSL context memakai certifi jika tersedia agar andal di Windows."""
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return None


def _clean_ensembl_chrom(chromosome: str | int) -> str:
    """Normalisasi nama kromosom untuk endpoint Ensembl (chr1 -> 1)."""
    chrom = str(chromosome or "").strip()
    chrom = re.sub(r"^chr", "", chrom, flags=re.IGNORECASE)
    if chrom.upper() == "M":
        return "MT"
    return chrom


def _ensembl_relation(snp_pos: int, start_pos: int, end_pos: int, untai: str) -> tuple[str, int, str]:
    """Hitung konsekuensi variasi, jarak (bp), dan deskripsi letak relatif ke gen."""
    if start_pos <= snp_pos <= end_pos:
        return "intragenic_variant", 0, "di dalam gen"

    if snp_pos < start_pos:
        jarak = start_pos - snp_pos
        if untai == "+":
            return "upstream_gene_variant", jarak, "di hulu (upstream)"
        return "downstream_gene_variant", jarak, "di hilir (downstream)"

    jarak = snp_pos - end_pos
    if untai == "+":
        return "downstream_gene_variant", jarak, "di hilir (downstream)"
    return "upstream_gene_variant", jarak, "di hulu (upstream)"


def _open_json_request(url: str, timeout: float):
    req = urllib.request.Request(
        url,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "GWASena/2.0 (Bioinformatics Pipeline)",
        },
    )
    ctx = _ssl_context()
    if ctx is not None:
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except TypeError:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def annotate_snp_with_ensembl(
    species: str,
    chromosome: str | int,
    position: int,
    window_bp: int = 50_000,
    timeout: float = 5.0,
) -> list[dict]:
    """Kueri Ensembl REST API (utama + fallback Ensembl Genomes) dalam ±window_bp dari SNP.

    Jika server utama rest.ensembl.org mengembalikan HTTP 400/404, otomatis melakukan
    fallback ke rest.ensemblgenomes.org. Kegagalan jaringan/timeout mengembalikan ``[]``
    agar alur GWAS tetap berjalan tanpa crash.
    """
    species_code, _ = resolve_species_target(species)
    chrom_clean = _clean_ensembl_chrom(chromosome)
    if not species_code or not chrom_clean:
        return []

    pos_int = int(position)
    start_pos = max(1, pos_int - int(window_bp))
    end_pos = pos_int + int(window_bp)

    species_enc = urllib.parse.quote(species_code, safe="")
    chrom_enc = urllib.parse.quote(chrom_clean, safe="")
    path = f"/overlap/region/{species_enc}/{chrom_enc}:{start_pos}-{end_pos}?feature=gene"

    data = None
    try:
        data = _open_json_request(f"{ENSEMBL_REST_URL}{path}", timeout=timeout)
    except urllib.error.HTTPError as exc:
        if exc.code in (400, 404):
            try:
                data = _open_json_request(f"{ENSEMBL_GENOMES_REST_URL}{path}", timeout=timeout)
            except (
                urllib.error.URLError,
                urllib.error.HTTPError,
                TimeoutError,
                OSError,
                json.JSONDecodeError,
                ValueError,
            ) as fallback_exc:
                logger.warning(
                    "Ensembl fallback (%s) gagal untuk %s (%s:%s): %s",
                    ENSEMBL_GENOMES_REST_URL,
                    species_code,
                    chrom_clean,
                    pos_int,
                    fallback_exc,
                )
                return []
        else:
            logger.warning(
                "Ensembl REST API HTTP %s untuk %s (%s:%s): %s",
                exc.code,
                species_code,
                chrom_clean,
                pos_int,
                exc,
            )
            return []
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError, ValueError) as exc:
        logger.warning(
            "Ensembl REST API gagal untuk %s (%s:%s): %s",
            species_code,
            chrom_clean,
            pos_int,
            exc,
        )
        return []

    if not isinstance(data, list):
        return []

    candidates: list[dict] = []
    for raw in data:
        if not isinstance(raw, dict):
            continue
        g_start = int(raw.get("start") or 0)
        g_end = int(raw.get("end") or g_start)
        strand_raw = raw.get("strand")
        untai = "-" if str(strand_raw) in ("-1", "-") else "+"
        konsekuensi, jarak_bp, letak = _ensembl_relation(pos_int, g_start, g_end, untai)

        external_name = (raw.get("external_name") or "").strip()
        ensembl_id = (raw.get("id") or "").strip()
        gene_symbol = external_name or ensembl_id or "Gen Ensembl"
        biotype = (raw.get("biotype") or "protein_coding").replace("_", " ")
        description = (raw.get("description") or "").strip() or f"Gen Ensembl ({ensembl_id or gene_symbol}; {biotype})"

        candidates.append(
            {
                "gene_id": gene_symbol,
                "ensembl_id": ensembl_id or gene_symbol,
                "nama": gene_symbol,
                "deskripsi": description,
                "awal": g_start,
                "akhir": g_end,
                "untai": untai,
                "jarak_bp": jarak_bp,
                "konsekuensi": konsekuensi,
                "letak": letak,
            }
        )

    candidates.sort(key=lambda item: (item["jarak_bp"], item["gene_id"]))
    return candidates


def annotate_with_ensembl(
    snps: list[dict],
    species: str,
    window_bp: int = 50_000,
    max_per_snp: int = 5,
    label: str = "SNP signifikan",
) -> dict:
    """Anotasi daftar SNP menggunakan Ensembl REST API dengan format kompatibel M-07."""
    kandidat: list[dict] = []
    total_genes = 0

    def _query_one(snp: dict) -> list[dict]:
        chrom = snp.get("chromosome")
        pos = snp.get("position")
        if chrom is None or pos is None:
            return []
        try:
            return annotate_snp_with_ensembl(species, chrom, int(pos), window_bp=window_bp, timeout=3.0)[:max_per_snp]
        except Exception as exc:  # noqa: BLE001
            logger.warning("Gagal kueri Ensembl paralel untuk %s: %s", snp.get("snp_id"), exc)
            return []

    if len(snps) > 1:
        with ThreadPoolExecutor(max_workers=min(5, len(snps))) as executor:
            gene_lists = list(executor.map(_query_one, snps))
    else:
        gene_lists = [_query_one(snp) for snp in snps]

    for snp, genes in zip(snps, gene_lists):
        chrom = snp.get("chromosome")
        pos = snp.get("position")
        total_genes += len(genes)
        kandidat.append(
            {
                "snp_id": snp.get("snp_id"),
                "chromosome": chrom,
                "position": pos,
                "p_value": snp.get("p_value"),
                "gen": genes,
            }
        )

    display_name = _format_custom_display_name(species)
    if not snps:
        pesan = f"Tidak ada {label} untuk dianotasi melalui Ensembl REST API ({species})."
    elif total_genes == 0:
        pesan = (
            f"Tidak ditemukan gen kandidat Ensembl dalam ±{window_bp // 1000} kb "
            f"untuk {len(snps)} {label} pada {display_name}."
        )
    else:
        pesan = (
            f"Ditemukan {total_genes} kandidat gen dari Ensembl REST API ({species}) "
            f"dalam jendela ±{window_bp // 1000} kb untuk {len(snps)} {label}."
        )

    return {
        "status": "tersedia",
        "sumber": f"Ensembl REST API ({species})",
        "sumber_tipe": "ensembl",
        "organism": species,
        "organism_target": display_name,
        "jendela_bp": int(window_bp),
        "kandidat": kandidat,
        "pesan": pesan,
    }


def annotate_snps_auto(
    snps: list[dict],
    organism: str | None,
    gff3_path: str | Path | None,
    window_bp: int = 50_000,
    label: str = "SNP signifikan",
) -> dict:
    """Pilih mesin anotasi secara dinamis: Ensembl REST API atau GFF3 Referensi Lokal."""
    canonical_species, mode = resolve_species_target(organism)
    if mode == "ensembl":
        return annotate_with_ensembl(
            snps=snps,
            species=canonical_species,
            window_bp=window_bp,
            label=label,
        )

    try:
        hasil = annotate_from_gff3(snps, gff3_path, window_bp, label)
    except AnnotationUnavailable as exc:
        raise AnnotationUnavailable(str(exc)) from exc

    return {
        **hasil,
        "sumber_tipe": "gff3",
        "organism": canonical_species,
        "organism_target": _format_custom_display_name(canonical_species),
    }
