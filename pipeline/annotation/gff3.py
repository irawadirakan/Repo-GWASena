"""Anotasi gen kandidat dari berkas anotasi genom GFF3 lokal (FR-07, AC-07.1, AC-07.2).

Setiap SNP signifikan dicocokkan dengan gen yang tumpang tindih dengan posisinya,
atau gen terdekat dalam jendela tertentu (bawaan 50 kb). Letak SNP terhadap gen
mengikuti istilah Sequence Ontology yang juga dipakai Ensembl VEP:
  - intragenic_variant      : SNP berada di dalam gen
  - upstream_gene_variant   : SNP berada sebelum awal gen (memperhitungkan arah untai)
  - downstream_gene_variant : SNP berada setelah akhir gen

Bila berkas GFF3 tidak ada atau rusak, AnnotationUnavailable dilempar sehingga
pemanggil bisa menampilkan pesan "anotasi sementara tidak tersedia" tanpa
mengganggu hasil analisis lain (AC-07.2).
"""
from __future__ import annotations

import gzip
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from urllib.parse import unquote

LETAK = {
    "intragenic_variant": "di dalam gen",
    "upstream_gene_variant": "hulu gen (upstream)",
    "downstream_gene_variant": "hilir gen (downstream)",
}


class AnnotationUnavailable(Exception):
    """Sumber anotasi tidak dapat dipakai; pesannya aman ditampilkan ke pengguna."""


@dataclass(frozen=True)
class Gene:
    seqid: str
    start: int  # 1-based, inklusif
    end: int
    strand: str
    gene_id: str
    name: str
    description: str | None


def _norm_chrom(c: str) -> str:
    c = str(c).strip()
    return c[3:].lower() if c.lower().startswith("chr") else c.lower()


def _attributes(text: str) -> dict[str, str]:
    out = {}
    for part in text.strip().strip(";").split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip()] = unquote(v.strip())
    return out


@lru_cache(maxsize=4)
def _read_gff3_cached(path: str, mtime: float) -> dict[str, tuple[Gene, ...]]:
    p = Path(path)
    opener = gzip.open if p.suffix == ".gz" else open
    genes: dict[str, list[Gene]] = {}
    try:
        with opener(p, "rt", encoding="utf-8") as fh:
            for line in fh:
                if not line.strip() or line.startswith("#"):
                    continue
                cols = line.rstrip("\n").split("\t")
                if len(cols) != 9 or cols[2] != "gene":
                    continue
                attr = _attributes(cols[8])
                gid = attr.get("ID") or attr.get("Name")
                if not gid:
                    continue
                g = Gene(seqid=cols[0], start=int(cols[3]), end=int(cols[4]), strand=cols[6],
                         gene_id=gid, name=attr.get("Name", gid),
                         description=attr.get("description") or attr.get("Note") or attr.get("product"))
                genes.setdefault(_norm_chrom(cols[0]), []).append(g)
    except (OSError, EOFError, UnicodeDecodeError, ValueError) as exc:
        raise AnnotationUnavailable(f"Berkas anotasi GFF3 tidak dapat dibaca: {exc}")
    if not genes:
        raise AnnotationUnavailable("Berkas anotasi GFF3 tidak memuat fitur 'gene'.")
    return {c: tuple(sorted(gs, key=lambda g: g.start)) for c, gs in genes.items()}


def read_gff3(path: str | Path) -> dict[str, tuple[Gene, ...]]:
    p = Path(path)
    if not p.is_file():
        raise AnnotationUnavailable(f"Berkas anotasi GFF3 tidak ditemukan ({p.name}).")
    return _read_gff3_cached(str(p.resolve()), p.stat().st_mtime)


def _relation(pos: int, g: Gene) -> tuple[int, str]:
    if g.start <= pos <= g.end:
        return 0, "intragenic_variant"
    before = pos < g.start
    distance = g.start - pos if before else pos - g.end
    upstream = before if g.strand != "-" else not before
    return distance, "upstream_gene_variant" if upstream else "downstream_gene_variant"


def annotate_snps(snps: list[dict], genes: dict[str, tuple[Gene, ...]],
                  window_bp: int = 50_000, max_per_snp: int = 3) -> list[dict]:
    """snps: [{snp_id, chromosome, position, p_value?}] -> daftar kandidat gen per SNP."""
    out = []
    for s in snps:
        pos = int(s["position"])
        hits = []
        for g in genes.get(_norm_chrom(s["chromosome"]), ()):
            if g.start - window_bp > pos:
                break  # gen berikutnya sudah di luar jendela (data terurut menurut awal gen)
            if g.end + window_bp < pos:
                continue
            distance, consequence = _relation(pos, g)
            hits.append((distance, g, consequence))
        hits.sort(key=lambda h: h[0])
        out.append({
            "snp_id": s["snp_id"],
            "chromosome": s["chromosome"],
            "position": pos,
            "p_value": s.get("p_value"),
            "gen": [
                {"gene_id": g.gene_id, "nama": g.name, "deskripsi": g.description,
                 "awal": g.start, "akhir": g.end, "untai": g.strand,
                 "jarak_bp": d, "konsekuensi": c, "letak": LETAK[c]}
                for d, g, c in hits[:max_per_snp]
            ],
        })
    return out


def annotate_from_gff3(snps: list[dict], gff3_path: str | Path, window_bp: int = 50_000,
                       label: str = "SNP signifikan") -> dict:
    """Bentuk respons lengkap; tidak pernah melempar galat (AC-07.2)."""
    base = {"sumber": f"Berkas anotasi genom lokal (GFF3): {Path(gff3_path).name}", "jendela_bp": window_bp}
    try:
        genes = read_gff3(gff3_path)
    except AnnotationUnavailable as exc:
        return {"status": "tidak_tersedia", **base, "kandidat": [],
                "pesan": f"Anotasi gen sementara tidak tersedia. {exc} Hasil analisis lain tetap dapat dilihat."}
    kandidat = annotate_snps(snps, genes, window_bp)
    if not snps:
        pesan = f"Tidak ada {label} untuk dianotasi."
    else:
        n = sum(1 for k in kandidat if k["gen"])
        jendela = f"{window_bp:,}".replace(",", ".")
        pesan = f"{n} dari {len(snps)} {label} memiliki kandidat gen dalam jendela {jendela} bp."
    return {"status": "tersedia", **base, "kandidat": kandidat, "pesan": pesan}
