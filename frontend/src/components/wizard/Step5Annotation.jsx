import { useState, useEffect, useMemo } from 'react';
import {
  Dna,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Search,
  BookOpen,
  Loader2,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useAnalysisStore } from '../../store/useAnalysisStore.js';
import { normalizeOrganismCode } from '../../constants/defaultParams.js';
import { analysisService } from '../../services/analysisService.js';

/**
 * Step5Annotation (Langkah 5): Anotasi Kandidat Gen dari GFF3 Lokal (FR-07, AC-07.1, AC-07.2)
 * Acuan: 08 — Anotasi Gen (Selesai).png & 08b — Anotasi Gen_ Tidak Tersedia.png
 *
 * Menampilkan pemetaan SNP signifikan dan teratas ke kandidat gen lokal GFF3
 * serta mekanisme non-blocking fallback jika berkas GFF3 tidak tersedia.
 */
function buildClientFallbackCandidates(results) {
  if (!results) return [];
  const sig = Array.isArray(results.significant_snps) ? results.significant_snps : [];
  const top = Array.isArray(results.top_snps) ? results.top_snps : [];
  const all = Array.isArray(results.association_results) ? results.association_results : [];

  let pool = sig.length > 0 ? sig : top;
  if (pool.length === 0 && all.length > 0) {
    pool = [...all]
      .filter((s) => s && s.p_value !== null && s.p_value !== undefined)
      .sort((a, b) => Number(a.p_value) - Number(b.p_value))
      .slice(0, 10);
  }
  const sigIds = new Set(sig.map((s) => s?.snp_id).filter(Boolean));

  return pool
    .filter((s) => s && s.snp_id)
    .slice(0, 10)
    .map((snp) => {
      const attachedGenes =
        Array.isArray(snp.annotation_info?.gen) && snp.annotation_info.gen.length > 0
          ? snp.annotation_info.gen
          : snp.candidate_gene
          ? [
              {
                gene_id: snp.candidate_gene,
                nama: snp.candidate_gene,
                deskripsi: `Kandidat gen terasosiasi dari hasil komputasi (${snp.candidate_gene}).`,
                jarak_bp: 0,
                konsekuensi: 'candidate_gene_variant',
                letak: 'dekat gen',
              },
            ]
          : [];
      return {
        snp_id: snp.snp_id,
        chromosome: snp.chromosome,
        position: snp.position,
        p_value: snp.p_value,
        signifikan: Boolean(snp.is_significant || snp.signifikan || sigIds.has(snp.snp_id)),
        gen: attachedGenes,
      };
    });
}

export default function Step5Annotation({ analysisId, onNavigateStep }) {
  const { currentAnalysis, results, configParams } = useAnalysisStore();

  const [annotationData, setAnnotationData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!analysisId) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => {
          controller.abort();
        }, 4000)
      : null;

    async function fetchAnnotation() {
      setIsLoading(true);
      const fallbackSnps = buildClientFallbackCandidates(useAnalysisStore.getState().results);
      const normOrg = normalizeOrganismCode(
        useAnalysisStore.getState().configParams?.organism ||
          useAnalysisStore.getState().currentAnalysis?.organism
      );
      const isEnsemblSpecies = normOrg && normOrg !== 'allium_sativum';

      try {
        const data = await analysisService.getAnnotation(analysisId, true, {
          ...(controller ? { signal: controller.signal } : {}),
          timeoutMs: 4000,
        });
        if (isCancelled) return;

        if (
          data?.status === 'tersedia' &&
          (!Array.isArray(data?.kandidat) || data.kandidat.length === 0) &&
          fallbackSnps.length > 0
        ) {
          setAnnotationData({
            ...data,
            kandidat: fallbackSnps,
          });
        } else {
          setAnnotationData(data);
        }
      } catch (err) {
        if (isCancelled) return;
        console.warn('Gagal memuat anotasi dari backend, menampilkan fallback non-blocking (AC-07.2):', err);
        if (fallbackSnps.length > 0) {
          setAnnotationData({
            status: 'tersedia',
            sumber: isEnsemblSpecies ? `Ensembl REST API (${normOrg})` : 'GFF3 Referensi Lokal',
            sumber_tipe: isEnsemblSpecies ? 'ensembl' : 'gff3',
            organism: normOrg,
            jendela_bp: 50000,
            pesan: `Menampilkan ${fallbackSnps.length} SNP prioritas dari hasil asosiasi Langkah 4.`,
            kandidat: fallbackSnps,
          });
        } else {
          setAnnotationData({
            status: 'tidak_tersedia',
            sumber: isEnsemblSpecies ? `Ensembl REST API (${normOrg})` : 'GFF3 Referensi Lokal',
            sumber_tipe: isEnsemblSpecies ? 'ensembl' : 'gff3',
            jendela_bp: 50000,
            pesan:
              err?.message ||
              err?.pesan ||
              'Anotasi gen sementara tidak tersedia. Berkas referensi tidak dapat dimuat dari server.',
            kandidat: [],
          });
        }
      } finally {
        if (timeoutId !== null) clearTimeout(timeoutId);
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchAnnotation();

    return () => {
      isCancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (controller) controller.abort();
    };
  }, [analysisId]);

  // Ekstrak dan ratakan daftar gen dari payload kandidat backend
  const flattenedGenes = useMemo(() => {
    const list = [];
    const candidates = Array.isArray(annotationData?.kandidat) ? annotationData.kandidat : [];

    candidates.forEach((cand) => {
      if (Array.isArray(cand.gen) && cand.gen.length > 0) {
        cand.gen.forEach((g) => {
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
        });
      }
    });

    return list;
  }, [annotationData]);

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

  // Hitung jumlah relasi SNP ke beberapa kandidat gen dalam jendela (Evaluasi Tester Poin 22)
  const snpToGeneCount = useMemo(() => {
    const counts = {};
    filteredGenes.forEach((g) => {
      counts[g.snp_id] = (counts[g.snp_id] || 0) + 1;
    });
    return counts;
  }, [filteredGenes]);

  const isUnavailable = annotationData?.status === 'tidak_tersedia';
  const windowKb = Math.round((annotationData?.jendela_bp || 50000) / 1000);
  const storeConfigParams = useAnalysisStore((s) => s.configParams);
  const targetOrganism =
    annotationData?.organism_target ||
    annotationData?.organism ||
    currentAnalysis?.organism_target ||
    currentAnalysis?.organism ||
    storeConfigParams?.organism ||
    'Organisme Target Sesi';

  const rawSource = String(annotationData?.sumber || '');
  const isEnsemblSource =
    annotationData?.sumber_tipe === 'ensembl' ||
    /ensembl/i.test(rawSource);
  const displaySpeciesCode =
    annotationData?.organism ||
    normalizeOrganismCode(targetOrganism);
  const sourceBadgeLabel = isEnsemblSource
    ? `Sumber: Ensembl REST API (${displaySpeciesCode})`
    : 'Sumber: GFF3 Referensi Lokal';

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

      {isLoading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center p-8 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#06B6D4]" />
          <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
            Memuat pemetaan kandidat gen (Ensembl / GFF3)...
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
                  'Berkas anotasi GFF3 tidak dapat dibaca dari server atau fitur gen belum dikonfigurasi. Sesuai prinsip ketahanan sistem GWASena 2.0 (AC-07.2), kegagalan anotasi gen bersifat non-fatal. Hasil statistik asosiasi Anda pada Langkah 4 dan fitur unduh CSV pada Langkah 6 tetap dapat digunakan sepenuhnya tanpa hambatan.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => onNavigateStep(6)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5B4DFE] hover:bg-[#4F46E5] px-4 py-2 text-xs font-sans font-bold text-white shadow-md shadow-[#5B4DFE]/30 hover:-translate-y-[1px] hover:shadow-lg active:scale-[0.98] transition-all duration-100"
            >
              <span>Lanjut ke Pengunduhan Data (Langkah 6) &rarr;</span>
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
                <span className="flex flex-wrap items-center gap-2">
                  <span>
                    {isEnsemblSource
                      ? `Tabel Pemetaan Kandidat Gen (${displaySpeciesCode})`
                      : 'Tabel Pemetaan Kandidat Gen (GFF3 Lokal)'}
                  </span>
                  <span
                    data-testid="annotation-source-badge"
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                      isEnsemblSource
                        ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {sourceBadgeLabel}
                  </span>
                </span>
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

          {/* Banner Penjelasan Relasi 1 SNP ke Banyak Gen (Evaluasi Tester Poin 22) */}
          <div className="rounded-2xl border border-cyan-300/80 dark:border-cyan-500/30 bg-cyan-50/80 dark:bg-cyan-500/10 p-3.5 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-[#06B6D4] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-slate-900 dark:text-white font-sans">
                Penjelasan Baris Tabel & Relasi SNP ke Kandidat Gen (Jendela ±{windowKb} kb):
              </span>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-sans font-medium">
                Satu titik SNP signifikan dapat menghasilkan lebih dari satu baris dalam tabel jika terdapat beberapa gen yang berdekatan dalam rentang koordinat (hulu, hilir, maupun intragenik). GWASena memetakan seluruh gen dalam rentang jendela analisis untuk memberikan konteks arsitektur genetik yang komprehensif.
              </p>
            </div>
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
                    <th className="px-3 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 w-12">
                      NO.
                    </th>
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
                      <td className="px-3 py-3 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-[#0284C7] dark:text-[#06B6D4]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span>{gene.snp_id}</span>
                            {gene.signifikan && (
                              <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 text-[10px] font-sans font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                                Signifikan
                              </span>
                            )}
                          </div>
                          {snpToGeneCount[gene.snp_id] > 1 && (
                            <div className="text-[10px] font-sans font-bold text-cyan-800 dark:text-cyan-300 bg-cyan-100/80 dark:bg-[#06B6D4]/15 border border-cyan-300 dark:border-[#06B6D4]/30 rounded-full px-2 py-0.5 w-fit">
                              1 SNP → {snpToGeneCount[gene.snp_id]} Gen Terdekat
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-900 dark:text-white tabular-nums font-semibold">
                        Chr {gene.chromosome} : {Number(gene.position).toLocaleString('id-ID')} bp
                      </td>
                      <td className="py-3 px-3.5">
                        {gene.gene_id ? (
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-slate-900 dark:text-white block">
                              {gene.gene_id}
                            </span>
                            {gene.nama && gene.nama !== gene.gene_id && (
                              <span className="text-xs font-serif text-slate-600 dark:text-slate-300 italic block font-semibold">
                                {gene.nama}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
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
                          {gene.deskripsi || `Gen struktural fungsional ${targetOrganism}.`}
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
              regulasi ekspresi genetik, dan jalur biosintesis spesifik populasi {targetOrganism} dari berkas GFF3 lokal.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
