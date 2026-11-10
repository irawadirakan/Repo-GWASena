import { useState, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  Image,
  FileText,
  CheckCircle2,
  ArrowLeft,
  Printer,
  Globe,
  Loader2,
} from 'lucide-react';
import { useAnalysisStore } from '../../store/useAnalysisStore.js';
import { analysisService } from '../../services/analysisService.js';
import ErrorMessageArea from '../common/ErrorMessageArea.jsx';
import ScientificReportModal from './ScientificReportModal.jsx';

/**
 * Step6Export (Langkah 6): Ekspor Data & Laporan Analisis (Figma Aligned)
 * Acuan: 09 — Ekspor & Laporan.png & 09d — Ekspor_ Laporan Tanpa Kandidat Gen.png
 *
 * Mendukung unduhan resmi CSV hasil asosiasi (lengkap & signifikan saja),
 * laporan HTML mandiri, plot PNG resolusi tinggi, serta laporan ilmiah cetak/PDF A4.
 */
export default function Step6Export({ analysisId, analysis, onNavigateStep }) {
  const { results, setResults, configParams, uploadSummary } = useAnalysisStore();

  const [isLoadingData, setIsLoadingData] = useState(false);
  const [annotationData, setAnnotationData] = useState(null);
  const [downloadingCsvMode, setDownloadingCsvMode] = useState(null); // 'all' | 'sig' | null
  const [downloadingHtml, setDownloadingHtml] = useState(false);
  const [downloadingPlot, setDownloadingPlot] = useState(null); // 'manhattan' | 'qq' | null
  const [downloadSuccess, setDownloadSuccess] = useState(null);
  const [exportError, setExportError] = useState(null);

  // State Kontrol Laporan Ilmiah (Modal, Auto-Download & Print)
  const [showReportModal, setShowReportModal] = useState(false);
  const [autoPrintReport, setAutoPrintReport] = useState(false);
  const [autoDownloadPdf, setAutoDownloadPdf] = useState(false);

  // Otomatis muat hasil asosiasi dan anotasi jika pengguna melompat langsung ke Langkah 6
  useEffect(() => {
    let isMounted = true;

    async function loadStep6Data() {
      if (!analysisId) return;

      const needsResults = !results || !results.association_results;
      const needsAnnotation = !annotationData;

      if (needsResults || needsAnnotation) {
        setIsLoadingData(true);
        try {
          const promises = [];
          if (needsResults) {
            promises.push(
              analysisService
                .getFullAnalysisResults(analysisId)
                .then((res) => {
                  if (isMounted) setResults(res);
                })
                .catch((e) => {
                  if (isMounted) setExportError(e);
                })
            );
          }
          if (needsAnnotation) {
            promises.push(
              analysisService
                .getAnnotation(analysisId, true)
                .then((ann) => {
                  if (isMounted) setAnnotationData(ann);
                })
                .catch((e) => console.warn('Anotasi opsional tidak tersedia:', e))
            );
          }
          await Promise.all(promises);
        } finally {
          if (isMounted) setIsLoadingData(false);
        }
      }
    }

    loadStep6Data();

    return () => {
      isMounted = false;
    };
  }, [analysisId, results, annotationData, setResults]);

  const activeResults = results || {};

  // 1. Unduh CSV Hasil Asosiasi (Semua atau Signifikan Saja via PR #29)
  async function handleDownloadCsv(hanyaSignifikan = false) {
    setExportError(null);
    const modeKey = hanyaSignifikan ? 'sig' : 'all';
    setDownloadingCsvMode(modeKey);

    try {
      await analysisService.downloadCsv(analysisId, hanyaSignifikan);
      setDownloadSuccess(hanyaSignifikan ? 'csv_sig' : 'csv');
      setTimeout(() => setDownloadSuccess(null), 4000);
    } catch (err) {
      console.error('Gagal mengunduh CSV dari server:', err);
      setExportError(err?.message ? err : { message: 'Gagal mengunduh CSV hasil analisis dari server.' });
    } finally {
      setDownloadingCsvMode(null);
    }
  }

  // 2. Unduh Laporan Web HTML Mandiri (/api/analyses/{id}/report?unduh=true)
  async function handleDownloadHtmlReport() {
    setExportError(null);
    setDownloadingHtml(true);
    try {
      await analysisService.downloadHtmlReport(analysisId, true);
      setDownloadSuccess('html');
      setTimeout(() => setDownloadSuccess(null), 4000);
    } catch (err) {
      console.error('Gagal mengunduh laporan HTML:', err);
      setExportError(err?.message ? err : { message: 'Gagal mengunduh laporan web HTML dari server.' });
    } finally {
      setDownloadingHtml(false);
    }
  }

  // 3. Unduh Gambar Plot PNG Resolusi Tinggi (Endpoint resmi: GET /api/analyses/{id}/plots/{jenis}/png)
  async function handleDownloadPlot(plotType) {
    setExportError(null);
    setDownloadingPlot(plotType);
    try {
      await analysisService.downloadPlotPng(analysisId, plotType);
      setDownloadSuccess(plotType);
      setTimeout(() => setDownloadSuccess(null), 4000);
    } catch (err) {
      console.error(`Gagal mengunduh gambar PNG ${plotType}:`, err);
      setExportError(err?.message ? err : { message: `Gagal mengunduh gambar PNG ${plotType} dari server.` });
    } finally {
      setDownloadingPlot(null);
    }
  }

  // 3. Tangani Aksi Buka Pratinjau, Unduh PDF, atau Cetak Langsung
  function handleOpenReport(action = 'preview') {
    if (action === 'download') {
      setAutoDownloadPdf(true);
      setAutoPrintReport(false);
    } else if (action === 'print') {
      setAutoPrintReport(true);
      setAutoDownloadPdf(false);
    } else {
      setAutoDownloadPdf(false);
      setAutoPrintReport(false);
    }
    setShowReportModal(true);
  }

  if (isLoadingData && (!results || !results.association_results)) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center p-8 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#06B6D4]" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Memuat ringkasan ekspor dan laporan ilmiah sesi #{analysisId}...
        </p>
      </div>
    );
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

      <ErrorMessageArea error={exportError} onDismiss={() => setExportError(null)} />

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
              Ekspor seluruh data statistik asosiasi genomik dalam format CSV, termasuk informasi SNP, posisi genomik, nilai signifikansi, dan estimasi efek genetik.
            </p>
          </div>

          <div className="space-y-2 mt-4">
            <button
              type="button"
              onClick={() => handleDownloadCsv(false)}
              disabled={downloadingCsvMode !== null}
              className="w-full figma-btn-primary disabled:opacity-50"
            >
              {downloadSuccess === 'csv' ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>CSV Lengkap Terunduh!</span>
                </>
              ) : downloadingCsvMode === 'all' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Mengunduh Semua SNP...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Unduh Semua Hasil (CSV)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleDownloadCsv(true)}
              disabled={downloadingCsvMode !== null}
              className="w-full figma-btn-secondary disabled:opacity-50"
            >
              {downloadSuccess === 'csv_sig' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>CSV Signifikan Terunduh!</span>
                </>
              ) : downloadingCsvMode === 'sig' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#06B6D4]" />
                  <span>Mengunduh SNP Signifikan...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Unduh SNP Signifikan Saja (CSV)</span>
                </>
              )}
            </button>
          </div>
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

        {/* Kartu 3: Laporan Riset Ilmiah (PDF / Web Report) — FR-09 & AC-09.2 */}
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
                Format Laporan Eksekutif (A4 PDF)
              </span>
            </div>
            <p className="text-xs sm:text-sm font-serif leading-relaxed text-slate-800 dark:text-slate-200">
              Hasilkan laporan komprehensif yang mencakup evaluasi kualitas data (QC), estimasi inflasi genomik (&lambda; GC), visualisasi hasil analisis beresolusi tinggi, daftar SNP signifikan, serta anotasi gen berdasarkan referensi GFF3.
            </p>
          </div>

          <div className="space-y-2 mt-4 font-sans">
            {/* Tombol Utama: Unduh Laporan PDF Resmi (jsPDF + html2canvas) */}
            <button
              type="button"
              onClick={() => handleOpenReport('download')}
              className="w-full figma-btn-primary flex items-center justify-center gap-2"
              title="Unduh laporan ilmiah resmi berformat PDF resolusi tinggi"
            >
              <Download className="h-4 w-4" />
              <span>Unduh Laporan PDF (Resmi)</span>
            </button>

            {/* Tombol Sekunder: Unduh Laporan Web HTML Mandiri */}
            <button
              type="button"
              onClick={handleDownloadHtmlReport}
              disabled={downloadingHtml}
              className="w-full figma-btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
              title="Unduh laporan analisis interaktif format HTML mandiri dari server"
            >
              {downloadSuccess === 'html' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Laporan HTML Terunduh!</span>
                </>
              ) : downloadingHtml ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#06B6D4]" />
                  <span>Menyiapkan HTML...</span>
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 text-[#0284C7] dark:text-[#06B6D4]" />
                  <span>Unduh Laporan Web (HTML)</span>
                </>
              )}
            </button>

            {/* Tombol Pratinjau Layar Penuh di Layar (Full Screen Modal) */}
            <button
              type="button"
              onClick={() => handleOpenReport('preview')}
              className="w-full figma-btn-secondary flex items-center justify-center gap-2"
              title="Buka pratinjau dokumen ilmiah interaktif layar penuh"
            >
              <FileText className="h-4 w-4 text-indigo-500" />
              <span>Pratinjau Layar Penuh</span>
            </button>

            {/* Tombol Opsi Alternatif: Cetak via Driver Browser */}
            <button
              type="button"
              onClick={() => handleOpenReport('print')}
              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-sans font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Buka dialog cetak printer fisik atau save as PDF bawaan peramban"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span>Opsi: Dialog Cetak Browser</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Komponen Modal Pratinjau & Cetak Laporan Ilmiah Formal (A4 PDF via Portal) ── */}
      <ScientificReportModal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setAutoPrintReport(false);
          setAutoDownloadPdf(false);
        }}
        analysisId={analysisId}
        analysis={analysis}
        results={activeResults}
        annotationData={annotationData}
        configParams={configParams}
        uploadSummary={uploadSummary}
        autoPrintOnOpen={autoPrintReport}
        autoDownloadOnOpen={autoDownloadPdf}
      />
    </div>
  );
}
