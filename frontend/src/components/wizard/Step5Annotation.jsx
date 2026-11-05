import { useState, useEffect, useMemo } from 'react';
import {
  Dna,
  Database,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Search,
  BookOpen,
  Loader2,
  CheckCircle2,
  Sparkles,
  Info,
} from 'lucide-react';
import { useAnalysisStore } from '../../store/useAnalysisStore.js';
import { analysisService } from '../../services/analysisService.js';

/**
 * Step5Annotation (Langkah 5): Anotasi Kandidat Gen dari GFF3 Lokal (FR-07, AC-07.1, AC-07.2)
 * Acuan: 08 — Anotasi Gen (Selesai).png & 08b — Anotasi Gen_ Tidak Tersedia.png
 *
 * Menampilkan pemetaan SNP signifikan dan teratas ke kandidat gen lokal GFF3
 * serta mekanisme non-blocking fallback jika berkas GFF3 tidak tersedia.
 */
export default function Step5Annotation({ analysisId, onNavigateStep }) {
  const { results, isSimulated } = useAnalysisStore();

  const [annotationData, setAnnotationData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSimulateFallback, setIsSimulateFallback] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchAnnotation() {
      if (analysisId && !isSimulated) {
        setIsLoading(true);
        try {
          // Panggil endpoint resmi backend: GET /api/analyses/{id}/annotation?sertakan_teratas=true
          const data = await analysisService.getAnnotation(analysisId, true);
          if (isMounted) {
            setAnnotationData(data);
          }
        } catch (err) {
          console.warn('Gagal memuat anotasi dari backend, menggunakan status tidak_tersedia (non-blocking):', err);
          if (isMounted) {
            setAnnotationData({
              status: 'tidak_tersedia',
              sumber: 'Berkas anotasi genom lokal (GFF3)',
              jendela_bp: 50000,
              pesan: 'Anotasi gen sementara tidak tersedia. Berkas anotasi GFF3 tidak dapat dibaca dari server.',
              kandidat: [],
            });
          }
        } finally {
          if (isMounted) setIsLoading(false);
        }
      } else {
        // Mode simulasi / demo offline GWASena (Allium sativum GFF3)
        setAnnotationData({
          status: 'tersedia',
          sumber: 'Berkas anotasi genom lokal (GFF3): Allium_sativum_annotation.gff3',
          jendela_bp: 50000,
          pesan: '1 dari 1 SNP signifikan memiliki kandidat gen dalam jendela 50.000 bp.',
          kandidat: [
            {
              snp_id: 'snp_chr3_0042',
              chromosome: 3,
              position: 1245000,
              p_value: 0.00001,
              signifikan: true,
              gen: [
                {
                  gene_id: 'GC3G9001',
                  nama: 'GC3G9001',
                  deskripsi: 'Putative alliinase-like protein involved in allicin biosynthesis and bulb organogenesis',
                  awal: 1240000,
                  akhir: 1250000,
                  untai: '+',
                  jarak_bp: 0,
                  konsekuensi: 'intragenic_variant',
                  letak: 'di dalam gen',
                },
              ],
            },
          ],
        });
      }
    }

    fetchAnnotation();

    return () => {
      isMounted = false;
    };
  }, [analysisId, isSimulated]);

  // Ekstrak dan ratakan daftar gen dari payload kandidat backend
  const flattenedGenes = useMemo(() => {
    const list = [];
    const candidates = Array.isArray(annotationData?.kandidat) ? annotationData.kandidat : [];

    candidates.forEach((cand) => {
      if (Array.isArray(cand.gen) && cand.gen.length > 0) {
        cand.gen.forEach((g, gIdx) => {
          let priorityBadge = `Gen Terdekat #${gIdx + 1}`;
          const letakStr = (g.letak || '').toLowerCase();
          if (g.jarak_bp === 0 || letakStr.includes('dalam') || g.konsekuensi?.includes('intragenic')) {
            priorityBadge = `Gen Terdekat #${gIdx + 1} (Intragenik)`;
          } else if (letakStr.includes('hilir') || letakStr.includes('downstream') || (g.jarak_bp && g.jarak_bp > 0 && g.untai === '+')) {
            priorityBadge = `Gen Terdekat #${gIdx + 1} (Hilir / Downstream)`;
          } else if (letakStr.includes('hulu') || letakStr.includes('upstream') || (g.jarak_bp && g.jarak_bp > 0)) {
            priorityBadge = `Gen Terdekat #${gIdx + 1} (Hulu / Upstream)`;
          }

          list.push({
            snp_id: cand.snp_id,
            chromosome: cand.chromosome,
            position: cand.position,
            p_value: cand.p_value,
            signifikan: Boolean(cand.signifikan),
            gene_id: g.gene_id,
            nama: g.nama,
            deskripsi: g.deskripsi,
            awal: g.awal,
            akhir: g.akhir,
            untai: g.untai,
            jarak_bp: g.jarak_bp,
            konsekuensi: g.konsekuensi,
            letak: g.letak || (g.jarak_bp === 0 ? 'di dalam gen' : 'dekat gen'),
            gene_order: gIdx + 1,
            total_genes: cand.gen.length,
            priorityBadge,
          });
        });
      } else {
        list.push({
          snp_id: cand.snp_id,
          chromosome: cand.chromosome,
          position: cand.position,
          p_value: cand.p_value,
          signifikan: Boolean(cand.signifikan),
          gene_id: null,
          nama: null,
          deskripsi: 'Tidak ditemukan fitur gen dalam jendela anotasi ±50 kb.',
          jarak_bp: null,
          konsekuensi: 'intergenic_variant',
          letak: 'antargen (intergenik)',
          gene_order: 1,
          total_genes: 1,
          priorityBadge: 'Intergenik (Luar Gen)',
        });
      }
    });

    return list;
  }, [annotationData]);

  // Jumlah SNP signifikan unik yang dipetakan
  const uniqueSnpCount = useMemo(() => {
    const snpSet = new Set();
    const candidates = Array.isArray(annotationData?.kandidat) ? annotationData.kandidat : [];
    candidates.forEach((cand) => {
      if (cand.snp_id) snpSet.add(cand.snp_id);
    });
    return snpSet.size || results?.significant_snps?.length || 1;
  }, [annotationData, results]);

  // Filter pencarian
  const filteredGenes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return flattenedGenes;

    return flattenedGenes.filter((item) => {
      return (
        item.snp_id?.toLowerCase().includes(q) ||
        item.gene_id?.toLowerCase().includes(q) ||
        item.nama?.toLowerCase().includes(q) ||
        item.konsekuensi?.toLowerCase().includes(q) ||
        item.letak?.toLowerCase().includes(q) ||
        item.deskripsi?.toLowerCase().includes(q) ||
        String(item.chromosome).includes(q)
      );
    });
  }, [flattenedGenes, searchQuery]);

  const isUnavailable = annotationData?.status === 'tidak_tersedia' || isSimulateFallback;
  const windowKb = Math.round((annotationData?.jendela_bp || 50000) / 1000);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Sub-Navigasi Cepat Pasca-Komputasi (Figma Style) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl glass-subcard">
          <button
            type="button"
            onClick={() => onNavigateStep(4)}
            className="rounded-xl px-3.5 py-1.5 text-xs font-sans font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            Hasil & Visualisasi
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#5B4DFE] px-3.5 py-1.5 text-xs font-sans font-bold text-white shadow-sm"
          >
            Anotasi Gen
          </button>
          <button
            type="button"
            onClick={() => onNavigateStep(6)}
            className="rounded-xl px-3.5 py-1.5 text-xs font-sans font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            Ekspor & Laporan
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateStep(4)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#162142] px-3.5 py-2 text-xs font-sans font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1E2C58] hover:-translate-y-[1px] active:scale-[0.97] active:brightness-95 transition-all duration-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Plot</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateStep(6)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#5B4DFE] hover:bg-[#4F46E5] px-4 py-2 text-xs font-sans font-bold text-white shadow-lg shadow-[#5B4DFE]/30 hover:-translate-y-[1px] hover:shadow-xl active:scale-[0.97] active:brightness-95 transition-all duration-100"
          >
            <span>Lanjut ke Ekspor</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Banner Status Referensi Genom (GFF3 Lokal) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl figma-card p-4 sm:p-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-[#5B4DFE]/20 text-indigo-600 dark:text-[#06B6D4]">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-sans font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
              <span>{annotationData?.sumber || 'Berkas Anotasi Genom Lokal (GFF3)'}</span>
              {!isUnavailable ? (
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-0.5 text-xs font-sans font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                  Anotasi GFF3 Tersedia (±{windowKb} kb)
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 dark:bg-amber-500/20 px-2.5 py-0.5 text-xs font-sans font-bold text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                  Anotasi Tidak Tersedia (Non-Blocking)
                </span>
              )}
            </h4>
            <p className="text-xs sm:text-[13px] font-sans text-slate-700 dark:text-slate-300 font-medium">
              Pemetaan posisi lokus penanda SNP ke struktur gen fungsional Allium sativum (jendela anotasi: &plusmn;{windowKb} kb).
            </p>
          </div>
        </div>

        {/* Demo Switch Fallback untuk Pengujian Ketahanan Sistem */}
        <button
          type="button"
          onClick={() => setIsSimulateFallback(!isSimulateFallback)}
          className="rounded-full border border-slate-300 dark:border-white/10 bg-white/90 dark:bg-[#162142] px-4 py-1.5 text-xs font-sans font-bold text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E2C58] hover:-translate-y-[1px] active:scale-[0.97] transition-all duration-100 self-start sm:self-auto shadow-sm"
          title="Uji ketahanan sistem jika berkas anotasi GFF3 rusak/hilang"
        >
          {isSimulateFallback ? 'Pulihkan Status Normal' : 'Simulasi Anotasi Tidak Tersedia'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center p-8 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#06B6D4]" />
          <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
            Mencocokkan posisi SNP dengan berkas anotasi GFF3 lokal...
          </p>
        </div>
      ) : isUnavailable ? (
        /* ── State Non-Blocking Fallback (AC-07.2) ── */
        <div className="rounded-3xl figma-card border-amber-300/80 dark:border-amber-500/40 bg-amber-50/80 dark:bg-amber-500/10 p-5 sm:p-6 space-y-3 animate-fade-in backdrop-blur-md">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-sans font-bold text-amber-950 dark:text-white">
                Layanan Referensi Anotasi Gen Sementara Tidak Tersedia
              </h4>
              <p className="text-xs font-serif leading-relaxed text-amber-900 dark:text-slate-300">
                {annotationData?.pesan ||
                  'Berkas anotasi GFF3 tidak dapat dibaca dari server atau fitur gen belum dikonfigurasi. Sesuai prinsip ketahanan sistem GWASena 2.0 (AC-07.2), kegagalan anotasi gen bersifat non-fatal. Hasil statistik asosiasi Anda pada Hasil & Visualisasi dan fitur unduh CSV pada Ekspor & Laporan tetap dapat digunakan sepenuhnya tanpa hambatan.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => onNavigateStep(6)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5B4DFE] hover:bg-[#4F46E5] px-4 py-2 text-xs font-sans font-bold text-white shadow-md shadow-[#5B4DFE]/30 hover:-translate-y-[1px] hover:shadow-lg active:scale-[0.98] transition-all duration-100"
            >
              <span>Lanjut ke Pengunduhan Data (Ekspor & Laporan) &rarr;</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── State Normal: Tabel Kandidat Gen dari GFF3 ── */
        <div className="rounded-3xl figma-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3.5">
            <div>
              <h4 className="text-sm sm:text-base font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Dna className="h-4 w-4 text-[#06B6D4]" />
                <span>Tabel Pemetaan Kandidat Gen (GFF3 Lokal)</span>
              </h4>
              <p className="text-xs sm:text-[13px] font-sans text-slate-700 dark:text-slate-300 font-medium">
                {annotationData?.pesan ||
                  `Ditemukan ${flattenedGenes.length} kandidat gen fungsional dalam jendela ±${windowKb} kb.`}
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari gen, SNP, konsekuensi..."
                className="w-56 sm:w-72 figma-input pl-8 pr-3 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
              />
            </div>
          </div>

          {/* Teks Ringkasan Edukatif Pemetaan Kandidat Gen (Tester Evaluation Item 6) */}
          <div className="rounded-2xl border border-indigo-200 dark:border-[#5B4DFE]/30 bg-indigo-50/70 dark:bg-[#5B4DFE]/10 p-3.5 sm:p-4 text-xs sm:text-sm text-indigo-950 dark:text-indigo-200 flex items-start gap-2.5 font-medium shadow-sm">
            <Info className="h-4 w-4 text-indigo-600 dark:text-[#06B6D4] shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Menampilkan <strong>{filteredGenes.length} Kandidat Gen</strong> yang dipetakan dari <strong>{uniqueSnpCount} SNP Signifikan</strong> (1 SNP dapat berdekatan dengan &gt;1 gen dalam radius ±50.000 bp).
            </span>
          </div>

          {filteredGenes.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-600 dark:text-slate-400 font-sans">
              <BookOpen className="h-6 w-6 mx-auto mb-2 text-slate-400" />
              <p className="font-semibold text-slate-800 dark:text-white">
                Tidak ada kandidat gen yang cocok dengan kriteria pencarian.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 uppercase font-sans font-bold bg-slate-100/95 dark:bg-[#0B132C]/90">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center">NO.</th>
                    <th className="py-3 px-3.5">SNP ID</th>
                    <th className="py-3 px-3.5">Kromosom & Posisi</th>
                    <th className="py-3 px-3.5">Kandidat Gen</th>
                    <th className="py-3 px-3.5">Jarak / Letak Relatif</th>
                    <th className="py-3 px-3.5">Konsekuensi Fungsional</th>
                    <th className="py-3 px-3.5">Deskripsi Biologis & Koordinat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredGenes.map((gene, idx) => (
                    <tr
                      key={`${gene.snp_id}-${gene.gene_id || idx}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-[#0284C7] dark:text-[#06B6D4]">
                        <div className="flex items-center gap-1.5">
                          <span>{gene.snp_id}</span>
                          {gene.signifikan && (
                            <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 text-[10px] font-sans font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                              Signifikan
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-900 dark:text-white tabular-nums font-semibold">
                        Chr {gene.chromosome} : {Number(gene.position).toLocaleString('id-ID')} bp
                      </td>
                      <td className="py-3 px-3.5">
                        {gene.gene_id ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {gene.gene_id}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-cyan-100 dark:bg-[#06B6D4]/15 border border-cyan-300 dark:border-[#06B6D4]/30 px-2 py-0.5 text-[10px] font-sans font-bold text-cyan-900 dark:text-[#06B6D4]">
                                {gene.priorityBadge}
                              </span>
                            </div>
                            {gene.nama && gene.nama !== gene.gene_id && (
                              <span className="text-xs font-serif text-slate-600 dark:text-slate-300 italic block font-semibold">
                                {gene.nama}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-slate-400 font-mono">-</span>
                            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 px-2 py-0.5 text-[10px] font-sans font-semibold text-slate-600 dark:text-slate-400">
                              {gene.priorityBadge}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-800 dark:text-slate-200">
                        <div className="space-y-0.5">
                          <span className="block font-semibold capitalize text-slate-900 dark:text-white font-sans text-xs">
                            {gene.letak}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {gene.jarak_bp === 0
                              ? '0 bp (Intragenik)'
                              : gene.jarak_bp !== null
                              ? `${gene.jarak_bp.toLocaleString('id-ID')} bp`
                              : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="inline-block rounded-xl border border-indigo-200 dark:border-[#5B4DFE]/30 bg-indigo-50 dark:bg-[#5B4DFE]/15 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-700 dark:text-[#A5B4FC]">
                          {gene.konsekuensi}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 max-w-sm text-xs sm:text-sm">
                        <p className="font-serif text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                          {gene.deskripsi || 'Gen struktural fungsional Allium sativum.'}
                        </p>
                        {gene.awal && gene.akhir && (
                          <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Untai ({gene.untai || '+'}) : {gene.awal.toLocaleString('id-ID')} – {gene.akhir.toLocaleString('id-ID')} bp
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="glass-subcard p-3.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2.5 font-medium">
            <BookOpen className="h-4 w-4 text-[#0284C7] dark:text-[#06B6D4] shrink-0 mt-0.5" />
            <p className="font-sans leading-relaxed">
              Anotasi gen biologis memetakan lokus kuantitatif (QTL) asosiasi penanda SNP dengan gen penentu sifat fungsional,
              regulasi ekspresi genetik, dan jalur biosintesis spesifik populasi Allium sativum dari berkas GFF3 lokal.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
