import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  Dna,
  CheckCircle2,
  FileCheck2,
  ArrowRight,
  Loader2,
  Info,
  X,
  Sparkles,
  Layers,
  Eye,
  EyeOff,
  Table,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { analysisService } from '../../services/analysisService.js';
import { useAnalysisStore } from '../../store/useAnalysisStore.js';
import ErrorMessageArea from '../common/ErrorMessageArea.jsx';

/**
 * Step1Upload (Unggah & Validasi Data Genomik - Dukung VCF & PLINK Biner)
 * Acuan: PR #24 (Dukungan Format PLINK Biner .bed/.bim/.fam) & FR-02
 */
export default function Step1Upload({ analysisId, onUploadSuccess, onNext }) {
  const navigate = useNavigate();
  const {
    setActiveStep,
    setUploadSummary,
    uploadSummary,
  } = useAnalysisStore();

  const [loadingBenchmarkMode, setLoadingBenchmarkMode] = useState(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const [formatMode, setFormatMode] = useState(
    uploadSummary?.genotipe?.format?.toLowerCase()?.includes('plink') ? 'plink' : 'vcf'
  );

  const [genotypeFile, setGenotypeFile] = useState(
    uploadSummary?.genotipe
      ? {
          name: uploadSummary.genotipe.nama_berkas || 'garlic_benchmark.vcf',
          size: 2.45 * 1024 * 1024,
        }
      : null
  );
  const [bimFile, setBimFile] = useState(null);
  const [famFile, setFamFile] = useState(null);

  const [phenotypeFile, setPhenotypeFile] = useState(
    uploadSummary?.fenotipe
      ? {
          name: uploadSummary.fenotipe.nama_berkas || 'phenotype_weight.csv',
          size: 14.2 * 1024,
        }
      : null
  );

  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(uploadSummary || null);
  const [error, setError] = useState(null);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [structureTab, setStructureTab] = useState('vcf');

  const [isDraggingGeno, setIsDraggingGeno] = useState(false);
  const [isDraggingBim, setIsDraggingBim] = useState(false);
  const [isDraggingFam, setIsDraggingFam] = useState(false);
  const [isDraggingPheno, setIsDraggingPheno] = useState(false);

  const genoInputRef = useRef(null);
  const bimInputRef = useRef(null);
  const famInputRef = useRef(null);
  const phenoInputRef = useRef(null);

  // Validasi & seleksi berkas genotipe VCF / BED
  const handleGenotypeSelect = (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();

    // Auto-deteksi jika berkas yang dipilih adalah .bed
    if (name.endsWith('.bed')) {
      setFormatMode('plink');
      setGenotypeFile(file);
      setError(null);
      setUploadResult(null);
      return;
    }

    if (name.endsWith('.vcf') || name.endsWith('.vcf.gz')) {
      setFormatMode('vcf');
      setGenotypeFile(file);
      setError(null);
      setUploadResult(null);
      return;
    }

    setError({
      message: 'Format berkas genotipe tidak didukung.',
      details: [
        `Berkas '${file.name}' harus berformat .vcf / .vcf.gz (VCF) atau .bed (PLINK biner).`,
      ],
    });
    setGenotypeFile(null);
  };

  const handleBimSelect = (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.bim')) {
      setError({
        message: 'Format berkas peta varian tidak valid.',
        details: [`Berkas '${file.name}' harus berekstensi .bim.`],
      });
      setBimFile(null);
      return;
    }
    setError(null);
    setBimFile(file);
    setUploadResult(null);
  };

  const handleFamSelect = (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.fam')) {
      setError({
        message: 'Format berkas sampel/pedigree tidak valid.',
        details: [`Berkas '${file.name}' harus berekstensi .fam.`],
      });
      setFamFile(null);
      return;
    }
    setError(null);
    setFamFile(file);
    setUploadResult(null);
  };

  // Validasi ekstensi fenotipe (.csv)
  const handlePhenotypeSelect = (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv')) {
      setError({
        message: 'Format berkas fenotipe tidak didukung.',
        details: [`Berkas '${file.name}' harus berformat .csv teks tabular.`],
      });
      setPhenotypeFile(null);
      return;
    }
    setError(null);
    setPhenotypeFile(file);
    setUploadResult(null);
  };

  // 1-Klik Instan: Gunakan Dataset Contoh Benchmark (VCF atau PLINK)
  const handleUseSampleData = async (mode = 'vcf') => {
    setError(null);
    setLoadingBenchmarkMode(mode);
    setIsUploading(true);

    try {
      // 1. Panggil endpoint dedicated backend: POST /api/analyses/benchmark
      const res = await analysisService.loadBenchmark(mode, analysisId);

      // 2. Sinkronisasi Sesi: Jika backend membuat sesi baru (karena sesi sebelumnya 404/null),
      // perbarui URL secara transparan tanpa reload halaman
      const newAnalysisId = res.analysis_id;
      if (newAnalysisId && String(newAnalysisId) !== String(analysisId)) {
        navigate(`/analyses/${newAnalysisId}`, { replace: true });
        useAnalysisStore.getState().setCurrentAnalysis({
          id: newAnalysisId,
          analysis_id: newAnalysisId,
          analysis_name: 'Analisis Bobot Umbi Bawang Putih',
          status: 'tervalidasi',
          organism: 'Allium sativum (Bawang Putih)',
        });
      }

      // 3. Pasang file representasi di kartu slot unggahan agar UI interaktif & valid
      if (mode === 'plink') {
        setFormatMode('plink');
        setGenotypeFile({
          name: 'genotipe_bawang_putih_mini.bed',
          size: 5003,
          type: 'application/octet-stream',
        });
        setBimFile({
          name: 'genotipe_bawang_putih_mini.bim',
          size: 17364,
          type: 'text/plain',
        });
        setFamFile({
          name: 'genotipe_bawang_putih_mini.fam',
          size: 880,
          type: 'text/plain',
        });
        setPhenotypeFile({
          name: 'fenotipe_bawang_putih_mini.csv',
          size: 1441,
          type: 'text/csv',
        });
      } else {
        setFormatMode('vcf');
        setGenotypeFile({
          name: 'genotipe_bawang_putih_mini.vcf',
          size: 107529,
          type: 'text/vcf',
        });
        setBimFile(null);
        setFamFile(null);
        setPhenotypeFile({
          name: 'fenotipe_bawang_putih_mini.csv',
          size: 1441,
          type: 'text/csv',
        });
      }

      setUploadResult(res);
      setUploadSummary(res);
      setError(null);

      // Auto-naming sinkronisasi jika nama sesi diawali kosong
      if (
        typeof window !== 'undefined' &&
        (localStorage.getItem(`gwasena_auto_name_${analysisId}`) === 'true' ||
          (newAnalysisId && localStorage.getItem(`gwasena_auto_name_${newAnalysisId}`) === 'true'))
      ) {
        const cur = useAnalysisStore.getState().currentAnalysis;
        if (cur) {
          useAnalysisStore.getState().setCurrentAnalysis({
            ...cur,
            analysis_name: 'Analisis Bobot Umbi Bawang Putih',
          });
        }
      }

      onUploadSuccess?.(res);
    } catch (err) {
      console.error('Gagal memuat dataset benchmark dari server:', err);
      setError({
        message: err?.message || err?.pesan || 'Gagal memuat dataset benchmark dari server.',
        details: err?.details || err?.rincian || [],
      });
      setUploadResult(null);
    } finally {
      setLoadingBenchmarkMode(null);
      setIsUploading(false);
    }
  };

  const handleUploadAndValidate = async (e) => {
    e.preventDefault();

    if (formatMode === 'plink') {
      if (!genotypeFile || !bimFile || !famFile || !phenotypeFile) {
        setError({
          message: 'Berkas PLINK biner belum lengkap.',
          details: [
            !genotypeFile ? 'Berkas genotipe .bed belum dipilih.' : null,
            !bimFile ? 'Berkas peta varian .bim belum dipilih.' : null,
            !famFile ? 'Berkas sampel .fam belum dipilih.' : null,
            !phenotypeFile ? 'Berkas fenotipe .csv belum dipilih.' : null,
          ].filter(Boolean),
        });
        return;
      }
    } else {
      if (!genotypeFile || !phenotypeFile) {
        setError('Mohon pilih kedua berkas (Genotipe VCF dan Fenotipe CSV) terlebih dahulu.');
        return;
      }
    }

    // Validasi ekstensi sisi klien sebelum mengirimkan upload ke backend (TC-02)
    const genoNameLower = (genotypeFile?.name || '').toLowerCase();
    const phenoNameLower = (phenotypeFile?.name || '').toLowerCase();
    const extErrors = [];
    if (formatMode === 'plink') {
      if (!genoNameLower.endsWith('.bed')) {
        extErrors.push(`Berkas '${genotypeFile?.name}' harus berekstensi .bed.`);
      }
      if (!bimFile?.name?.toLowerCase().endsWith('.bim')) {
        extErrors.push(`Berkas '${bimFile?.name}' harus berekstensi .bim.`);
      }
      if (!famFile?.name?.toLowerCase().endsWith('.fam')) {
        extErrors.push(`Berkas '${famFile?.name}' harus berekstensi .fam.`);
      }
    } else {
      if (!genoNameLower.endsWith('.vcf') && !genoNameLower.endsWith('.vcf.gz')) {
        extErrors.push(`Berkas '${genotypeFile?.name}' harus berformat .vcf atau .vcf.gz.`);
      }
    }
    if (!phenoNameLower.endsWith('.csv')) {
      extErrors.push(`Berkas '${phenotypeFile?.name}' harus berformat .csv teks tabular.`);
    }
    if (extErrors.length > 0) {
      setError({
        message: 'Format berkas tidak valid. Periksa kembali ekstensi berkas Anda.',
        details: extErrors,
      });
      setUploadResult(null);
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('genotipe', genotypeFile);
    formData.append('fenotipe', phenotypeFile);
    if (formatMode === 'plink') {
      if (bimFile) formData.append('bim', bimFile);
      if (famFile) formData.append('fam', famFile);
    }

    try {
      const res = await analysisService.uploadDataset(analysisId, formData);
      setUploadResult(res);
      setUploadSummary(res);

      // Auto-naming sinkronisasi jika nama sesi diawali kosong
      if (typeof window !== 'undefined' && localStorage.getItem(`gwasena_auto_name_${analysisId}`) === 'true') {
        const cur = useAnalysisStore.getState().currentAnalysis;
        const autoBase = phenotypeFile?.name ? phenotypeFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Genomik';
        const newName = `Analisis Asosiasi ${autoBase}`;
        if (cur) {
          useAnalysisStore.getState().setCurrentAnalysis({
            ...cur,
            analysis_name: newName,
          });
        }
      }

      onUploadSuccess?.(res);
    } catch (err) {
      console.error('Validasi berkas gagal atau ditolak server:', err);
      setError({
        message: err?.message || err?.pesan || 'Validasi berkas gagal diproses oleh server.',
        details: err?.details || err?.rincian || [],
      });
      setUploadResult(null);
    } finally {
      setIsUploading(false);
    }
  };

  const isReadyToProceed = Boolean(
    uploadResult &&
      !error &&
      uploadResult?.validation?.is_valid !== false &&
      uploadResult?.validation?.sample_match !== false &&
      (!uploadResult?.kecocokan_sample_id?.status ||
        String(uploadResult.kecocokan_sample_id.status).toLowerCase() === 'cocok')
  );

  // State Guard 1: hanya izinkan lanjut ke Langkah 2 bila berkas tervalidasi & Sample ID cocok
  const handleProceedToStep2 = () => {
    if (!isReadyToProceed) {
      setError({
        message: 'Belum dapat melanjutkan ke konfigurasi QC.',
        details: ['Selesaikan unggah & validasi berkas hingga Sample ID dinyatakan cocok terlebih dahulu.'],
      });
      return;
    }
    setActiveStep(2);
    onNext?.();
  };

  const handleDownloadBenchmarkZip = async (format = 'all') => {
    setIsDownloadingZip(true);
    setError(null);
    try {
      await analysisService.downloadBenchmarkZip(format);
    } catch (err) {
      console.error('Gagal mengunduh arsip benchmark ZIP dari server:', err);
      setError({
        message: err?.message || 'Gagal mengunduh berkas benchmark dari server.',
        details: err?.details || [],
      });
    } finally {
      setIsDownloadingZip(false);
    }
  };

  // Handler unduh contoh file langsung ke browser pengguna (Evaluasi Tester Poin 10)
  const handleDownloadSampleFile = (type) => {
    let content = '';
    let filename = '';
    let mime = 'text/plain';

    if (type === 'vcf') {
      filename = 'garlic_sample_benchmark.vcf';
      mime = 'text/vcf';
      content = `##fileformat=VCFv4.2
##FILTER=<ID=PASS,Description="All filters passed">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
##contig=<ID=chr1,length=180000000>
##contig=<ID=chr2,length=175000000>
##contig=<ID=chr3,length=190000000>
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	sample_01	sample_02	sample_03	sample_04	sample_05
chr1	124050	snp_chr1_0001	A	G	99	PASS	.	GT	0/0	0/1	0/0	1/1	0/1
chr1	285620	snp_chr1_0002	C	T	99	PASS	.	GT	0/1	0/0	0/0	0/1	0/0
chr2	145890	snp_chr2_0001	G	A	99	PASS	.	GT	1/1	0/1	0/0	0/0	0/1
chr3	21745450	snp_chr3_0042	T	C	99	PASS	.	GT	0/1	1/1	0/0	1/1	0/1
`;
    } else {
      filename = 'garlic_phenotype_sample.csv';
      mime = 'text/csv';
      content = `sample_id,bobot_umbi_g,diameter_umbi_mm,jumlah_siung
sample_01,42.5,38.2,11
sample_02,39.1,35.0,9
sample_03,45.8,40.1,12
sample_04,36.4,33.5,8
sample_05,48.2,42.0,13
`;
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header Langkah ── */}
      <div className="border-b border-slate-200 dark:border-white/10 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          1. Unggah & Validasi Dataset Genomik
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Unggah berkas varian genotipe (SNP) dan data pengamatan fenotipe. Sistem secara otomatis
          memvalidasi struktur berkas dan mencocokkan Sample ID antar dataset.
        </p>
      </div>

      <ErrorMessageArea error={error} onDismiss={() => setError(null)} />

      {/* ── Banner Pintasan Data Contoh Benchmark (1-Klik Cepat) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-white/85 dark:border-[#06B6D4]/30 bg-gradient-to-r from-white/70 via-sky-50/60 to-cyan-50/45 dark:from-[#06B6D4]/10 dark:via-[#0F172E]/80 dark:to-[#121B38] p-4 sm:p-5 backdrop-blur-xl shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#06B6D4]/15 text-[#06B6D4] shadow-inner">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Coba Dataset Contoh Benchmark (Bawang Putih)</span>
              <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                100% Lolos QC
              </span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
              40 sampel &times; 500 SNP (chr1-chr8) dengan sifat bobot umbi &amp; diameter umbi. Tersedia format VCF dan PLINK biner.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            disabled={loadingBenchmarkMode !== null}
            onClick={() => handleUseSampleData('vcf')}
            className="figma-btn-primary cursor-pointer whitespace-nowrap text-xs px-3.5 py-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {loadingBenchmarkMode === 'vcf' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Dna className="h-3.5 w-3.5" />
            )}
            <span>{loadingBenchmarkMode === 'vcf' ? 'Memuat VCF...' : 'Pakai VCF'}</span>
          </button>
          <button
            type="button"
            disabled={loadingBenchmarkMode !== null}
            onClick={() => handleUseSampleData('plink')}
            className="rounded-2xl border border-cyan-400/80 dark:border-cyan-500/30 bg-cyan-50 dark:bg-[#06B6D4]/15 px-3.5 py-2 text-xs font-sans font-bold text-cyan-900 dark:text-[#06B6D4] hover:bg-cyan-100 dark:hover:bg-[#06B6D4]/25 transition-all shadow-xs cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {loadingBenchmarkMode === 'plink' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Layers className="h-3.5 w-3.5" />
            )}
            <span>{loadingBenchmarkMode === 'plink' ? 'Memuat PLINK...' : 'Pakai PLINK'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowStructureModal(true)}
            className="rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 px-3.5 py-2 text-xs font-sans font-bold text-slate-800 dark:text-slate-200 transition-all shadow-xs cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <Eye className="h-3.5 w-3.5 text-[#5B4DFE] dark:text-[#06B6D4]" />
            <span>Lihat Struktur / Unduh Contoh</span>
          </button>
        </div>
      </div>

      {/* ── Format Selector Toggle (VCF vs PLINK Biner) ── */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-subcard w-fit">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 px-3">
          Format Genotipe:
        </span>
        <button
          type="button"
          onClick={() => {
            setFormatMode('vcf');
            if (genotypeFile?.name?.endsWith('.bed')) setGenotypeFile(null);
            setError(null);
          }}
          className={`rounded-xl px-4 py-2 text-xs font-sans font-bold transition-all cursor-pointer ${
            formatMode === 'vcf'
              ? 'bg-[#5B4DFE] text-white shadow-md shadow-[#5B4DFE]/30'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          VCF (Standar)
        </button>
        <button
          type="button"
          onClick={() => {
            setFormatMode('plink');
            if (genotypeFile?.name && !genotypeFile.name.endsWith('.bed')) setGenotypeFile(null);
            setError(null);
          }}
          className={`rounded-xl px-4 py-2 text-xs font-sans font-bold transition-all cursor-pointer ${
            formatMode === 'plink'
              ? 'bg-[#5B4DFE] text-white shadow-md shadow-[#5B4DFE]/30'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          PLINK Biner (.bed + .bim + .fam)
        </button>
      </div>

      {/* ── Form Dropzone Grid (2 Kolom) ── */}
      <form onSubmit={handleUploadAndValidate} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ── Dropzone 1: Genotipe ── */}
          <div
            className={`flex flex-col justify-between rounded-3xl border-2 border-dashed p-6 transition-all ${
              formatMode === 'vcf'
                ? isDraggingGeno
                  ? 'border-[#06B6D4] bg-[#06B6D4]/10 scale-[1.005]'
                  : genotypeFile
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-white/80 dark:border-white/15 bg-white/50 dark:bg-[#0F172E]/60 backdrop-blur-md shadow-xs hover:border-[#0284C7]'
                : genotypeFile && bimFile && famFile
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-white/80 dark:border-white/15 bg-white/50 dark:bg-[#0F172E]/60 backdrop-blur-md shadow-xs hover:border-[#0284C7]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#06B6D4]/15 text-[#06B6D4]">
                    <Dna className="h-4 w-4" />
                  </div>
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {formatMode === 'plink' ? 'Genotipe PLINK Biner' : 'Berkas Genotipe (VCF)'}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#162142] px-2.5 py-0.5 text-slate-800 dark:text-slate-200">
                  {formatMode === 'plink' ? '.bed + .bim + .fam' : '.vcf / .vcf.gz'}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mb-4 leading-relaxed font-medium">
                {formatMode === 'plink'
                  ? 'Format biner PLINK 1.9 / 2.0 membutuhkan berkas .bed (genotipe), .bim (peta varian), dan .fam (sampel).'
                  : 'Format VCF standar (.vcf / .vcf.gz) yang memuat informasi varian penanda SNP multi-sampel.'}
              </p>

              {formatMode === 'vcf' ? (
                <>
                  {genotypeFile ? (
                    <div className="flex items-center justify-between rounded-2xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-[#121B38] p-3.5 shadow-sm animate-pop-in">
                      <div className="flex items-center gap-2.5 truncate">
                        <FileCheck2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div className="truncate">
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {genotypeFile.name}
                          </div>
                          <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                            {(genotypeFile.size / (1024 * 1024)).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setGenotypeFile(null);
                          setUploadResult(null);
                        }}
                        className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white active:scale-95 transition-all cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingGeno(true);
                      }}
                      onDragLeave={() => setIsDraggingGeno(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingGeno(false);
                        if (e.dataTransfer.files?.[0]) handleGenotypeSelect(e.dataTransfer.files[0]);
                      }}
                      onClick={() => genoInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-6 rounded-2xl border border-white/80 dark:border-white/10 bg-white/60 dark:bg-[#0F172E]/50 backdrop-blur-md cursor-pointer hover:bg-white/80 dark:hover:bg-white/5 active:scale-[0.99] transition-all text-center group shadow-xs"
                    >
                      <UploadCloud className="h-8 w-8 text-[#0284C7] dark:text-[#06B6D4] mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        Pilih atau Seret Berkas VCF ke Sini
                      </span>
                      <span className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-medium">Maks. ukuran berkas: 50 MB</span>
                    </div>
                  )}

                  <input
                    ref={genoInputRef}
                    type="file"
                    accept=".vcf,.vcf.gz,.bed"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleGenotypeSelect(e.target.files[0]);
                    }}
                  />
                </>
              ) : (
                /* Mode PLINK Biner: 3 Berkas */
                <div className="space-y-2.5">
                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-2.5 bg-white/50 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        1. Berkas .bed (Genotipe) <span className="text-red-500">*</span>
                      </span>
                      {genotypeFile ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[140px]">
                            {genotypeFile.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setGenotypeFile(null)}
                            className="p-0.5 text-slate-400 hover:text-red-500"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => genoInputRef.current?.click()}
                          className="text-xs font-sans font-bold text-[#0284C7] dark:text-[#06B6D4] hover:underline cursor-pointer"
                        >
                          + Pilih .bed
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-2.5 bg-white/50 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        2. Berkas .bim (Peta Varian) <span className="text-red-500">*</span>
                      </span>
                      {bimFile ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[140px]">
                            {bimFile.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setBimFile(null)}
                            className="p-0.5 text-slate-400 hover:text-red-500"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => bimInputRef.current?.click()}
                          className="text-xs font-sans font-bold text-[#0284C7] dark:text-[#06B6D4] hover:underline cursor-pointer"
                        >
                          + Pilih .bim
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-2.5 bg-white/50 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        3. Berkas .fam (Sampel/Pedigree) <span className="text-red-500">*</span>
                      </span>
                      {famFile ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[140px]">
                            {famFile.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setFamFile(null)}
                            className="p-0.5 text-slate-400 hover:text-red-500"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => famInputRef.current?.click()}
                          className="text-xs font-sans font-bold text-[#0284C7] dark:text-[#06B6D4] hover:underline cursor-pointer"
                        >
                          + Pilih .fam
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    ref={genoInputRef}
                    type="file"
                    accept=".bed"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleGenotypeSelect(e.target.files[0]);
                    }}
                  />
                  <input
                    ref={bimInputRef}
                    type="file"
                    accept=".bim"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleBimSelect(e.target.files[0]);
                    }}
                  />
                  <input
                    ref={famInputRef}
                    type="file"
                    accept=".fam"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFamSelect(e.target.files[0]);
                    }}
                  />
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-medium">
              <Info className="h-4 w-4 shrink-0 text-[#0284C7] dark:text-[#06B6D4]" />
              <span>
                {formatMode === 'plink'
                  ? 'Format PLINK biner didukung penuh untuk komputasi asosiasi berskala besar.'
                  : 'Format VCF didukung dalam bentuk teks biasa (.vcf) maupun kompresi (.vcf.gz).'}
              </span>
            </div>
          </div>

          {/* ── Dropzone 2: Fenotipe ── */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingPheno(true);
            }}
            onDragLeave={() => setIsDraggingPheno(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingPheno(false);
              if (e.dataTransfer.files?.[0]) handlePhenotypeSelect(e.dataTransfer.files[0]);
            }}
            className={`flex flex-col justify-between rounded-3xl border-2 border-dashed p-6 transition-all ${
              isDraggingPheno
                ? 'border-[#0284C7] bg-[#0284C7]/10 scale-[1.005]'
                : phenotypeFile
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-white/80 dark:border-white/15 bg-white/50 dark:bg-[#0F172E]/60 backdrop-blur-md shadow-xs hover:border-[#0284C7] hover:bg-sky-50/40 dark:hover:bg-white/5'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#5B4DFE]/15 text-[#5B4DFE]">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Berkas Fenotipe (CSV)
                  </span>
                </div>
                <span className="text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#162142] px-2.5 py-0.5 text-slate-800 dark:text-slate-200">
                  .csv
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mb-4 leading-relaxed font-medium">
                Tabel CSV yang memuat kolom identitas sampel (<code>sample_id</code>) beserta satu atau lebih kolom nilai fenotipe kuantitatif/kualitatif.
              </p>

              {phenotypeFile ? (
                <div className="flex items-center justify-between rounded-2xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-[#121B38] p-3.5 shadow-sm animate-pop-in">
                  <div className="flex items-center gap-2.5 truncate">
                    <FileCheck2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {phenotypeFile.name}
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        {(phenotypeFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhenotypeFile(null);
                      setUploadResult(null);
                    }}
                    className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white active:scale-95 transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => phenoInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 rounded-2xl border border-white/80 dark:border-white/10 bg-white/60 dark:bg-[#0F172E]/50 backdrop-blur-md cursor-pointer hover:bg-white/80 dark:hover:bg-white/5 active:scale-[0.99] transition-all text-center group shadow-xs"
                >
                  <UploadCloud className="h-8 w-8 text-[#0284C7] dark:text-[#06B6D4] mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Pilih atau Seret Berkas CSV ke Sini
                  </span>
                  <span className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-medium">Maks. ukuran berkas: 10 MB (UTF-8)</span>
                </div>
              )}

              <input
                ref={phenoInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handlePhenotypeSelect(e.target.files[0]);
                }}
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-medium">
              <Info className="h-4 w-4 shrink-0 text-[#0284C7] dark:text-[#06B6D4]" />
              <span>Contoh kolom sifat: bobot_umbi_g, diameter_umbi_mm, jumlah_siung.</span>
            </div>
          </div>
        </div>

        {/* Tombol Unggah & Validasi (Figma Primary CTA) */}
        <div className="flex justify-center pt-2">
          <button
            type="submit"
            disabled={
              isUploading ||
              !genotypeFile ||
              !phenotypeFile ||
              (formatMode === 'plink' && (!bimFile || !famFile))
            }
            className="figma-btn-primary px-8 py-3.5 text-sm sm:text-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Memvalidasi Format &amp; Mencocokkan Sample ID...</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-5 w-5" />
                <span>Unggah &amp; Validasi Berkas Sekarang</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Panel Hasil Validasi Sukses ── */}
      {uploadResult && (
        <div className="rounded-3xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 p-5 sm:p-7 shadow-xl backdrop-blur-md animate-pop-in space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200 dark:border-emerald-500/20 pb-3.5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Validasi Dataset Berhasil! (100% Sample ID Cocok)</span>
                  <span className="rounded-full bg-cyan-100 dark:bg-cyan-500/20 px-2.5 py-0.5 text-xs font-mono font-bold text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30">
                    Format: {uploadResult.genotipe?.format || (formatMode === 'plink' ? 'PLINK biner' : 'VCF')}
                  </span>
                </h3>
                <span className="text-xs text-emerald-800 dark:text-emerald-400 font-medium">
                  {uploadResult.pesan || 'Berkas valid dan siap dikonfigurasi.'}
                </span>
              </div>
            </div>
            <span className="self-start sm:self-auto rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-3.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
              Status: Tervalidasi
            </span>
          </div>

          {/* Peringatan Non-Fatal dari Validasi Backend (PR #29: kolom non-numerik diabaikan / varian dilewati) */}
          {Array.isArray(uploadResult.peringatan) && uploadResult.peringatan.length > 0 && (
            <div
              role="status"
              className="rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50/90 dark:bg-amber-500/15 p-3.5 text-xs text-amber-950 dark:text-amber-200 space-y-1.5"
            >
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Peringatan Validasi (Non-Fatal):</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 font-medium">
                {uploadResult.peringatan.map((warn, idx) => (
                  <li key={idx}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Grid Metrik Dataset (Hero Stats dengan Neuton Serif) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-subcard p-3.5 text-center">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase font-sans tracking-wide">
                Sampel Cocok
              </span>
              <div className="font-serif text-2xl font-bold text-[#0284C7] dark:text-[#06B6D4] tabular-nums mt-1">
                {uploadResult.kecocokan_sample_id?.jumlah_cocok ??
                  uploadResult.genotipe?.jumlah_sampel ??
                  uploadResult.kecocokan_sample_id?.jumlah_sampel_cocok ??
                  '—'}
              </div>
            </div>

            <div className="glass-subcard p-3.5 text-center">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase font-sans tracking-wide">
                Jumlah SNP
              </span>
              <div className="font-serif text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
                {uploadResult.genotipe?.jumlah_snp ?? '—'}
              </div>
            </div>

            <div className="glass-subcard p-3.5 text-center">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase font-sans tracking-wide">
                Format Terdeteksi
              </span>
              <div className="font-mono text-xs font-bold text-[#0284C7] dark:text-[#06B6D4] mt-2">
                {uploadResult.genotipe?.format || (formatMode === 'plink' ? 'PLINK biner' : 'VCF v4.2')}
              </div>
            </div>

            <div className="glass-subcard p-3.5 text-center">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase font-sans tracking-wide">
                Sampel Fenotipe
              </span>
              <div className="font-serif text-2xl font-bold text-[#0284C7] dark:text-[#38BDF8] tabular-nums mt-1">
                {uploadResult.fenotipe?.jumlah_sampel ?? uploadResult.fenotipe?.varietas_tercatat ?? '—'}
              </div>
            </div>
          </div>

          {/* Sifat Fenotipe Tersedia */}
          {(uploadResult.fenotipe?.daftar_sifat || uploadResult.fenotipe?.sifat_tersedia) && (
            <div className="glass-subcard p-4 space-y-2">
              <span className="text-xs font-semibold font-sans text-slate-700 dark:text-slate-300 block">
                Sifat Fenotipe yang Terdeteksi dalam CSV:
              </span>
              <div className="flex flex-wrap gap-2">
                {(uploadResult.fenotipe.daftar_sifat || uploadResult.fenotipe.sifat_tersedia).map((trait) => (
                  <span
                    key={trait}
                    className="inline-flex items-center gap-1 rounded-xl border border-cyan-300 dark:border-[#06B6D4]/30 bg-cyan-50 dark:bg-[#06B6D4]/10 px-3 py-1 text-xs font-serif italic font-medium text-cyan-900 dark:text-[#06B6D4]"
                  >
                    <span>{trait}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tombol Lanjut ke Step 2 (Konfigurasi QC) */}
          <div className="flex justify-end pt-3">
            <button
              type="button"
              disabled={!isReadyToProceed}
              onClick={handleProceedToStep2}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-sm hover:-translate-y-[1px] hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-100 cursor-pointer"
            >
              <span>Lanjut ke Konfigurasi QC (Langkah 2)</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Pratinjau Struktur Kolom & Unduh Berkas Contoh (Evaluasi Tester Poin 10) ── */}
      {showStructureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl figma-card p-6 sm:p-7 shadow-2xl space-y-4 animate-modal-in rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-[#0F172E]/95 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3.5">
              <div className="flex items-center gap-2">
                <Table className="h-5 w-5 text-[#5B4DFE] dark:text-[#06B6D4]" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-sans tracking-tight">
                  Pratinjau Struktur Kolom & Unduh Contoh Dataset
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStructureModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tab Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-2 text-xs font-bold font-sans">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStructureTab('vcf')}
                  className={`px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer ${
                    structureTab === 'vcf'
                      ? 'bg-[#5B4DFE] text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  1. Format VCF
                </button>
                <button
                  type="button"
                  onClick={() => setStructureTab('csv')}
                  className={`px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer ${
                    structureTab === 'csv'
                      ? 'bg-[#5B4DFE] text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  2. Format CSV Fenotipe
                </button>
                <button
                  type="button"
                  onClick={() => setStructureTab('plink')}
                  className={`px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer ${
                    structureTab === 'plink'
                      ? 'bg-[#5B4DFE] text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  3. Format PLINK Biner (.bed/.bim/.fam)
                </button>
              </div>
              <button
                type="button"
                disabled={isDownloadingZip}
                onClick={() => handleDownloadBenchmarkZip('all')}
                className="rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Unduh semua berkas benchmark dalam satu berkas .zip"
              >
                {isDownloadingZip ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>Unduh Paket Lengkap (.ZIP)</span>
              </button>
            </div>

            {structureTab === 'vcf' ? (
              <div className="space-y-3 text-xs">
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  Berkas VCF (Variant Call Format) wajib memuat kolom standar dan kode genotipe bialelik (<code>0/0</code> homozigot referensi, <code>0/1</code> heterozigot, <code>1/1</code> homozigot alternatif).
                </p>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070C1D] p-3 font-mono text-[11px] text-slate-800 dark:text-slate-200 leading-relaxed max-h-48">
                  <div className="text-slate-400">##fileformat=VCFv4.2</div>
                  <div className="text-slate-400">##FORMAT=&lt;ID=GT,Number=1,Type=String,Description="Genotype"&gt;</div>
                  <div className="font-bold text-cyan-600 dark:text-cyan-400">#CHROM POS ID REF ALT QUAL FILTER INFO FORMAT sample_01 sample_02 ...</div>
                  <div>chr1 124050 snp_chr1_0001 A G 99 PASS . GT 0/0 0/1 1/1</div>
                  <div>chr1 285620 snp_chr1_0002 C T 99 PASS . GT 0/1 0/0 0/0</div>
                  <div>chr2 145890 snp_chr2_0001 G A 99 PASS . GT 1/1 0/1 0/0</div>
                  <div>chr3 21745450 snp_chr3_0042 T C 99 PASS . GT 0/1 1/1 0/1</div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-500">Maks. ukuran berkas: 50 MB (.vcf / .vcf.gz)</span>
                  <button
                    type="button"
                    onClick={() => handleDownloadSampleFile('vcf')}
                    className="figma-btn-primary py-2 px-3.5 text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Unduh Contoh VCF (garlic.vcf)</span>
                  </button>
                </div>
              </div>
            ) : structureTab === 'csv' ? (
              <div className="space-y-3 text-xs">
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  Berkas CSV fenotipe wajib memiliki kolom identitas sampel (<code>sample_id</code>) yang 100% cocok dengan nama sampel di berkas VCF, diikuti 1 atau lebih kolom sifat kuantitatif.
                </p>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070C1D] p-3 font-mono text-[11px] text-slate-800 dark:text-slate-200 leading-relaxed max-h-48">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">sample_id,bobot_umbi_g,diameter_umbi_mm,jumlah_siung</div>
                  <div>sample_01,42.5,38.2,11</div>
                  <div>sample_02,39.1,35.0,9</div>
                  <div>sample_03,45.8,40.1,12</div>
                  <div>sample_04,36.4,33.5,8</div>
                  <div>sample_05,48.2,42.0,13</div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-500">Maks. ukuran berkas: 10 MB (.csv UTF-8)</span>
                  <button
                    type="button"
                    onClick={() => handleDownloadSampleFile('csv')}
                    className="figma-btn-primary py-2 px-3.5 text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Unduh Contoh CSV (phenotype.csv)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  Format PLINK biner membutuhkan triplet berkas yang lengkap: <code>.bed</code> (data genotipe biner), <code>.bim</code> (peta posisi SNP), dan <code>.fam</code> (daftar silsilah/ID sampel).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070C1D]">
                    <div className="font-bold text-cyan-600 dark:text-cyan-400 mb-1">Struktur .fam (Sample ID di kol 2)</div>
                    <div className="text-slate-600 dark:text-slate-300 space-y-0.5">
                      <div>sample_01 sample_01 0 0 0 -9</div>
                      <div>sample_02 sample_02 0 0 0 -9</div>
                      <div>sample_03 sample_03 0 0 0 -9</div>
                      <div>sample_04 sample_04 0 0 0 -9</div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070C1D]">
                    <div className="font-bold text-cyan-600 dark:text-cyan-400 mb-1">Struktur .bim (Chr Pos A1 A2)</div>
                    <div className="text-slate-600 dark:text-slate-300 space-y-0.5">
                      <div>chr1 snp_0001 0 124050 G A</div>
                      <div>chr1 snp_0002 0 285620 T C</div>
                      <div>chr2 snp_0003 0 145890 A G</div>
                      <div>chr3 snp_0042 0 217454 T C</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-500">Mendukung genom Allium sativum (chr1-chr8)</span>
                  <button
                    type="button"
                    disabled={isDownloadingZip}
                    onClick={() => handleDownloadBenchmarkZip('plink')}
                    className="figma-btn-primary py-2 px-3.5 text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Unduh Paket PLINK (.ZIP)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
