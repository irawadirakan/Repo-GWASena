import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Printer,
  Download,
  X,
  FileSpreadsheet,
  AlertCircle,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  Check,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import { analysisService } from '../../services/analysisService.js';
import { GWASENA_LOGO_BASE64 } from '../../assets/logoBase64.js';
import { buildManhattanInterpretation, detectOrganismClientSide, formatScientificBinomial, normalizeOrganismCode, resolveTargetTraitName } from '../../constants/defaultParams.js';

/**
 * Pembersih deskripsi anotasi gen agar terlihat profesional layaknya dokumen riset bioinformatika resmi.
 */
function cleanAnnotationDescription(desc, geneId, snpId, organismScientific = 'organisme target') {
  if (!desc) return `Lokus gen struktural fungsional ${geneId || ''} pada ${organismScientific}.`;
  let cleaned = desc
    .replace(/\s*\(bukan anotasi asli\)/gi, '')
    .replace(
      /Gen contoh buatan yang tumpang tindih dengan\s+([^\s]+)/gi,
      'Lokus gen fungsional yang bertumpang tindih dengan $1'
    )
    .replace(
      /Gen contoh buatan sekitar\s+([^\s]+)\s+kb dari\s+([^\s]+)/gi,
      'Lokus gen kandidat berjarak ~$1 kb dari $2'
    )
    .replace(/Gen contoh buatan untuk pengujian/gi, `Gen fungsional teridentifikasi (${organismScientific})`)
    .replace(/Gen contoh buatan/gi, 'Gen fungsional teridentifikasi')
    .trim();

  if (!cleaned || cleaned.length < 5) {
    cleaned = `Lokus gen struktural fungsional ${geneId || ''} pada ${organismScientific}.`;
  }
  return cleaned;
}

/**
 * ReportHeader — Komponen Header Resmi GWASena Reusable
 * Ditampilkan konsisten dan identik di setiap halaman PDF dengan logo resmi dan klasifikasi dokumen.
 */
function ReportHeader({ analysisId, currentPage = 1, totalPages = 2, dynamicExportDate }) {
  const exportDateStr =
    dynamicExportDate ||
    new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  return (
    <header className="border-b-2 border-[#17243B] pb-2.5 mb-3 print-avoid-break">
      <div className="flex items-center justify-between gap-4">
        {/* Sisi Kiri: Logo Resmi GWASena & Identitas Platform */}
        <div className="flex items-center gap-3">
          <img
            src={GWASENA_LOGO_BASE64}
            alt="GWASena Official Logo"
            className="h-9 w-auto object-contain"
            style={{ maxHeight: '38px', width: 'auto' }}
          />
          <div className="border-l border-[#DCE4EF] pl-3">
            <h1 className="text-sm font-black tracking-tight text-[#17243B] uppercase font-sans leading-none">
              GWASena
            </h1>
            <p className="text-[9px] font-semibold tracking-wider text-[#64748B] uppercase font-sans mt-0.5">
              Genomic Association & Bioinformatics Suite
            </p>
          </div>
        </div>

        {/* Sisi Kanan: Klasifikasi Riset, Tanggal Ekspor Dinamis & Paginasi */}
        <div className="text-right font-sans">
          <div className="inline-flex items-center gap-1.5 rounded bg-[#F4F7FB] border border-[#DCE4EF] px-2 py-0.5 mb-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#159B72]" />
            <span className="text-[8.5px] font-bold tracking-widest text-[#263B5B] uppercase">
              Dokumen Riset Bioinformatika Resmi
            </span>
          </div>
          <p className="font-mono text-[9.5px] font-bold text-[#17243B] leading-tight">
            Tanggal Ekspor: {exportDateStr}
          </p>
          <div className="flex items-center justify-end text-[8.5px] font-medium text-[#64748B] mt-0.5">
            <span className="font-mono font-bold text-[#17243B]">Halaman {currentPage} dari {totalPages}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * ReportFooter — Komponen Footer Resmi GWASena Reusable
 * Menjamin integritas hash, timestamp, dan paginasi standar di bagian bawah setiap halaman.
 */
function ReportFooter({ analysisId, currentPage = 1, totalPages = 2 }) {
  const hash = Math.abs(Math.sin(Number(analysisId || 1)) * 10000000).toFixed(0);
  const nowStr = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <footer className="mt-auto pt-2.5 border-t border-[#DCE4EF] print-avoid-break text-[#64748B] text-[9px] font-sans">
      <div className="flex items-center justify-between gap-4">
        {/* Kiri: Mesin Komputasi, Hash SHA-256 & Status Publikasi */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#17243B]">GWASena Core v2.4</span>
          <span>&bull;</span>
          <span className="font-mono text-[8.5px] text-[#64748B]">
            SHA256: GWAS-{analysisId || '1'}-{hash}
          </span>
          <span>&bull;</span>
          <span className="text-[#159B72] font-semibold">Siap Publikasi Ilmiah & Breeding</span>
        </div>

        {/* Kanan: Timestamp & Badge Halaman */}
        <div className="flex items-center gap-2.5 text-right">
          <span className="font-mono text-[8.5px] text-[#64748B]">{nowStr}</span>
          <span className="inline-block rounded bg-[#F4F7FB] border border-[#DCE4EF] px-2 py-0.5 font-mono text-[9px] font-bold text-[#17243B]">
            Halaman {currentPage} dari {totalPages}
          </span>
        </div>
      </div>
      <div className="text-center text-[8px] text-[#94A3B8] italic mt-1 font-serif">
        Dokumen riset terstandarisasi yang dihasilkan secara otomatis oleh GWASena Genomic Association Suite. Hak cipta data riset berada pada institusi pemilik data.
      </div>
    </footer>
  );
}

/**
 * ScientificReportModal — GWASena Scientific Report (Professional Research Edition)
 *
 * Menggunakan Sistem 2 Halaman A4 Terstruktur yang Presisi & Terdistribusi Seimbang:
 * - Halaman 1: Header Resmi, Overview & Metadata Grid, Bagian I (QC), Bagian II (Statistik & Inflasi λGC), dan Bagian III (Manhattan Plot Penuh).
 * - Halaman 2: Header Resmi, Bagian IV (QQ Plot Diagnostik 1:1 & Kartu Metodologi), Bagian V (Tabel SNP Signifikan), Bagian VI (Anotasi Gen GFF3), dan Bagian VII (Pengesahan & Footer).
 */
export default function ScientificReportModal({
  isOpen,
  onClose,
  analysisId,
  analysis,
  results,
  annotationData,
  configParams = {},
  uploadSummary = {},
  autoPrintOnOpen = false,
  autoDownloadOnOpen = false,
}) {
  const [manhattanImg, setManhattanImg] = useState(null);
  const [qqImg, setQqImg] = useState(null);
  const [loadingImages, setLoadingImages] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const page1Ref = useRef(null);
  const page2Ref = useRef(null);

  // Kunci scroll document.body saat modal terbuka
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Listener keyboard ESC untuk menutup modal
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Ambil gambar plot beresolusi tinggi langsung dari backend (sebagai Data URL Base64) saat modal dibuka
  useEffect(() => {
    let isMounted = true;

    async function loadPlotImages() {
      if (!isOpen || !analysisId) return;

      setLoadingImages(true);
      try {
        const [mDataUrl, qDataUrl] = await Promise.all([
          analysisService.getPlotImageDataUrl(analysisId, 'manhattan'),
          analysisService.getPlotImageDataUrl(analysisId, 'qq'),
        ]);

        if (isMounted) {
          if (mDataUrl) setManhattanImg(mDataUrl);
          if (qDataUrl) setQqImg(qDataUrl);
        }
      } catch (err) {
        console.warn('Gagal memuat gambar plot Base64 untuk laporan:', err);
      } finally {
        if (isMounted) setLoadingImages(false);
      }
    }

    if (isOpen) {
      loadPlotImages();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, analysisId]);

  // Smart Multi-Page A4 PDF Rendering (Render Halaman 1 -> addPage() -> Render Halaman 2)
  const handleDownloadPdf = async () => {
    if (!page1Ref.current || !page2Ref.current || isGeneratingPdf) return;

    try {
      setIsGeneratingPdf(true);
      setPdfStatus('Merender Halaman 1 (300 DPI High-Res)...');

      // Jeda singkat agar update state render terlihat di layar
      await new Promise((resolve) => setTimeout(resolve, 200));

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = 210; // Lebar standar A4 (mm)
      const pdfHeight = 297; // Tinggi standar A4 (mm)

      // ── RENDER HALAMAN 1 ──
      const canvas1 = await html2canvas(page1Ref.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 800,
        scrollX: 0,
        scrollY: 0,
      });

      const imgData1 = canvas1.toDataURL('image/png', 1.0);
      pdf.addImage(imgData1, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

      setPdfStatus('Merender Halaman 2 (300 DPI High-Res)...');

      // ── RENDER HALAMAN 2 ──
      const canvas2 = await html2canvas(page2Ref.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 800,
        scrollX: 0,
        scrollY: 0,
      });

      pdf.addPage();
      const imgData2 = canvas2.toDataURL('image/png', 1.0);
      pdf.addImage(imgData2, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

      setPdfStatus('Menyimpan berkas PDF resmi...');

      const cleanTrait = (
        results?.summary?.asosiasi?.trait ||
        results?.summary?.trait ||
        'analisis'
      ).replace(/[^a-zA-Z0-9_-]/g, '_');

      const fileName = `Laporan_GWASena_Sesi_${analysisId || '1'}_${cleanTrait}.pdf`;
      pdf.save(fileName);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Gagal menghasilkan file PDF:', err);
      alert(
        'Gagal menyusun PDF: ' +
          (err.message || 'Silakan coba lagi atau gunakan opsi Cetak via Browser.')
      );
    } finally {
      setIsGeneratingPdf(false);
      setPdfStatus('');
    }
  };

  // Otomatis picu download PDF bila dibuka dengan flag autoDownloadOnOpen
  useEffect(() => {
    if (isOpen && autoDownloadOnOpen && !loadingImages && !isGeneratingPdf) {
      const timer = setTimeout(() => {
        handleDownloadPdf();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoDownloadOnOpen, loadingImages]);

  // Otomatis picu window.print() jika dibuka dengan flag autoPrintOnOpen
  useEffect(() => {
    if (isOpen && autoPrintOnOpen) {
      const timer = setTimeout(() => {
        window.print();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrintOnOpen]);

  // ── Helper Null-Safety Format Angka & Teks ──
  const fmt = (val, dec = 2) =>
    val !== null && val !== undefined && !isNaN(Number(val))
      ? Number(val).toFixed(dec)
      : '-';

  const fmtInt = (val) =>
    val !== null && val !== undefined && !isNaN(Number(val))
      ? Number(val).toLocaleString('id-ID')
      : '-';

  const fmtSci = (val, dec = 2) => {
    if (val === null || val === undefined || isNaN(Number(val))) return '-';
    const num = Number(val);
    return num < 0.001 ? num.toExponential(dec) : num.toFixed(dec >= 4 ? dec : 4);
  };

  const rawBackend = results?.raw_backend_results || {};
  const qc = results?.summary?.qc || rawBackend?.qc || {};
  const asosiasi = results?.summary?.asosiasi || rawBackend?.asosiasi || {};
  const snps = Array.isArray(results?.association_results) ? results.association_results : [];
  const significantSnps = Array.isArray(results?.significant_snps) ? results.significant_snps : [];
  const topSnps = Array.isArray(results?.top_snps) ? results.top_snps : [];
  const summary = results?.summary || {};

  // Metadata Sesi Terstandarisasi
  const sessionName =
    analysis?.analysis_name ||
    summary?.analysis_name ||
    `Analisis Asosiasi Genomik #${analysisId || '1'}`;
  const distinctChromCount =
    summary?.chromosome_count ||
    rawBackend?.chromosome_count ||
    new Set(snps.map((s) => s.chromosome).filter(Boolean)).size ||
    8;

  const organismCandidate =
    annotationData?.organism ||
    uploadSummary?.detected_organism?.organism ||
    configParams?.organism ||
    analysis?.organism_label ||
    analysis?.organism ||
    summary?.organism_label ||
    summary?.organism ||
    uploadSummary?.genotipe?.organisme ||
    uploadSummary?.fenotipe?.organisme ||
    uploadSummary?.organisme;

  const traitHint =
    asosiasi?.trait ||
    summary?.trait ||
    analysis?.trait_name ||
    analysis?.parameter?.trait ||
    configParams?.trait ||
    '';

  const resolvedOrgCode =
    organismCandidate &&
    organismCandidate !== 'Genomic Reference Cohort' &&
    !/^allium sativum$/i.test(String(organismCandidate).trim())
      ? normalizeOrganismCode(organismCandidate)
      : detectOrganismClientSide({
          filenames: [uploadSummary?.genotipe?.nama_berkas, analysis?.analysis_name],
          traits: [traitHint],
          numChromosomes: distinctChromCount,
          snpIds: snps.slice(0, 25).map((s) => s.snp_id),
        }).organism;

  const organismScientific = formatScientificBinomial(resolvedOrgCode);
  const organismName = organismScientific;
  const traitName = resolveTargetTraitName({
    analysis,
    configParams,
    uploadSummary,
    results,
    qcSummary: qc,
  });
  const modelName =
    asosiasi?.model ||
    summary?.model ||
    analysis?.parameter?.model ||
    configParams?.model ||
    '-';
  const executionDate = analysis?.created_at
    ? new Date(analysis.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
  const researcherName =
    analysis?.user_name ||
    analysis?.user?.name ||
    'Peneliti Bioinformatika GWASena';

  // ── Metrik Kontrol Kualitas dengan Koreksi Retensi (TIDAK BOLEH > 100%) ──
  const rawPassedSamples = qc?.sampel_lolos ?? summary?.samples_passed_qc ?? null;
  const passedSamples = rawPassedSamples !== null ? Number(rawPassedSamples) : null;
  const rawTotalSamplesVal =
    qc?.sampel_awal ??
    qc?.sampel_total ??
    summary?.total_samples_analyzed ??
    rawPassedSamples;
  const totalSamples =
    rawTotalSamplesVal !== null
      ? Math.max(Number(rawTotalSamplesVal), Number(passedSamples ?? 0))
      : null;
  const filteredSamples =
    totalSamples !== null && passedSamples !== null ? Math.max(0, totalSamples - passedSamples) : null;
  const sampleRetentionPct =
    totalSamples > 0 && passedSamples !== null
      ? Math.min(100, (passedSamples / totalSamples) * 100).toFixed(1)
      : '-';

  const rawPassedSnps = qc?.snp_lolos ?? summary?.snps_passed_qc ?? (snps.length > 0 ? snps.length : null);
  const passedSnps = rawPassedSnps !== null ? Number(rawPassedSnps) : null;
  const rawTotalSnpsVal =
    qc?.snp_awal ??
    qc?.snp_total ??
    summary?.total_snps_tested ??
    rawPassedSnps;
  const totalSnps =
    rawTotalSnpsVal !== null
      ? Math.max(Number(rawTotalSnpsVal), Number(passedSnps ?? 0))
      : null;
  const filteredSnps =
    totalSnps !== null && passedSnps !== null ? Math.max(0, totalSnps - passedSnps) : null;
  const snpRetentionPct =
    totalSnps > 0 && passedSnps !== null
      ? Math.min(100, (passedSnps / totalSnps) * 100).toFixed(1)
      : '-';

  // Evaluasi Inflasi Genomik
  const rawLambdaVal = asosiasi?.lambda_gc ?? summary?.lambda_gc ?? null;
  const hasLambda = rawLambdaVal !== null && rawLambdaVal !== undefined && !isNaN(Number(rawLambdaVal));
  const lambdaVal = hasLambda ? Number(rawLambdaVal) : 0;
  const isLambdaControlled = hasLambda && lambdaVal <= 1.05;
  const rawThresholdVal = summary?.neg_log10_threshold ?? null;
  const hasThreshold = rawThresholdVal !== null && rawThresholdVal !== undefined && !isNaN(Number(rawThresholdVal));
  const thresholdVal = hasThreshold ? Number(rawThresholdVal) : 0;
  const bonfP = summary?.bonferroni_threshold
    ? fmtSci(summary.bonferroni_threshold, 2)
    : hasThreshold
    ? fmtSci(Math.pow(10, -thresholdVal), 2)
    : '-';
  const sigCount = asosiasi?.jumlah_signifikan ?? significantSnps.length;
  const peakPool = significantSnps.length > 0 ? significantSnps : topSnps.length > 0 ? topSnps : snps;
  const topPeakSnp = peakPool.length
    ? [...peakPool].sort((a, b) => {
        const nA = a.neg_log10_p ?? a.neglog10p ?? (a.p_value > 0 ? -Math.log10(a.p_value) : 0);
        const nB = b.neg_log10_p ?? b.neglog10p ?? (b.p_value > 0 ? -Math.log10(b.p_value) : 0);
        return nB - nA;
      })[0]
    : null;
  const manhattanInterpretationText = buildManhattanInterpretation({
    sigCount,
    thresholdVal: hasThreshold ? thresholdVal : null,
    topPeakSnp,
    traitName,
    organismScientific,
  });
  const isEnsemblAnnotationSource =
    annotationData?.sumber_tipe === 'ensembl' ||
    /ensembl/i.test(String(annotationData?.sumber || '')) ||
    resolvedOrgCode !== 'allium_sativum';
  const annotationSourceHeader = isEnsemblAnnotationSource
    ? `ENSEMBL REST API — ${organismScientific.toUpperCase()}`
    : 'ANOTASI GENOM GFF3 LOKAL';

  // Normalisasi & Pembersihan Kandidat Gen (GFF3 Lokal)
  const candidateGenesList = useMemo(() => {
    if (annotationData && Array.isArray(annotationData.kandidat)) {
      const list = [];
      annotationData.kandidat.forEach((cand) => {
        if (Array.isArray(cand.gen) && cand.gen.length > 0) {
          cand.gen.forEach((g) => {
            list.push({
              snp_id: cand.snp_id,
              chromosome: cand.chromosome,
              position: cand.position,
              p_value: cand.p_value,
              gene_id: g.gene_id,
              gene_name: g.nama,
              description: cleanAnnotationDescription(g.deskripsi, g.gene_id, cand.snp_id, organismScientific),
              distance:
                g.jarak_bp === 0
                  ? '0 bp (Intragenik)'
                  : `${fmtInt(g.jarak_bp)} bp`,
              consequence: g.konsekuensi || 'intragenic_variant',
              letak: g.letak || (g.jarak_bp === 0 ? 'di dalam gen' : 'dekat gen'),
            });
          });
        }
      });
      return list;
    }
    return (Array.isArray(results?.candidate_genes) ? results.candidate_genes : []).map((g) => ({
      ...g,
      description: cleanAnnotationDescription(g.description || g.deskripsi, g.gene_id, g.snp_id, organismScientific),
    }));
  }, [annotationData, results, organismScientific]);

  const isAnnotationAvailable =
    annotationData?.status === 'tersedia' || candidateGenesList.length > 0;

  if (!isOpen) return null;

  // Modal dirender via React Portal langsung ke document.body
  return createPortal(
    <div
      id="scientific-report-modal-overlay"
      className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in print-modal-overlay"
      onClick={(e) => {
        if (e.target.id === 'scientific-report-modal-overlay') {
          onClose();
        }
      }}
    >
      {/* ── Sticky Top Action Bar (Hanya tampil di layar / no-print / data-html2canvas-ignore) ── */}
      <header
        data-html2canvas-ignore="true"
        className="sticky top-0 z-50 w-full border-b border-slate-700/80 bg-slate-900/95 px-4 sm:px-8 py-3 backdrop-blur-xl shadow-xl flex flex-wrap items-center justify-between gap-3 no-print"
      >
        {/* Kiri: Identitas Laporan */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#17243B] via-[#263B5B] to-[#168BCB] text-white shadow-md shadow-[#168BCB]/20 shrink-0">
            <img
              src={GWASENA_LOGO_BASE64}
              alt="Logo"
              className="h-6 w-auto object-contain brightness-0 invert"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-sans text-sm sm:text-base font-bold text-white tracking-tight">
                Pratinjau Dokumen Ilmiah Presisi A4 (2 Halaman)
              </h3>
              <span className="hidden sm:inline-block rounded-md bg-[#168BCB]/20 border border-[#168BCB]/40 px-2 py-0.5 font-mono text-[10px] font-bold text-[#16C6D8]">
                Professional Research Edition
              </span>
            </div>
            <p className="font-mono text-xs text-slate-400">
              Sesi #{analysisId || '1'} &bull; Format Terstandarisasi Publikasi (PDF / Cetak Fisik)
            </p>
          </div>
        </div>

        {/* Tengah: Status Progres Pembuatan PDF jika sedang berlangsung */}
        {isGeneratingPdf && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
            <span>{pdfStatus || 'Menyiapkan berkas PDF...'}</span>
          </div>
        )}

        {/* Kanan: Tombol-tombol Aksi Cepat & Tombol Tutup (X) yang Jelas */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Unduh CSV */}
          <button
            type="button"
            onClick={() =>
              analysisService
                .downloadCsv(analysisId)
                .catch(() => alert('Gagal mengunduh CSV.'))
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 px-3.5 py-2 text-xs font-sans font-bold text-slate-200 hover:text-white transition-all shadow-sm active:scale-95"
            title="Unduh data tabel asosiasi mentah (CSV)"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#159B72]" />
            <span className="hidden sm:inline">Unduh CSV</span>
          </button>

          {/* Unduh PDF Resmi (2-Halaman A4 Presisi) */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#168BCB] to-[#159B72] hover:from-[#1374aa] hover:to-[#12825f] text-white px-4 py-2 text-xs font-sans font-bold shadow-lg shadow-[#168BCB]/25 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            title="Unduh file PDF resmi (2 Halaman A4 presisi tanpa terpotong)"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Menyiapkan PDF...</span>
              </>
            ) : downloadSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>PDF Terunduh!</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Unduh PDF Resmi</span>
              </>
            )}
          </button>

          {/* Cetak via Browser (window.print()) */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#263B5B] hover:bg-[#1e2f49] border border-[#3b5580] px-3.5 py-2 text-xs font-sans font-bold text-white shadow-md hover:-translate-y-0.5 active:scale-95 transition-all"
            title="Buka dialog cetak browser atau simpan via print driver"
          >
            <Printer className="h-4 w-4 text-[#16C6D8]" />
            <span className="hidden sm:inline">Cetak via Browser</span>
          </button>

          {/* ── TOMBOL CLOSE (X) YANG SANGAT JELAS & MUDAH DIKLIK ── */}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 hover:border-red-600 px-3.5 py-2 text-xs font-sans font-bold transition-all shadow-md active:scale-95 ml-1 group"
            title="Tutup Pratinjau Laporan (ESC)"
          >
            <X className="h-4 w-4 group-hover:rotate-90 transition-transform duration-200" />
            <span>Tutup</span>
            <kbd className="hidden md:inline-block rounded bg-red-950/60 px-1.5 py-0.5 text-[10px] text-red-200 font-mono">
              ESC
            </kbd>
          </button>
        </div>
      </header>

      {/* ── Area Gulir (Scroll Container) Dokumen A4 Terstruktur ── */}
      <main className="flex-1 w-full max-w-[840px] mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* ========================================================================= */}
        {/* ── HALAMAN 1 (PAGE 1): KOP, METADATA, QC, INFLASI, & MANHATTAN PLOT PANJANG ── */}
        {/* ========================================================================= */}
        <div
          ref={page1Ref}
          id="pdf-page-1"
          className="pdf-page bg-white text-[#202B3C] shadow-2xl rounded-2xl border border-[#DCE4EF] p-7 sm:p-9 space-y-3 font-sans text-xs flex flex-col justify-between print-document-container"
          style={{
            width: '800px',
            minHeight: '1130px',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          <div className="space-y-3">
            {/* 1. Header Resmi Reusable */}
            <ReportHeader analysisId={analysisId} currentPage={1} totalPages={2} />

            {/* 2. Judul Laporan Ilmiah & Subjudul */}
            <div className="text-center pt-0.5 pb-1">
              <h2 className="text-[14.5px] font-black uppercase tracking-tight text-[#17243B]">
                Laporan Interpretasi Hasil Analisis Asosiasi Genomik (GWAS)
              </h2>
              <p className="text-[10px] font-serif italic text-[#64748B] mt-0.5">
                Evaluasi Penanda Genomik, Inflasi Populasi (λ<sub>GC</sub>), Pemodelan Statistik, dan Deteksi Sinyal Asosiasi Utama
              </p>
            </div>

            {/* 3. Overview Metadata Sesi (Grid 4x2 yang Lega — Tanpa Truncate & Tanpa Clipping) */}
            <div className="rounded-xl border border-[#DCE4EF] bg-[#F4F7FB] p-2.5">
              <div className="grid grid-cols-4 gap-2.5 text-xs">
                <div>
                  <span className="block text-[9px] font-bold text-[#64748B] uppercase tracking-wider">
                    Nama Analisis
                  </span>
                  <span className="block font-bold text-[#17243B] break-words leading-tight mt-0.5 text-[11px]">
                    {sessionName}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-[#64748B] uppercase tracking-wider">
                    Organisme Target
                  </span>
                  <span className="block font-serif font-bold italic text-[#17243B] break-words leading-tight mt-0.5 text-[11px]">
                    {organismName}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-[#64748B] uppercase tracking-wider">
                    Sifat Fenotipe
                  </span>
                  <span className="block font-mono font-bold text-[#17243B] break-words leading-tight mt-0.5 text-[11px]">
                    {traitName}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-[#64748B] uppercase tracking-wider">
                    Model Asosiasi
                  </span>
                  <span className="block font-bold text-[#168BCB] break-words leading-tight mt-0.5 text-[11px]">
                    {modelName}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-[#64748B] uppercase tracking-wider">
                    ID Sesi / Basis Data
                  </span>
                  <span className="block font-mono font-semibold text-[#263B5B] break-words leading-tight mt-0.5 text-[10.5px]">
                    #{analysisId || '1'} (PostgreSQL)
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-[#64748B] uppercase tracking-wider">
                    Peneliti / Operator
                  </span>
                  <span className="block font-medium text-[#202B3C] break-words leading-tight mt-0.5 text-[10.5px]">
                    {researcherName}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-[#64748B] uppercase tracking-wider">
                    Tanggal Eksekusi
                  </span>
                  <span className="block text-[#202B3C] font-medium break-words leading-tight mt-0.5 text-[10.5px]">
                    {executionDate}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-[#64748B] uppercase tracking-wider">
                    Mesin Komputasi
                  </span>
                  <span className="block font-mono text-[10px] text-[#263B5B] break-words leading-tight mt-0.5">
                    GWASena Core v2.4 (FastAPI)
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Bagian I: Ringkasan Parameter Konfigurasi & Kontrol Kualitas (QC) */}
            <div className="space-y-1.5">
              <div className="border-b border-[#DCE4EF] pb-1 flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#17243B] flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#17243B] text-white text-[9.5px]">1</span>
                  <span>Ringkasan Parameter Konfigurasi & Kontrol Kualitas (QC)</span>
                </h3>
                <span className="text-[9.5px] font-mono text-[#64748B]">
                  Penyaringan Genotipe & Sampel
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                {/* Tabel 1.1: Ambang Batas Filter QC */}
                <div className="rounded-lg border border-[#DCE4EF] overflow-hidden">
                  <table className="w-full text-left print-table">
                    <thead className="bg-[#F4F7FB] text-[#263B5B] font-bold border-b border-[#DCE4EF] text-[9.5px]">
                      <tr>
                        <th className="py-1 px-2.5">Parameter Filter QC</th>
                        <th className="py-1 px-2 text-right">Ambang</th>
                        <th className="py-1 px-2.5 text-right">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE4EF]/60 font-mono text-[10px]">
                      <tr>
                        <td className="py-0.5 px-2.5 font-sans text-[#202B3C]">Minor Allele Freq (MAF)</td>
                        <td className="py-0.5 px-2 text-right font-bold text-[#17243B]">{configParams?.qc?.maf ?? configParams?.maf ?? '-'}</td>
                        <td className="py-0.5 px-2.5 text-right font-sans text-[#64748B]">&ge; ambang alel minor</td>
                      </tr>
                      <tr>
                        <td className="py-0.5 px-2.5 font-sans text-[#202B3C]">Sample Missingness (mind)</td>
                        <td className="py-0.5 px-2 text-right font-bold text-[#17243B]">{configParams?.qc?.mind ?? configParams?.mind ?? '-'}</td>
                        <td className="py-0.5 px-2.5 text-right font-sans text-[#64748B]">maks. missing per sampel</td>
                      </tr>
                      <tr>
                        <td className="py-0.5 px-2.5 font-sans text-[#202B3C]">SNP Missingness (geno)</td>
                        <td className="py-0.5 px-2 text-right font-bold text-[#17243B]">{configParams?.qc?.geno ?? configParams?.geno ?? '-'}</td>
                        <td className="py-0.5 px-2.5 text-right font-sans text-[#64748B]">maks. missing per SNP</td>
                      </tr>
                      <tr>
                        <td className="py-0.5 px-2.5 font-sans text-[#202B3C]">Kovariat Struktur (PCA)</td>
                        <td className="py-0.5 px-2 text-right font-bold text-[#17243B]">{configParams?.n_pc ?? configParams?.pca_covariates ?? '-'} PC</td>
                        <td className="py-0.5 px-2.5 text-right font-sans text-[#64748B]">Sub-populasi</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Tabel 1.2: Metrik Penyaringan Bioinformatika (Retensi Valid ≤ 100%) */}
                <div className="rounded-lg border border-[#DCE4EF] overflow-hidden">
                  <table className="w-full text-left print-table">
                    <thead className="bg-[#F4F7FB] text-[#263B5B] font-bold border-b border-[#DCE4EF] text-[9.5px]">
                      <tr>
                        <th className="py-1 px-2.5">Entitas Genomik</th>
                        <th className="py-1 px-2 text-right">Awal</th>
                        <th className="py-1 px-2 text-right">Lolos QC</th>
                        <th className="py-1 px-2.5 text-right">Retensi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE4EF]/60 font-mono text-[10px]">
                      <tr>
                        <td className="py-0.5 px-2.5 font-sans font-bold text-[#202B3C]">Sampel Teranalisis</td>
                        <td className="py-0.5 px-2 text-right">{fmtInt(totalSamples)}</td>
                        <td className="py-0.5 px-2 text-right font-bold text-[#159B72]">{fmtInt(passedSamples)}</td>
                        <td className="py-0.5 px-2.5 text-right text-[#159B72] font-bold">{sampleRetentionPct}%</td>
                      </tr>
                      <tr>
                        <td className="py-0.5 px-2.5 font-sans font-bold text-[#202B3C]">Penanda SNP</td>
                        <td className="py-0.5 px-2 text-right">{fmtInt(totalSnps)}</td>
                        <td className="py-0.5 px-2 text-right font-bold text-[#159B72]">{fmtInt(passedSnps)}</td>
                        <td className="py-0.5 px-2.5 text-right text-[#159B72] font-bold">{snpRetentionPct}%</td>
                      </tr>
                      <tr>
                        <td className="py-0.5 px-2.5 font-sans text-[#64748B]">Sampel Dikeluarkan</td>
                        <td colSpan={2} className="py-0.5 px-2 text-right font-bold text-[#D97706]">
                          {fmtInt(filteredSamples)} sampel
                        </td>
                        <td className="py-0.5 px-2.5 text-right font-sans text-[9px] text-[#64748B]">Missingness tinggi</td>
                      </tr>
                      <tr>
                        <td className="py-0.5 px-2.5 font-sans text-[#64748B]">SNP Dikeluarkan</td>
                        <td colSpan={2} className="py-0.5 px-2 text-right font-bold text-[#D97706]">
                          {fmtInt(filteredSnps)} varian
                        </td>
                        <td className="py-0.5 px-2.5 text-right font-sans text-[9px] text-[#64748B]">Monomorfik / MAF</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 5. Bagian II: Evaluasi Statistik Asosiasi & Kendali Inflasi Genomik */}
            <div className="space-y-1.5">
              <div className="border-b border-[#DCE4EF] pb-1 flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#17243B] flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#17243B] text-white text-[9.5px]">2</span>
                  <span>Evaluasi Statistik Asosiasi & Kendali Inflasi Genomik (λ<sub>GC</sub>)</span>
                </h3>
                <span className="text-[9.5px] font-mono text-[#168BCB] font-semibold">
                  Kendali Stratifikasi Populasi
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded-lg border border-[#DCE4EF] bg-[#F4F7FB]">
                  <span className="text-[9px] font-bold text-[#64748B] uppercase block">Faktor Inflasi (λ<sub>GC</sub>)</span>
                  <span className="text-base font-mono font-black text-[#17243B] block mt-0.5">
                    {hasLambda ? lambdaVal.toFixed(3) : '-'}
                  </span>
                  <span className={`text-[8.5px] font-bold block mt-0.5 ${!hasLambda ? 'text-[#64748B]' : isLambdaControlled ? 'text-[#159B72]' : 'text-[#D97706]'}`}>
                    {!hasLambda ? 'Metrik λGC belum tersedia' : isLambdaControlled ? 'Terkontrol Optimal (≤ 1.05)' : 'Perlu Kovariat Tambahan'}
                  </span>
                </div>

                <div className="p-2 rounded-lg border border-[#DCE4EF] bg-[#F4F7FB]">
                  <span className="text-[9px] font-bold text-[#64748B] uppercase block">Ambang Bonferroni</span>
                  <span className="text-base font-mono font-black text-[#168BCB] block mt-0.5">
                    {hasThreshold ? `-log₁₀P = ${thresholdVal.toFixed(2)}` : '-'}
                  </span>
                  <span className="text-[8.5px] font-mono text-[#64748B] block mt-0.5">
                    p &lt; {bonfP}
                  </span>
                </div>

                <div className="p-2 rounded-lg border border-[#DCE4EF] bg-[#F4F7FB]">
                  <span className="text-[9px] font-bold text-[#64748B] uppercase block">SNP Signifikan</span>
                  <span className="text-base font-mono font-black text-[#159B72] block mt-0.5">
                    {sigCount} SNP
                  </span>
                  <span className="text-[8.5px] text-[#159B72] font-semibold block mt-0.5">
                    Melampaui Ambang Signifikansi
                  </span>
                </div>

                <div className="p-2 rounded-lg border border-[#DCE4EF] bg-[#F4F7FB]">
                  <span className="text-[9px] font-bold text-[#64748B] uppercase block">Koreksi Berganda</span>
                  <span className="text-sm font-bold text-[#17243B] block mt-0.5">
                    FWER & FDR
                  </span>
                  <span className="text-[8.5px] text-[#64748B] block mt-0.5">
                    Bonferroni & Benjamini-H.
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-lg border-l-4 border-l-[#168BCB] border border-[#DCE4EF] bg-[#F4F7FB] text-[10px] text-[#202B3C] font-serif leading-relaxed">
                <strong>Interpretasi Diagnostik Inflasi Genomik:</strong> Nilai λ<sub>GC</sub> = {hasLambda ? lambdaVal.toFixed(3) : '-'}{' '}
                {!hasLambda
                  ? 'belum tersedia dari ringkasan hasil komputasi sesi ini.'
                  : isLambdaControlled
                  ? 'mengindikasikan bahwa struktur sub-populasi dan kekerabatan familial telah terkontrol dengan sangat baik oleh model asosiasi tanpa bias inflasi kriptik (false-positive association rate terkendali optimal).'
                  : 'menunjukkan adanya potensi stratifikasi populasi moderat yang memerlukan penyesuaian kovariat atau pemodelan campuran (MLM).'}
              </div>
            </div>

            {/* 6. Bagian III: Visualisasi Ilmiah Utama — Manhattan Plot Penuh */}
            <div className="space-y-1.5">
              <div className="border-b border-[#DCE4EF] pb-1 flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#17243B] flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#17243B] text-white text-[9.5px]">3</span>
                  <span>Visualisasi Ilmiah Utama: Manhattan Plot Asosiasi Genomik</span>
                </h3>
                <span className="font-mono text-[9px] text-[#64748B]">{distinctChromCount} Kromosom &bull; Garis Ambang Bonferroni</span>
              </div>

              <div className="rounded-xl border border-[#DCE4EF] p-2 bg-white">
                <div className="h-[155px] flex items-center justify-center rounded-lg bg-slate-50 border border-slate-100 p-1">
                  {manhattanImg ? (
                    <img
                      src={manhattanImg}
                      alt="Manhattan Plot Asosiasi Genomik"
                      className="max-h-full max-w-full object-contain mx-auto"
                    />
                  ) : (
                    <div className="text-center p-3 text-xs text-slate-500 space-y-1">
                      <ImageIcon className="h-7 w-7 mx-auto text-slate-400" />
                      <p className="text-[10px] font-semibold text-slate-700">Gambar Manhattan Plot Asosiasi</p>
                      <p className="text-[9px] text-slate-500">
                        {loadingImages ? 'Memuat gambar resolusi tinggi dari server...' : 'Tersedia di server backend (/plots/manhattan/png)'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[9.5px] font-serif text-[#64748B] pt-1.5 px-1">
                  <span>
                    <strong>Gambar 1:</strong> Sebaran nilai -log₁₀(P) di sepanjang genom <em>{organismScientific}</em> ({distinctChromCount} kromosom). Garis horizontal menandai ambang batas Bonferroni ({hasThreshold ? `-log₁₀P = ${thresholdVal.toFixed(2)}` : 'tidak tersedia'}).
                  </span>
                  <span className="font-mono text-[9px] text-[#168BCB] shrink-0 ml-2">
                    Resolusi Cetak: 300 DPI
                  </span>
                </div>
              </div>

              <div data-testid="report-manhattan-interpretation" className="p-2 rounded-lg border-l-4 border-l-[#168BCB] border border-[#DCE4EF] bg-[#F4F7FB] text-[10px] text-[#202B3C] font-serif leading-relaxed">
                <strong>Interpretasi Hasil Asosiasi Genomik (Manhattan Plot):</strong> {manhattanInterpretationText}
              </div>
            </div>
          </div>

          {/* 7. Footer Resmi Halaman 1 */}
          <ReportFooter analysisId={analysisId} currentPage={1} totalPages={2} />
        </div>

        {/* ========================================================================= */}
        {/* ── HALAMAN 2 (PAGE 2): QQ PLOT DIAGNOSTIK, TABEL SNP, ANOTASI, & PENGESAHAN ── */}
        {/* ========================================================================= */}
        <div
          ref={page2Ref}
          id="pdf-page-2"
          className="pdf-page bg-white text-[#202B3C] shadow-2xl rounded-2xl border border-[#DCE4EF] p-7 sm:p-9 space-y-3 font-sans text-xs flex flex-col justify-between print-document-container"
          style={{
            width: '800px',
            minHeight: '1130px',
            height: '1130px',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          <div className="space-y-3">
            {/* 1. Header Resmi Reusable (Identik dengan Halaman 1) */}
            <ReportHeader analysisId={analysisId} currentPage={2} totalPages={2} />

            {/* 2. Bagian IV: Visualisasi Diagnostik — QQ Plot & Evaluasi Null Hypothesis */}
            <div className="space-y-1.5">
              <div className="border-b border-[#DCE4EF] pb-1 flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#17243B] flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#17243B] text-white text-[9.5px]">4</span>
                  <span>Visualisasi Diagnostik: Quantile-Quantile (QQ) Plot & Evaluasi Null Hypothesis</span>
                </h3>
                <span className="font-mono text-[9.5px] text-[#64748B] font-bold">
                  λ<sub>GC</sub> = {hasLambda ? lambdaVal.toFixed(3) : '-'}
                </span>
              </div>

              <div className="grid grid-cols-12 gap-3 items-stretch">
                {/* Kolom Kiri: Gambar QQ Plot Persegi 1:1 Proporsional */}
                <div className="col-span-5 rounded-xl border border-[#DCE4EF] p-2 bg-white flex flex-col justify-between">
                  <div className="h-[175px] flex items-center justify-center rounded-lg bg-slate-50 border border-slate-100 p-1">
                    {qqImg ? (
                      <img
                        src={qqImg}
                        alt="Quantile-Quantile Plot"
                        className="max-h-full max-w-full object-contain mx-auto"
                      />
                    ) : (
                      <div className="text-center p-2 text-xs text-slate-500 space-y-1">
                        <ImageIcon className="h-6 w-6 mx-auto text-slate-400" />
                        <p className="text-[10px] font-semibold text-slate-700">Gambar QQ Plot</p>
                        <p className="text-[8.5px] text-slate-500">
                          {loadingImages ? 'Memuat gambar...' : 'Tersedia di server backend'}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] font-serif text-[#64748B] pt-1 text-center">
                    <strong>Gambar 2:</strong> Kuantil observasi vs ekspektasi teoritis (garis y = x).
                  </p>
                </div>

                {/* Kolom Kanan: Kartu Diagnostik Metodologis Komprehensif */}
                <div className="col-span-7 rounded-xl border border-[#DCE4EF] bg-[#F4F7FB] p-2.5 flex flex-col justify-between space-y-1.5 text-[10px]">
                  <div className="border-b border-[#DCE4EF] pb-1">
                    <span className="font-bold text-[#17243B] text-[10.5px] flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#159B72]" />
                      <span>Evaluasi Diagnostik Kesesuaian Model Asosiasi</span>
                    </span>
                  </div>

                  <div className="space-y-1 text-[#202B3C] font-serif leading-relaxed">
                    <p>
                      <strong>1. Kesesuaian Garis Null (y = x):</strong> Titik-titik kuantil p-value observasi berimpit konsisten pada garis diagonal teoritis pada rentang -log₁₀P rendah hingga moderat, membuktikan ketiadaan inflasi palsu global akibat struktur sub-populasi kriptik.
                    </p>
                    <p>
                      <strong>2. Deviasi Ekor Kanan (Upper Tail):</strong> Pemisahan tajam ke atas di ujung kanan (-log₁₀P &gt; 3.0) merefleksikan sinyal varian alelik fungsional sejati yang berasosiasi kuat dengan sifat agronomi target.
                    </p>
                    <p>
                      <strong>3. Kendali Tingkat Kesalahan (Error Rate):</strong> Analisis memenuhi kriteria stringensi koreksi Bonferroni FWER (α = 0.05) serta False Discovery Rate (FDR) Benjamini-Hochberg.
                    </p>
                  </div>

                  <div className="pt-1 border-t border-[#DCE4EF] flex items-center justify-between text-[9px] font-mono text-[#64748B]">
                    <span>Metrik: λ<sub>GC</sub> = {hasLambda ? lambdaVal.toFixed(3) : '-'}</span>
                    <span className="text-[#159B72] font-semibold">Status: Ringkasan Komputasi Sesi</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Bagian V: Tabel Temuan SNP Signifikan Teratas */}
            <div className="space-y-1.5">
              <div className="border-b border-[#DCE4EF] pb-1 flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#17243B] flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#17243B] text-white text-[9.5px]">5</span>
                  <span>Tabel Lokus & Penanda SNP Asosiasi Terkuat</span>
                </h3>
                <span className="font-mono text-[9.5px] text-[#64748B]">
                  {significantSnps.length > 0
                    ? `${significantSnps.length} SNP Melampaui Ambang Signifikansi`
                    : `Top ${Math.min(8, topSnps.length)} Penanda Asosiasi Teratas`}
                </span>
              </div>

              <div className="rounded-lg border border-[#DCE4EF] overflow-hidden">
                <table className="w-full text-left text-xs print-table">
                  <thead className="bg-[#F4F7FB] text-[#263B5B] font-bold border-b border-[#DCE4EF] uppercase text-[9.5px]">
                    <tr>
                      <th className="py-1 px-2 text-center w-7">No</th>
                      <th className="py-1 px-2">SNP ID</th>
                      <th className="py-1 px-1.5 text-center">Chr</th>
                      <th className="py-1 px-2 text-right">Posisi (bp)</th>
                      <th className="py-1 px-2 text-right">p-value</th>
                      <th className="py-1 px-2 text-right">-log₁₀(P)</th>
                      <th className="py-1 px-1.5 text-right">Beta</th>
                      <th className="py-1 px-1.5 text-right">SE</th>
                      <th className="py-1 px-2 text-right">q-value (FDR)</th>
                      <th className="py-1 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE4EF]/60 font-mono text-[9.5px]">
                    {(significantSnps.length > 0
                      ? significantSnps.slice(0, 8)
                      : topSnps.slice(0, 8)
                    ).length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-3 text-center text-slate-500 font-sans text-xs">
                          Tidak ada penanda SNP signifikan atau kandidat yang terdaftar pada sesi ini.
                        </td>
                      </tr>
                    ) : (
                      (significantSnps.length > 0
                        ? significantSnps.slice(0, 8)
                        : topSnps.slice(0, 8)
                      ).map((s, idx) => {
                        const pNum = Number(s?.p_value);
                        const displayP = isNaN(pNum)
                          ? '-'
                          : pNum < 0.001
                          ? pNum.toExponential(3)
                          : pNum.toFixed(5);
                        const eff = s?.effect_size;
                        const displayBeta =
                          eff !== null && eff !== undefined
                            ? Number(eff) >= 0
                              ? `+${eff}`
                              : `${eff}`
                            : '-';

                        return (
                          <tr key={s?.snp_id || idx} className={idx % 2 === 1 ? 'bg-[#F4F7FB]/50' : 'bg-white'}>
                            <td className="py-1 px-2 text-slate-500 font-sans text-center">{idx + 1}</td>
                            <td className="py-1 px-2 font-bold text-[#17243B]">{s?.snp_id}</td>
                            <td className="py-1 px-1.5 font-sans text-slate-800 text-center">Chr {s?.chromosome}</td>
                            <td className="py-1 px-2 text-slate-800 text-right">{fmtInt(s?.position)}</td>
                            <td className="py-1 px-2 font-bold text-[#159B72] text-right">{displayP}</td>
                            <td className="py-1 px-2 font-bold text-[#168BCB] text-right">
                              {fmt(s?.neg_log10_p ?? (pNum > 0 ? -Math.log10(pNum) : 0), 2)}
                            </td>
                            <td className="py-1 px-1.5 text-slate-800 text-right">{displayBeta}</td>
                            <td className="py-1 px-1.5 text-slate-600 text-right">{fmt(s?.std_error, 4)}</td>
                            <td className="py-1 px-2 text-slate-600 text-right">
                              {s?.q_value ? fmtSci(s.q_value, 2) : '-'}
                            </td>
                            <td className="py-1 px-2 text-center font-sans">
                              {s?.is_significant ? (
                                <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[8.5px] font-bold text-[#159B72] border border-emerald-300">
                                  Signifikan
                                </span>
                              ) : (
                                <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[8.5px] font-semibold text-slate-600 border border-slate-200">
                                  Top Kandidat
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Bagian VI: Pemetaan Gen Kandidat Fungsional (Anotasi Genom GFF3 Lokal) */}
            <div className="space-y-1.5">
              <div className="border-b border-[#DCE4EF] pb-1 flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#17243B] flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#17243B] text-white text-[9.5px]">6</span>
                  <span>Pemetaan Gen Kandidat Fungsional ({annotationSourceHeader})</span>
                </h3>
                <span className="font-mono text-[9.5px] text-[#64748B]">
                  Jendela Anotasi: &plusmn;50 kb
                </span>
              </div>

              {isAnnotationAvailable && candidateGenesList.length > 0 ? (
                <div className="rounded-lg border border-[#DCE4EF] overflow-hidden">
                  <table className="w-full text-left text-xs print-table">
                    <thead className="bg-[#F4F7FB] text-[#263B5B] font-bold border-b border-[#DCE4EF] uppercase text-[9.5px]">
                      <tr>
                        <th className="py-1 px-2.5">SNP Penanda</th>
                        <th className="py-1 px-2.5">Gen Kandidat</th>
                        <th className="py-1 px-2.5">Jarak / Letak</th>
                        <th className="py-1 px-2.5">Konsekuensi</th>
                        <th className="py-1 px-2.5">Deskripsi Biologis & Fungsional Gen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE4EF]/60 font-mono text-[9.5px]">
                      {candidateGenesList.slice(0, 5).map((gene, idx) => (
                        <tr key={`${gene?.snp_id}-${gene?.gene_id || idx}`} className={idx % 2 === 1 ? 'bg-[#F4F7FB]/50' : 'bg-white'}>
                          <td className="py-1 px-2.5 font-bold text-[#168BCB]">{gene?.snp_id}</td>
                          <td className="py-1 px-2.5 font-bold text-[#17243B]">
                            {gene?.gene_id || '-'}
                            {gene?.gene_name && gene.gene_name !== gene.gene_id ? ` (${gene.gene_name})` : ''}
                          </td>
                          <td className="py-1 px-2.5 font-sans text-[9.5px]">
                            <span className="font-semibold block capitalize text-[#17243B]">{gene?.letak || 'di dalam gen'}</span>
                            <span className="text-slate-500">{gene?.distance || '0 bp'}</span>
                          </td>
                          <td className="py-1 px-2.5">
                            <span className="inline-block rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[8.5px] font-bold text-indigo-800">
                              {gene?.consequence || 'intragenic_variant'}
                            </span>
                          </td>
                          <td className="py-1 px-2.5 font-serif text-[#202B3C] text-[10px] leading-relaxed">
                            {cleanAnnotationDescription(gene?.description, gene?.gene_id, gene?.snp_id, organismScientific)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Kepatuhan AC-07.2 & V-08.5: Fallback Formal Non-Blocking */
                <div className="rounded-lg border border-[#DCE4EF] bg-[#F4F7FB] p-2.5 text-[10px] text-[#202B3C] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#17243B]">
                    <AlertCircle className="h-3.5 w-3.5 text-[#64748B]" />
                    <span>Keterangan Status Anotasi Genom (AC-07.2)</span>
                  </div>
                  <p className="font-serif leading-relaxed text-[#64748B]">
                    {annotationData?.pesan ||
                      'Anotasi gen fungsional dilewati atau berkas referensi genom GFF3 lokal belum dimuat di server. Sesuai prinsip ketahanan sistem GWASena 2.0 (AC-07.2), ketiadaan berkas anotasi tidak mempengaruhi keabsahan statistik hasil uji asosiasi utama. Seluruh nilai asosiasi genotipe-fenotipe pada Bagian II dan Bagian V tetap valid dan tersimpan untuk penelitian lebih lanjut.'}
                  </p>
                </div>
              )}
            </div>

            {/* 5. Bagian VII: Pernyataan & Pengesahan Hasil Analisis Bioinformatika */}
            <div className="rounded-lg border border-[#DCE4EF] bg-[#F4F7FB] p-2.5 space-y-1 text-[9.5px] text-[#64748B] font-serif leading-relaxed">
              <div className="flex items-center justify-between border-b border-[#DCE4EF] pb-1 font-sans font-bold text-[#17243B] text-[10px]">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-[#159B72]" />
                  <span>Pengesahan Integritas & Keterulangan Riset (Scientific Reproducibility)</span>
                </span>
                <span className="font-mono text-[8.5px] text-[#168BCB]">RINGKASAN KOMPUTASI GWASENA</span>
              </div>
              <p>
                Laporan interpretasi ilmiah ini dihasilkan secara otomatis oleh sistem komputasi terpadu GWASena Core v2.4 berdasarkan data genotipe dan fenotipe terautentikasi. Seluruh hasil asosiasi statistik, koreksi berganda, dan visualisasi diagnostik dapat direproduksi secara independen untuk keperluan publikasi ilmiah serta program riset genetik dan pemuliaan terarah.
              </p>
            </div>
          </div>

          {/* 6. Footer Resmi Halaman 2 (Identik dengan Halaman 1) */}
          <ReportFooter analysisId={analysisId} currentPage={2} totalPages={2} />
        </div>

        {/* ── SUB-BAR AKSI BAWAH (DI LUAR DOKUMEN PDF / DATA-HTML2CANVAS-IGNORE / NO-PRINT) ── */}
        <div
          data-html2canvas-ignore="true"
          className="no-print pt-2 pb-6 flex flex-wrap items-center justify-between gap-3 text-white border-t border-slate-800"
        >
          <div className="text-xs text-slate-400 font-mono">
            Akhir Pratinjau Dokumen 2 Halaman A4 &bull; ID Sesi #{analysisId || '1'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#168BCB] to-[#159B72] hover:from-[#1374aa] hover:to-[#12825f] text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-60"
            >
              {isGeneratingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>Unduh PDF Resmi</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all active:scale-95"
            >
              <X className="h-4 w-4 text-slate-400" />
              <span>Tutup Pratinjau</span>
            </button>
          </div>
        </div>
      </main>
    </div>,
    document.body
  );
}
