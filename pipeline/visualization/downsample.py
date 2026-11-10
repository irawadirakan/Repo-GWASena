"""Smart downsampling titik Manhattan plot.

Data GWAS sungguhan bisa berisi ratusan ribu sampai jutaan SNP. Mengirim semuanya
ke browser membuat grafik interaktif berat, padahal hampir semua titik berada di
bagian bawah grafik (p besar) dan saling menumpuk.

Aturan peringkasan:
  1. titik yang signifikan atau -log10(p) >= ambang_pertahankan SELALU dipertahankan;
  2. titik sisanya dibagi ke dalam "bin" posisi per kromosom; dari tiap bin hanya
     titik dengan -log10(p) tertinggi dan terendah yang diambil, sehingga bentuk
     sebaran (puncak dan dasar) tetap terlihat;
  3. jumlah bin dihitung otomatis agar total titik mendekati maks_titik.

Fungsi ini deterministik (tanpa acak), jadi grafik yang sama selalu menghasilkan
titik yang sama.
"""
from collections import defaultdict


def smart_downsample(titik: list[dict], maks_titik: int, ambang_pertahankan: float = 3.0) -> dict:
    """titik: [{snp_id, chromosome, position, neglog10p, signifikan}] (urut kromosom-posisi)."""
    total = len(titik)
    if maks_titik <= 0 or total <= maks_titik:
        return {"titik": titik, "diringkas": False, "jumlah_asli": total, "jumlah_ditampilkan": total}

    penting = [t for t in titik if t.get("signifikan") or t["neglog10p"] >= ambang_pertahankan]
    sisa = [t for t in titik if not (t.get("signifikan") or t["neglog10p"] >= ambang_pertahankan)]
    kuota = max(maks_titik - len(penting), 0)

    terpilih = list(penting)
    if kuota > 0 and sisa:
        per_krom = defaultdict(list)
        for t in sisa:
            per_krom[t["chromosome"]].append(t)
        n_bin_total = max(kuota // 2, 1)  # tiap bin menyumbang maksimal 2 titik
        for c, daftar in per_krom.items():
            n_bin = max(1, int(n_bin_total * len(daftar) / len(sisa)))
            lo = min(t["position"] for t in daftar)
            hi = max(t["position"] for t in daftar)
            lebar = max((hi - lo + 1) / n_bin, 1)
            bins = defaultdict(list)
            for t in daftar:
                bins[int((t["position"] - lo) // lebar)].append(t)
            for isi in bins.values():
                tinggi = max(isi, key=lambda t: t["neglog10p"])
                rendah = min(isi, key=lambda t: t["neglog10p"])
                terpilih.append(tinggi)
                if rendah is not tinggi:
                    terpilih.append(rendah)

    unik = list({id(t): t for t in terpilih}.values())
    lebih = len(unik) - max(maks_titik, len(penting))
    if lebih > 0:  # pembulatan jumlah bin bisa sedikit melebihi kuota: buang titik terendah
        id_penting = {id(t) for t in penting}
        buang = sorted((t for t in unik if id(t) not in id_penting), key=lambda t: t["neglog10p"])[:lebih]
        id_buang = {id(t) for t in buang}
        unik = [t for t in unik if id(t) not in id_buang]
    urutan = {id(t): i for i, t in enumerate(titik)}
    terpilih = sorted(unik, key=lambda t: urutan[id(t)])
    return {"titik": terpilih, "diringkas": True, "jumlah_asli": total,
            "jumlah_ditampilkan": len(terpilih), "ambang_pertahankan": ambang_pertahankan}
