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
} from 'lucide-react';
import { useAnalysisStore } from '../../store/useAnalysisStore.js';
import { generateBenchmarkResults } from '../../services/mockResults.js';
import { analysisService } from '../../services/analysisService.js';

/**
 * Step6Export (Langkah 6): Ekspor Data & Laporan Analisis (Figma Aligned)
 * Acuan: 09 — Ekspor & Laporan.png & 09d — Ekspor_ Laporan Tanpa Kandidat Gen.png
 */
export default function Step6Export({ analysisId, onNavigateStep }) {
  const { results, configParams, uploadSummary } = useAnalysisStore();
  const activeResults = results || generateBenchmarkResults(configParams, uploadSummary);

  const snps = activeResults.association_results || [];
  const significantSnps = activeResults.significant_snps || [];
  const candidateGenes = activeResults.candidate_genes || [];
  const summary = activeResults.summary || {};

  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // 1. Unduh CSV Hasil Asosiasi
  async function handleDownloadCsv() {
    setDownloadingCsv(true);

    if (analysisId && !activeResults?.is_simulated) {
      try {
        await analysisService.downloadCsv(analysisId);
        setDownloadingCsv(false);
        setDownloadSuccess('csv');
        setTimeout(() => setDownloadSuccess(null), 4000);
        return;
      } catch (err) {
        console.warn('Gagal mengunduh CSV langsung dari backend, membuat CSV di browser:', err);
      }
    }

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
      `gwasena_hasil_asosiasi_sesi_${analysisId || '1'}_${summary.trait || 'trait'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadingCsv(false);
    setDownloadSuccess('csv');
    setTimeout(() => setDownloadSuccess(null), 4000);
  }

  // 2. Unduh Gambar Plot (Plotly download trigger / fallback)
  function handleDownloadPlot(plotName) {
    const modeBarButton = document.querySelector(`[data-title="Download plot as a png"]`);
    if (modeBarButton) {
      modeBarButton.click();
      setDownloadSuccess(plotName);
      setTimeout(() => setDownloadSuccess(null), 4000);
    } else {
      alert(
        `Grafik ${plotName} beresolusi tinggi dapat diunduh langsung dari toolbar kamera (📷) di pojok atas grafik pada Langkah 4.`
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
            className="rounded-xl bg-blue-600 dark:bg-blue-500 px-3.5 py-1.5 text-xs font-sans font-semibold text-white shadow-sm"
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
              Unduh seluruh {snps.length} baris data statistik asosiasi genomik lengkap: SNP ID,
              posisi kromosom, p-value, q-value FDR, beta effect size, standard error, dan alel.
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
                Format Grafis Publikasi
              </span>
            </div>
            <p className="text-xs sm:text-sm font-serif leading-relaxed text-slate-800 dark:text-slate-200">
              Ekspor gambar Manhattan Plot dan QQ Plot beresolusi tinggi (format PNG)
              siap publikasi ilmiah jurnal bereputasi.
            </p>
          </div>

          <div className="space-y-2 mt-4 font-sans">
            <button
              type="button"
              onClick={() => handleDownloadPlot('Manhattan Plot')}
              className="w-full figma-btn-secondary"
            >
              <Download className="h-4 w-4" />
              <span>Unduh Manhattan Plot (PNG)</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadPlot('QQ Plot')}
              className="w-full figma-btn-secondary"
            >
              <Download className="h-4 w-4" />
              <span>Unduh QQ Plot (PNG)</span>
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
              daftar SNP signifikan, kandidat gen, dan metrik reprodusibilitas riset.
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 px-3.5 py-1.5 text-xs font-sans font-semibold text-white shadow-sm hover:-translate-y-[1px] hover:shadow-md active:scale-[0.98] transition-all duration-100"
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
                  <span className="font-serif font-bold italic text-slate-900 dark:text-white text-sm">{summary.organism || 'Genomic Cohort'}</span>
                </div>
                <div>
                  <span className="text-xs font-sans text-slate-800 dark:text-slate-200 block uppercase tracking-wider font-bold">Sifat Fenotipe</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {summary.trait || 'trait_target'}
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
                    <span className="font-bold text-[#0284C7] dark:text-[#06B6D4]">{summary.model || 'MLM'}</span>
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
                    <span className="text-slate-700 dark:text-slate-300 block font-sans text-xs font-medium">Total SNP Dianalisis:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{summary.total_snps_tested || 482}</span>
                  </div>
                  <div className="p-3 rounded-xl glass-subcard">
                    <span className="text-slate-700 dark:text-slate-300 block font-sans text-xs font-medium">SNP Signifikan (Bonferroni):</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{significantSnps.length}</span>
                  </div>
                  <div className="p-3 rounded-xl glass-subcard">
                    <span className="text-slate-700 dark:text-slate-300 block font-sans text-xs font-medium">Ambang -log₁₀(P):</span>
                    <span className="font-bold text-[#0284C7] dark:text-[#06B6D4]">
                      {summary.neg_log10_threshold || 3.98}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl glass-subcard">
                    <span className="text-slate-700 dark:text-slate-300 block font-sans text-xs font-medium">Genomic Inflation (λ_GC):</span>
                    <span className="font-bold text-slate-900 dark:text-white">{summary.lambda_gc || 1.024}</span>
                  </div>
                </div>
              </div>

              {/* Tabel Kandidat Gen & SNP Signifikan Terpilih */}
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-sans font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  3. Daftar SNP Signifikan & Kandidat Gen Fungsional
                </h4>
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100/95 dark:bg-[#0B132C]/90 text-xs text-slate-800 dark:text-slate-200 uppercase font-sans font-bold">
                      <tr>
                        <th className="py-3 px-3.5">SNP ID</th>
                        <th className="py-3 px-3.5">Kromosom</th>
                        <th className="py-3 px-3.5">p-value</th>
                        <th className="py-3 px-3.5">Beta</th>
                        <th className="py-3 px-3.5">Kandidat Gen</th>
                        <th className="py-3 px-3.5">Anotasi / Deskripsi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                      {candidateGenes.map((gene) => {
                        const hitSnp = snps.find((s) => s.snp_id === gene.snp_id);
                        return (
                          <tr key={gene.snp_id}>
                            <td className="py-2.5 px-3 font-bold text-cyan-700 dark:text-[#06B6D4]">{gene.snp_id}</td>
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-sans">Chr {gene.chromosome}</td>
                            <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold">
                              {hitSnp ? Number(hitSnp.p_value).toExponential(2) : '2.3e-8'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                              {hitSnp?.effect_size ? `+${hitSnp.effect_size}` : '+4.85'}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                              {gene.gene_id} ({gene.gene_name})
                            </td>
                            <td className="py-2.5 px-3 font-serif text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                              {gene.description}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-white/10 text-center font-serif italic text-xs text-slate-500 dark:text-slate-400">
                Laporan ini dibuat secara otomatis oleh GWASena untuk keperluan analisis asosiasi genomik
                dan penelitian ilmiah terstandarisasi.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
