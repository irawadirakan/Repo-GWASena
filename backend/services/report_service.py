"""Laporan hasil analisis dalam bentuk halaman web (Web Report, FR-09, AC-09.2).

Berisi parameter, ringkasan QC, PCA, uji asosiasi, Manhattan plot, QQ plot, dan
kandidat gen untuk SNP signifikan. Halaman berdiri sendiri (gambar disisipkan
sebagai base64) sehingga bisa disimpan sebagai .html atau dicetak ke PDF dari browser.
"""
import base64
from datetime import datetime
from html import escape

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models import Analysis, AnalysisParameter, VisualizationResult
from backend.services import annotation_service, plot_service
from pipeline.annotation import scientific_name

LABEL_PARAM = [
    ("trait", "Sifat yang dianalisis"), ("model", "Model uji asosiasi"),
    ("mind", "Batas missingness sampel (mind)"), ("geno", "Batas missingness SNP (geno)"),
    ("maf", "Batas frekuensi alel minor (MAF)"), ("hwe", "Ambang p Hardy-Weinberg (HWE)"),
    ("king_cutoff", "Ambang kekerabatan KING"), ("n_pc", "Jumlah komponen utama (PC)"),
    ("koreksi", "Metode koreksi"), ("alpha", "Tingkat signifikansi (α)"),
]

CSS = """
body{font-family:Georgia,'Times New Roman',serif;max-width:900px;margin:24px auto;padding:0 16px;color:#1d1d1f;line-height:1.5}
h1{font-size:24px;margin-bottom:4px}h2{font-size:18px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:28px}
.meta{color:#555;font-size:14px}table{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}
th,td{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left;vertical-align:top}th{background:#f3f5f8}
td.n{text-align:right;font-variant-numeric:tabular-nums}img{max-width:100%;border:1px solid #eee;display:block;margin:8px auto}img.qq{max-width:520px}
.cat{background:#f7f9fc;border-left:3px solid #1f4e79;padding:8px 12px;font-size:14px}
.kosong{color:#777;font-style:italic}footer{margin-top:32px;font-size:12px;color:#777}
@media print{body{margin:0}h2{page-break-after:avoid}img,table{page-break-inside:avoid}}
"""


def _fmt(x, nd=4):
    if x is None:
        return "–"
    if isinstance(x, bool):
        return "ya" if x else "tidak"
    if isinstance(x, float):
        return f"{x:.3e}" if (x != 0 and abs(x) < 1e-3) else f"{x:.{nd}g}"
    if isinstance(x, list):
        return ", ".join(str(v) for v in x) or "–"
    return str(x)


def _table(header: list[str], rows: list[list], numeric: set[int] = frozenset()) -> str:
    th = "".join(f"<th>{escape(h)}</th>" for h in header)
    body = "".join(
        "<tr>" + "".join(f'<td class="n">{escape(_fmt(v))}</td>' if i in numeric else f"<td>{escape(_fmt(v))}</td>"
                         for i, v in enumerate(r)) + "</tr>"
        for r in rows)
    return f"<table><thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>"


def _image(db: Session, analysis_id: int, jenis: str, alt: str) -> str:
    try:
        png = plot_service.render_png(db, analysis_id, jenis)
    except plot_service.PngUnavailable:
        return '<p class="kosong">Gambar belum dapat dibuat karena paket matplotlib belum terpasang.</p>'
    if not png:
        return '<p class="kosong">Data plot tidak tersedia.</p>'
    data = base64.b64encode(png).decode()
    kelas = ' class="qq"' if jenis == "qq" else ""
    return f'<img{kelas} alt="{escape(alt)}" src="data:image/png;base64,{data}">'


def build_report(db: Session, a: Analysis, organism_override: str | None = None) -> str:
    ring = db.scalar(select(VisualizationResult).where(
        VisualizationResult.analysis_id == a.analysis_id, VisualizationResult.plot_type == "ringkasan"))
    r = ring.plot_cache if ring and ring.plot_cache else {}
    param = db.scalar(select(AnalysisParameter).where(AnalysisParameter.analysis_id == a.analysis_id))
    cfg = param.parameter_config if param else {}
    qc, pca, aso = r.get("qc") or {}, r.get("pca") or {}, r.get("asosiasi") or {}
    sig = r.get("snp_signifikan") or []
    top = r.get("snp_teratas") or []

    bagian = []
    bagian.append("<h2>1. Parameter Analisis</h2>" + _table(
        ["Parameter", "Nilai"], [[label, cfg.get(k)] for k, label in LABEL_PARAM]))

    rows_qc = [[k.get("kriteria"), k.get("ambang"), k.get("sampel_tersaring"), k.get("snp_tersaring"),
                k.get("keterangan")] for k in qc.get("kriteria") or []]
    bagian.append(
        "<h2>2. Quality Control</h2>"
        f"<p>Data awal {qc.get('sampel_awal', '–')} sampel dan {qc.get('snp_awal', '–')} SNP; "
        f"lolos QC {qc.get('sampel_lolos', '–')} sampel dan {qc.get('snp_lolos', '–')} SNP.</p>"
        + _table(["Data", "Lolos QC / Data awal"],
                 [["Sampel", f"{qc.get('sampel_lolos', '–')} / {qc.get('sampel_awal', '–')}"],
                  ["SNP", f"{qc.get('snp_lolos', '–')} / {qc.get('snp_awal', '–')}"]])
        + _table(["Kriteria", "Ambang", "Sampel", "SNP", "Keterangan"], rows_qc, {2, 3}))

    var = pca.get("variansi_dijelaskan") or []
    bagian.append(
        "<h2>3. Struktur Populasi (PCA)</h2>"
        f"<p>{pca.get('jumlah_pc', '–')} komponen utama dipakai sebagai kovariat.</p>"
        + _table(["Komponen", "Proporsi variansi"], [[f"PC{i + 1}", f"{v * 100:.1f}%"] for i, v in enumerate(var)]))

    rows_aso = [
        ["Sampel dipakai dalam uji", aso.get("jumlah_sampel")],
        ["SNP diuji", aso.get("jumlah_snp_diuji")],
        ["Derajat bebas", aso.get("derajat_bebas")],
        ["Ambang Bonferroni (p)", aso.get("ambang_bonferroni_p")],
        ["Genomic inflation factor (λGC)", aso.get("lambda_gc")],
        ["Jumlah SNP signifikan", aso.get("jumlah_signifikan")],
    ]
    vc = aso.get("komponen_varians") or {}
    if vc:
        rows_aso += [["Varians genetik (σ²g)", vc.get("var_genetik")], ["Varians galat (σ²e)", vc.get("var_galat")],
                     ["Pseudo-heritabilitas (h²)", vc.get("heritabilitas")]]
    lam = aso.get("lambda_gc")
    catatan_lam = ""
    if lam is not None:
        catatan_lam = ('<p class="cat">λGC mendekati 1 menandakan nilai p tidak mengalami inflasi; '
                       + ("nilai di atas 1,1 menandakan struktur populasi atau kekerabatan belum sepenuhnya "
                          "terkendali, sehingga model MLM lebih disarankan.</p>" if lam > 1.1 else
                          "nilai pada analisis ini berada dalam batas wajar.</p>"))
    bagian.append(f"<h2>4. Uji Asosiasi ({escape(str(r.get('model', '')))})</h2>"
                  + _table(["Besaran", "Nilai"], rows_aso) + catatan_lam)

    n_sig = int(aso.get("jumlah_signifikan") or len(sig) or 0)
    bonf_p = aso.get("ambang_bonferroni_p")
    bonf_neglog = f"{-__import__('math').log10(bonf_p):.2f}" if isinstance(bonf_p, (int, float)) and bonf_p > 0 else "–"
    org_raw = organism_override or a.organism
    org_sci = scientific_name(org_raw)
    trait_disp = str(r.get("trait") or a.trait_name or "sifat target")
    peak = None
    if sig:
        peak = max(sig, key=lambda s: -(s.get("p_value") or 1.0) if s.get("neglog10p") is None else float(s.get("neglog10p")))
    if n_sig > 0 and peak:
        peak_p = peak.get("p_value")
        peak_nl = peak.get("neglog10p")
        if peak_nl is None and isinstance(peak_p, (int, float)) and peak_p > 0:
            peak_nl = -__import__("math").log10(peak_p)
        peak_nl_txt = f"{peak_nl:.2f}" if isinstance(peak_nl, (int, float)) else "–"
        catatan_manhattan = (
            '<p class="cat"><strong>Interpretasi Hasil Asosiasi Genomik (Manhattan Plot):</strong> '
            f"Identifikasi lokus genomik mendeteksi {n_sig} varian SNP signifikan yang melampaui ambang batas Bonferroni "
            f"(-log₁₀P ≥ {escape(bonf_neglog)}), dengan sinyal asosiasi puncak pada {escape(str(peak.get('snp_id', '–')))} "
            f"(Kromosom {escape(str(peak.get('chromosome', '–')))}, -log₁₀P = {escape(peak_nl_txt)}). "
            "Konsentrasi puncak pada kromosom tersebut mengindikasikan keberadaan Quantitative Trait Loci (QTL) utama "
            f"yang mengendalikan variasi fenotipe {escape(trait_disp)} pada <em>{escape(org_sci)}</em>.</p>"
        )
    else:
        catatan_manhattan = (
            '<p class="cat"><strong>Interpretasi Hasil Asosiasi Genomik (Manhattan Plot):</strong> '
            f"Tidak ditemukan varian SNP yang melampaui ambang batas konservatif Bonferroni (-log₁₀P = {escape(bonf_neglog)}). "
            f"Hal ini mengindikasikan bahwa sifat {escape(trait_disp)} pada <em>{escape(org_sci)}</em> kemungkinan besar "
            "dikendalikan oleh arsitektur poligenik dengan efek alelik minor per lokus, sehingga disarankan meninjau "
            "kandidat teratas menggunakan ambang eksploratori FDR.</p>"
        )

    bagian.append("<h2>5. Manhattan Plot</h2>" + _image(db, a.analysis_id, "manhattan", "Manhattan plot") + catatan_manhattan
                  + "<h2>6. QQ Plot</h2>" + _image(db, a.analysis_id, "qq", "QQ plot"))

    def snp_rows(daftar):
        return [[s.get("snp_id"), s.get("chromosome"), s.get("position"), f"{s.get('ref')}/{s.get('alt')}",
                 s.get("beta"), s.get("se"), s.get("p_value"), s.get("p_bonferroni"), s.get("q_value")]
                for s in daftar]
    kolom = ["SNP", "Kromosom", "Posisi", "REF/ALT", "β", "SE", "p", "p Bonferroni", "q (FDR)"]
    if sig:
        bagian.append("<h2>7. SNP Signifikan</h2>" + _table(kolom, snp_rows(sig), {2, 4, 5, 6, 7, 8}))
        anot = annotation_service.annotate(db, a, org_raw, sertakan_teratas=False)
        if anot["status"] == "tersedia":
            rows_gen = [[k["snp_id"], g["gene_id"], g.get("nama"), g["letak"], g["jarak_bp"]]
                        for k in anot["kandidat"] for g in k["gen"]]
            isi = (_table(["SNP", "Gen", "Nama", "Letak SNP", "Jarak (bp)"], rows_gen, {4}) if rows_gen
                   else '<p class="kosong">Tidak ada gen dalam jendela pencarian.</p>')
            bagian.append(f"<h2>8. Kandidat Gen</h2><p>{escape(anot['pesan'])} Sumber: {escape(anot['sumber'])}.</p>"
                          + isi)
        else:
            bagian.append(f'<h2>8. Kandidat Gen</h2><p class="kosong">{escape(anot["pesan"])}</p>')
    else:
        bagian.append("<h2>7. SNP Signifikan</h2><p class=\"kosong\">Tidak ada SNP yang signifikan setelah "
                      "koreksi. Berikut 10 SNP dengan nilai p terkecil sebagai bahan telaah.</p>"
                      + _table(kolom, snp_rows(top), {2, 4, 5, 6, 7, 8}))

    waktu = datetime.now().strftime("%d-%m-%Y %H:%M")
    judul = escape(a.analysis_name or f"Analisis {a.analysis_id}")
    return (
        "<!DOCTYPE html><html lang=\"id\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        f"<title>Laporan GWASena - {judul}</title><style>{CSS}</style></head><body>"
        f"<h1>Laporan Analisis GWAS</h1><div class=\"meta\">{judul} · ID sesi {a.analysis_id} · "
        f"<em>{escape(org_sci)}</em> · sifat {escape(str(r.get('trait', '–')))} · "
        f"model {escape(str(r.get('model', '–')))}</div>"
        + "".join(bagian)
        + f"<footer>Dibuat oleh GWASena pada {waktu}. Hasil GWAS menunjukkan asosiasi statistik, "
          "bukan bukti sebab-akibat; kandidat gen perlu divalidasi lebih lanjut.</footer></body></html>"
    )
