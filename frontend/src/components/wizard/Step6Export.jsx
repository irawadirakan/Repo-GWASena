import { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Image,
  FileText,
  CheckCircle2,
  ArrowLeft,
  Printer,
  X,
  Dna,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useAnalysisStore } from '../../store/useAnalysisStore.js';
import { generateBenchmarkResults } from '../../services/mockResults.js';
import { analysisService } from '../../services/analysisService.js';

/**
 * Step6Export (Langkah 6): Ekspor Data & Laporan Analisis (Figma Aligned)
 * Acuan: 09 — Ekspor & Laporan.png & 09d — Ekspor_ Laporan Tanpa Kandidat Gen.png
 *
 * Mendukung unduhan resmi CSV hasil asosiasi, gambar plot PNG resolusi tinggi
 * (Plot Manhattan dan QQ Plot dari backend matplotlib), serta laporan ilmiah cetak/PDF.
 */
export default function Step6Export({ analysisId, onNavigateStep }) {
  const { results, configParams, uploadSummary, isSimulated } = useAnalysisStore();
  const activeResults = results || generateBenchmarkResults(configParams, uploadSummary);

  const rawBackend = activeResults?.raw_backend_results || {};
  const qc = activeResults?.summary?.qc || rawBackend?.qc || {};
  const asosiasi = activeResults?.summary?.asosiasi || rawBackend?.asosiasi || {};
  const snps = activeResults?.association_results || [];
  const significantSnps = activeResults?.significant_snps || [];
  const topSnps = activeResults?.top_snps || [];
  const candidateGenes = activeResults?.candidate_genes || [];
  const summary = activeResults?.summary || {};

  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingPlot, setDownloadingPlot] = useState(null); // 'manhattan' | 'qq' | null
  const [downloadSuccess, setDownloadSuccess] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // 1. Unduh CSV Hasil Asosiasi (Endpoint resmi: GET /api/analyses/{id}/results/csv)
  async function handleDownloadCsv() {
    setExportError(null);
    setDownloadingCsv(true);

    if (analysisId && !isSimulated && !activeResults?.is_simulated) {
      try {
        await analysisService.downloadCsv(analysisId);
        setDownloadSuccess('csv');
        setTimeout(() => setDownloadSuccess(null), 4000);
        return;
      } catch (err) {
        console.error('Gagal mengunduh CSV dari server:', err);
        setExportError(err.message || 'Gagal mengunduh CSV hasil analisis dari server.');
      } finally {
        setDownloadingCsv(false);
      }
      return;
    }

    // Fallback khusus mode simulasi offline
    try {
      const headers = [
        'snp_id',
        'chromosome',
        'position',
        'p_value',
        'neg_log10_p',
        'q_value',
        'effect_size',
        'std_error',
        'allele_ref',
        'allele_alt',
        'maf',
        'is_significant',
      ];

      const rows = snps.map((s) => [
        s.snp_id,
        s.chromosome,
        s.position,
        s.p_value,
        s.neg_log10_p ?? -Math.log10(s.p_value),
        s.q_value ?? '',
        s.effect_size,
        s.std_error,
        s.allele_ref,
        s.allele_alt,
        s.maf,
        s.is_significant ? 'TRUE' : 'FALSE',
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute(
        'download',
        `gwasena_simulasi_sesi_${analysisId || '1'}_${summary.trait || 'trait'}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccess('csv');
      setTimeout(() => setDownloadSuccess(null), 4000);
    } catch (simErr) {
      setExportError('Gagal membuat CSV simulasi di peramban.');
    } finally {
      setDownloadingCsv(false);
    }
  }

  // 2. Unduh Gambar Plot PNG Resolusi Tinggi (Endpoint resmi: GET /api/analyses/{id}/plots/{jenis}/png)
  async function handleDownloadPlot(plotType) {
    setExportError(null);

    if (analysisId && !isSimulated && !activeResults?.is_simulated) {
      setDownloadingPlot(plotType);
      try {
        await analysisService.downloadPlotPng(analysisId, plotType);
        setDownloadSuccess(plotType);
        setTimeout(() => setDownloadSuccess(null), 4000);
      } catch (err) {
        console.error(`Gagal mengunduh gambar PNG ${plotType}:`, err);
        setExportError(err.message || `Gagal mengunduh gambar PNG ${plotType} dari server.`);
      } finally {
        setDownloadingPlot(null);
      }
      return;
    }

    // Fallback mode simulasi lokal via toolbar Plotly canvas
    const modeBarButton = document.querySelector(`[data-title="Download plot as a png"]`);
    if (modeBarButton) {
      modeBarButton.click();
      setDownloadSuccess(plotType);
      setTimeout(() => setDownloadSuccess(null), 4000);
    } else {
      alert(
        `Dalam mode simulasi, grafik ${plotType.toUpperCase()} dapat diunduh langsung dari tombol kamera (📷) pada Langkah 4.`
      );
    }
  }

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
            &larr; Langkah 4: Hasil & Visualisasi
          </button>
          <button
            type="button"
            onClick={() => onNavigateStep(5)}
            className="rounded-xl px-3.5 py-1.5 text-xs font-sans font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            Langkah 5: Anotasi Gen
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#5B4DFE] px-3.5 py-1.5 text-xs font-sans font-bold text-white shadow-sm"
          >
            Langkah 6: Ekspor & Laporan
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateStep(4)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#162142] px-3.5 py-2 text-xs font-sans font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1E2C58] transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Plot</span>
          </button>
        </div>
      </div>

      {/* ── Alert Notifikasi Galat Unduhan (409 / 503 / Network Error) ── */}
      {exportError && (
        <div className="rounded-2xl border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 p-4 text-xs sm:text-sm text-red-900 dark:text-red-300 flex items-start justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Gagal Mengunduh Berkas</p>
              <p className="mt-0.5 text-slate-700 dark:text-slate-300">{exportError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-200 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Grid 3 Kartu Ekspor ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Kartu 1: Unduh CSV Asosiasi */}
        <div className="rounded-3xl figma-card p-6 space-y-4 hover:border-emerald-500/40 hover:-translate-y-1 active:scale-[0.985] transition-all duration-150 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-sans font-bold text-slate-900 dark:text-white">
                Tabel Hasil Asosiasi (CSV)
              </h4>
              <span className="inline-block mt-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                Format Data Terstandarisasi
              </span>
            </div>
            <p className="text-xs sm:text-sm font-serif leading-relaxed text-slate-800 dark:text-slate-200">
              Unduh data statistik asosiasi genomik lengkap dari server backend: Chr, Pos, SNP_ID, Ref, Alt, Beta, SE, P_Value, Bonferroni, dan Q_Value FDR.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={downloadingCsv}
            className="w-full mt-4 figma-btn-primary"
          >
            {downloadSuccess === 'csv' ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Berhasil Diunduh!</span>
              </>
            ) : downloadingCsv ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Mengunduh CSV Server...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Unduh CSV Lengkap</span>
              </>
            )}
          </button>
        </div>

        {/* Kartu 2: Unduh PNG Visualisasi Plot */}
        <div className="rounded-3xl figma-card p-6 space-y-4 hover:border-cyan-400/40 hover:-translate-y-1 active:scale-[0.985] transition-all duration-150 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 dark:bg-[#06B6D4]/20 text-cyan-700 dark:text-[#06B6D4]">
              <Image className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-sans font-bold text-slate-900 dark:text-white">
                Visualisasi Plot Resolusi Tinggi
              </h4>
              <span className="inline-block mt-1 rounded-full bg-cyan-100 dark:bg-[#06B6D4]/20 px-2.5 py-0.5 font-mono text-xs font-bold text-cyan-800 dark:text-[#06B6D4] border border-cyan-300 dark:border-[#06B6D4]/30">
                Format Grafis Publikasi (PNG)
              </span>
            </div>
            <p className="text-xs sm:text-sm font-serif leading-relaxed text-slate-800 dark:text-slate-200">
              Ekspor gambar Manhattan Plot dan QQ Plot resolusi tinggi (PNG) hasil render server matplotlib dengan garis Bonferroni dan anotasi diagnostik.
            </p>
          </div>

          <div className="space-y-2 mt-4 font-sans">
            <button
              type="button"
              onClick={() => handleDownloadPlot('manhattan')}
              disabled={downloadingPlot === 'manhattan'}
              className="w-full figma-btn-secondary"
            >
              {downloadSuccess === 'manhattan' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Berhasil Diunduh!</span>
                </>
              ) : downloadingPlot === 'manhattan' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#06B6D4]" />
                  <span>Mengunduh Manhattan PNG...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Unduh Manhattan Plot (PNG)</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleDownloadPlot('qq')}
              disabled={downloadingPlot === 'qq'}
              className="w-full figma-btn-secondary"
            >
              {downloadSuccess === 'qq' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Berhasil Diunduh!</span>
                </>
              ) : downloadingPlot === 'qq' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#06B6D4]" />
                  <span>Mengunduh QQ Plot PNG...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Unduh QQ Plot (PNG)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Kartu 3: Laporan Riset Ilmiah (PDF / Web Report) */}
        <div className="rounded-3xl figma-card p-6 space-y-4 hover:border-indigo-400/40 hover:-translate-y-1 active:scale-[0.985] transition-all duration-150 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-[#5B4DFE]/20 text-indigo-700 dark:text-[#5B4DFE]">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-sans font-bold text-slate-900 dark:text-white">
                Laporan Interpretasi Ilmiah
              </h4>
              <span className="inline-block mt-1 rounded-full bg-indigo-100 dark:bg-[#5B4DFE]/20 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-800 dark:text-[#A5B4FC] border border-indigo-200 dark:border-[#5B4DFE]/30">
                Format Laporan Eksekutif
              </span>
            </div>
            <p className="text-xs sm:text-sm font-serif leading-relaxed text-slate-800 dark:text-slate-200">
              Hasilkan laporan ringkasan eksekutif komprehensif berisi parameter QC, model asosiasi,
              daftar SNP signifikan, metrik $\lambda_{{GC}}$, dan daftar kandidat temuan.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="w-full mt-4 figma-btn-primary"
          >
            <Printer className="h-4 w-4" />
            <span>Buka Laporan Riset Lengkap</span>
          </button>
        </div>
      </div>

      {/* ── Modal Laporan Ilmiah Siap Cetak ── */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative my-8 w-full max-w-4xl rounded-3xl figma-card p-6 sm:p-8 shadow-2xl text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto animate-modal-in">
            {/* Header Dialog */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <Dna className="h-5 w-5 text-cyan-600 dark:text-[#06B6D4]" />
                <h3 className="text-base sm:text-lg font-sans font-bold">
                  Laporan Analisis Asosiasi Genomik — GWASena
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#5B4DFE] hover:bg-[#4F46E5] px-3.5 py-1.5 text-xs font-sans font-bold text-white shadow-sm hover:-translate-y-[1px] hover:shadow-md active:scale-[0.98] transition-all duration-100"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Cetak / Simpan PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="rounded-xl p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Dokumen Laporan (Print-Friendly) */}
            <div className="space-y-6 pt-6 text-xs" id="scientific-report-content">
              {/* Metadata Sesi */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl glass-subcard p-4">
                <div>
                  <span className="text-xs font-sans text-slate-800 dark:text-slate-200 block uppercase tracking-wider font-bold">ID Sesi Analisis</span>
                  <span className="font-mono font-bold text-[#0284C7] dark:text-[#06B6D4] text-sm">#{analysisId || '1'}</span>
                </div>
                <div>
                  <span className="text-xs font-sans text-slate-800 dark:text-slate-200 block uppercase tracking-wider font-bold">Organisme Target</span>
                  <span className="font-serif font-bold italic text-slate-900 dark:text-white text-sm">
                    {summary.organism || 'Allium sativum (Bawang Putih)'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-sans text-slate-800 dark:text-slate-200 block uppercase tracking-wider font-bold">Sifat Fenotipe</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {asosiasi.trait || summary.trait || 'bobot_umbi'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-sans text-slate-800 dark:text-slate-200 block uppercase tracking-wider font-bold">Waktu Analisis</span>
                  <span className="text-slate-800 dark:text-slate-200 font-sans font-medium text-sm">{new Date().toLocaleDateString('id-ID')}</span>
                </div>
              </div>

              {/* Ringkasan Konfigurasi QC & Pipeline */}
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-sans font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  1. Parameter Quality Control & Pemodelan
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs sm:text-sm">
                  <div className="p-3 rounded-xl glass-subcard">
                    <span className="text-slate-700 dark:text-slate-300 block font-sans text-xs font-medium">Missingness Sampel (mind):</span>
                    <span className="font-bold text-slate-900 dark:text-white">{configParams.mind || 0.10}</span>
                  </div>
                  <div className="p-3 rounded-xl glass-subcard">
                    <span className="text-slate-700 dark:text-slate-300 block font-sans text-xs font-medium">Missingness SNP (geno):</span>
                    <span className="font-bold text-slate-900 dark:text-white">{configParams.geno || 0.10}</span>
                  </div>
                  <div className="p-3 rounded-xl glass-subcard">
                    <span className="text-slate-700 dark:text-slate-300 block font-sans text-xs font-medium">Minor Allele Freq (MAF):</span>
                    <span className="font-bold text-slate-900 dark:text-white">{configParams.maf || 0.05}</span>
                  </div>
                  <div className="p-3 rounded-xl glass-subcard">
                    <span className="text-slate-700 dark:text-slate-300 block font-sans text-xs font-medium">Model Statistik:</span>
                    <span className="font-bold text-[#0284C7] dark:text-[#06B6D4]">{asosiasi.model || summary.model || 'MLM'}</span>
                  </div>
                </div>
              </div>

              {/* Ringkasan Metrik Temuan */}
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-sans font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  2. Ringkasan Metrik Hasil Uji Asosiasi
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs sm:text-sm">
                  <div className="p-3 rounded-xl glass-subcard">
                    <span className="text-slate-700 dark:text-slate-300 block font-sans text-xs font-medium">Sampel Lolos QC:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{qc.sampel_lolos ?? summary.samples_passed_qc ?? '-'}</span>
                  </div>
                  <div className="p-3 rounded-xl glass-subcard">
                    <span className="text-slate-700 dark:text-slate-300 block font-sans text-xs font-medium">SNP Lolos QC:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{qc.snp_lolos ?? summary.snps_passed_qc ?? snps.length}</span>
                  </div>
                  <div className="p-3 rounded-xl glass-subcard">
                    <span className="text-slate-700 dark:text-slate-300 block font-sans text-xs font-medium">SNP Signifikan:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{asosiasi.jumlah_signifikan ?? significantSnps.length}</span>
                  </div>
                  <div className="p-3 rounded-xl glass-subcard">
                    <span className="text-slate-700 dark:text-slate-300 block font-sans text-xs font-medium">Inflasi Genomik (λ_GC):</span>
                    <span className="font-bold text-slate-900 dark:text-white">{Number(asosiasi.lambda_gc ?? summary.lambda_gc ?? 1.04).toFixed(3)}</span>
                  </div>
                </div>
              </div>

              {/* Tabel SNP Signifikan / Teratas */}
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-sans font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  3. Penanda SNP Unggulan & Asosiasi Genomik
                </h4>
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100/95 dark:bg-[#0B132C]/90 text-xs text-slate-800 dark:text-slate-200 uppercase font-sans font-bold">
                      <tr>
                        <th className="py-3 px-3.5">SNP ID</th>
                        <th className="py-3 px-3.5">Kromosom</th>
                        <th className="py-3 px-3.5">Posisi (bp)</th>
                        <th className="py-3 px-3.5">p-value</th>
                        <th className="py-3 px-3.5">Effect Size (Beta)</th>
                        <th className="py-3 px-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                      {(significantSnps.length > 0 ? significantSnps : topSnps.slice(0, 10)).map((s) => (
                        <tr key={s.snp_id}>
                          <td className="py-2.5 px-3 font-bold text-cyan-700 dark:text-[#06B6D4]">{s.snp_id}</td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-sans">Chr {s.chromosome}</td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{Number(s.position).toLocaleString('id-ID')}</td>
                          <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold">
                            {Number(s.p_value) < 0.001 ? Number(s.p_value).toExponential(3) : Number(s.p_value).toFixed(5)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                            {s.effect_size >= 0 ? '+' : ''}{s.effect_size}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-xs">
                            {s.is_significant ? (
                              <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-800 dark:text-emerald-300">
                                Signifikan
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 font-semibold text-slate-600 dark:text-slate-400">
                                Top Kandidat
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-white/10 text-center font-serif italic text-xs text-slate-500 dark:text-slate-400">
                Laporan ini dihasilkan secara otomatis oleh suite bioinformatika GWASena 2.0 untuk keperluan analisis asosiasi genomik
                dan penelitian ilmiah tanaman bernilai ekonomi tinggi.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
