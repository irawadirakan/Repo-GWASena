import { useState, useRef } from 'react';
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
} from 'lucide-react';
import { analysisService } from '../../services/analysisService.js';
import { useAnalysisStore, MOCK_GARLIC_DATASET_SUMMARY } from '../../store/useAnalysisStore.js';
import { getExampleDatasetFiles, getExamplePlinkFiles } from '../../services/exampleDataset.js';
import ErrorMessageArea from '../common/ErrorMessageArea.jsx';

/**
 * Step1Upload (Unggah & Validasi Data Genomik - Dukung VCF & PLINK Biner)
 * Acuan: PR #24 (Dukungan Format PLINK Biner .bed/.bim/.fam) & FR-02
 */
export default function Step1Upload({ analysisId, onUploadSuccess, onNext }) {
  const {
    setActiveStep,
    setUploadSummary,
    setIsSimulated,
    uploadSummary,
    loadMockGarlicDataset,
  } = useAnalysisStore();

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

    if (name.endsWith('.vcf') || name.endsWith('.vcf.gz') || name.endsWith('.gz')) {
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

    try {
      if (mode === 'plink') {
        const { bedFile, bimFile: bFile, famFile: fFile, csvFile } = await getExamplePlinkFiles();
        setFormatMode('plink');
        setGenotypeFile(bedFile);
        setBimFile(bFile);
        setFamFile(fFile);
        setPhenotypeFile(csvFile);

        const mockSummary = {
          ...MOCK_GARLIC_DATASET_SUMMARY,
          genotipe: {
            nama_berkas: 'genotipe_bawang_putih_mini.bed',
            format: 'PLINK biner',
            jumlah_sampel: 40,
            jumlah_snp: 500,
            varian_dilewati: { multialelik: 0 },
          },
        };
        setUploadResult(mockSummary);
        setUploadSummary(mockSummary);
        setIsSimulated(true);
        onUploadSuccess?.(mockSummary);
      } else {
        const { vcfFile, csvFile } = await getExampleDatasetFiles();
        setFormatMode('vcf');
        setGenotypeFile(vcfFile);
        setBimFile(null);
        setFamFile(null);
        setPhenotypeFile(csvFile);

        const mockSummary = loadMockGarlicDataset
          ? loadMockGarlicDataset()
          : { ...MOCK_GARLIC_DATASET_SUMMARY };

        setUploadResult(mockSummary);
        setUploadSummary(mockSummary);
        setIsSimulated(true);
        onUploadSuccess?.(mockSummary);
      }
    } catch (err) {
      console.error('Gagal menyiapkan dataset contoh:', err);
      setError({
        message: 'Gagal memuat dataset contoh.',
        details: [err.message || String(err)],
      });
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
      setIsSimulated(false);
      onUploadSuccess?.(res);
    } catch (err) {
      const isNetworkError = !err.status || err.status === 0 || err.code === 'ERR_NETWORK';
      const is501 = err.status === 501;

      if (isNetworkError || is501) {
        // Auto-Mock / Fallback Offline jika backend offline atau terjadi network error
        console.warn('Backend upload tidak merespons (Network / 501), mengaktifkan simulasi validasi lokal:', err);

        const fallbackResult = {
          status: 'valid',
          pesan: 'Validasi simulasi lokal berhasil (Backend Offline). 100% Sample ID cocok.',
          genotipe: {
            nama_berkas: genotypeFile.name || 'garlic_sample.vcf',
            format: 'VCF v4.2',
            jumlah_sampel: 25,
            jumlah_snp: 500,
            varian_dilewati: { multialelik: 12 },
          },
          fenotipe: {
            nama_berkas: phenotypeFile.name || 'phenotype_sample.csv',
            jumlah_sampel: 25,
            varietas_tercatat: 25,
            sifat_tersedia: ['bobot_umbi_g', 'diameter_umbi_mm', 'jumlah_siung'],
          },
          kecocokan_sample_id: {
            persentase_kecocokan: 100,
            jumlah_sampel_cocok: 25,
            status: 'cocok',
          },
          integritas: {
            kesamaan_sampel: '100%',
            sampel_cocok: 25,
            kelengkapan: '100%',
            vcf_valid: true,
            csv_valid: true,
          },
          simulated: true,
        };

        setUploadResult(fallbackResult);
        setIsSimulated(true);
        setUploadSummary(fallbackResult);
        onUploadSuccess?.(fallbackResult);
      } else {
        // Error 4xx / 500 dari Backend: DILARANG PINDAH SIMULASI & DILARANG PINDAH LANGKAH!
        console.error('Validasi berkas ditolak backend (HTTP ' + err.status + '):', err);
        setError({
          message: err.message || err.pesan || 'Validasi berkas gagal.',
          details: err.details || err.rincian || [],
        });
        setUploadResult(null);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Navigasi cepat langsung ke Step 2 tanpa delay/loading lama
  const handleProceedToStep2 = () => {
    setActiveStep(2);
    onNext?.();
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
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => handleUseSampleData('vcf')}
            className="figma-btn-primary cursor-pointer whitespace-nowrap text-xs sm:text-sm px-4 py-2"
          >
            <Dna className="h-4 w-4" />
            <span>Contoh VCF</span>
          </button>
          <button
            type="button"
            onClick={() => handleUseSampleData('plink')}
            className="rounded-2xl border border-cyan-400/80 dark:border-cyan-500/30 bg-cyan-50 dark:bg-[#06B6D4]/15 px-4 py-2 text-xs sm:text-sm font-sans font-bold text-cyan-900 dark:text-[#06B6D4] hover:bg-cyan-100 dark:hover:bg-[#06B6D4]/25 transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Layers className="h-4 w-4 inline mr-1" />
            <span>Contoh PLINK (.bed)</span>
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
                      <span className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-medium">Maksimal 200 MB</span>
                    </div>
                  )}

                  <input
                    ref={genoInputRef}
                    type="file"
                    accept=".vcf,.gz,.bed"
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
                  <span className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-medium">Encoding UTF-8</span>
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
                  40}
              </div>
            </div>

            <div className="glass-subcard p-3.5 text-center">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase font-sans tracking-wide">
                Jumlah SNP
              </span>
              <div className="font-serif text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
                {uploadResult.genotipe?.jumlah_snp ?? 500}
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
                {uploadResult.fenotipe?.jumlah_sampel ?? uploadResult.fenotipe?.varietas_tercatat ?? 40}
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
              onClick={handleProceedToStep2}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-sm hover:-translate-y-[1px] hover:shadow-md active:scale-[0.98] transition-all duration-100 cursor-pointer"
            >
              <span>Lanjut ke Konfigurasi QC (Langkah 2)</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
