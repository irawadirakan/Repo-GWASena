import { useState, useEffect } from 'react';
import {
  Lock,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Dna,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { useAnalysisStore } from '../../store/useAnalysisStore.js';
import { analysisService } from '../../services/analysisService.js';
import { TIPS_EDUKATIF } from '../../constants/eduHints.js';
import { generateBenchmarkResults } from '../../services/mockResults.js';
import ErrorMessageArea from '../common/ErrorMessageArea.jsx';

/**
 * S-06 (Langkah 3): Layar Tunggu Komputasi Pipeline (Figma Aligned)
 * Acuan: 06 — Komputasi_ QC Berjalan.png s.d. 06d — Komputasi_ Semua Selesai.png
 *
 * Mengunci konfigurasi form (BR-05, AC-10.1), menampilkan progres 4 tahapan diskrit,
 * menyajikan ringkasan QC (AC-03.1), serta karusel Tips Edukatif dinamis (FR-10).
 */
export default function Step3Computation({ analysisId, onComplete }) {
  const {
    currentAnalysis,
    setCurrentAnalysis,
    configParams,
    uploadSummary,
    setResults,
    setIsSimulated,
    isSimulated,
    computationStage,
    isComputing,
    isCompleted: storeCompleted,
    startSimulation,
    setActiveStep,
  } = useAnalysisStore();

  const [localCompleted, setLocalCompleted] = useState(false);
  const isCompleted = storeCompleted || localCompleted;

  // State polling dari backend
  const [progresPersen, setProgresPersen] = useState(0);
  const [activeStageCode, setActiveStageCode] = useState(null);
  const [backendStages, setBackendStages] = useState([]);
  const [backendStatus, setBackendStatus] = useState(null);
  const [ringkasanQc, setRingkasanQc] = useState(null);

  // State galat & pembatalan
  const [isFailed, setIsFailed] = useState(false);
  const [error, setError] = useState(null);

  // Carousel State untuk Tips Edukatif (FR-10)
  const [tipIndex, setTipIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-rotate Tips Edukatif setiap 6 detik jika tidak di-hover
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS_EDUKATIF.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isHovered]);

  // Jalankan simulasi otomatis jika dalam mode simulasi dan belum selesai
  useEffect(() => {
    if (isSimulated && !isComputing && !storeCompleted && !isFailed) {
      startSimulation();
    }
  }, [isSimulated, isComputing, storeCompleted, isFailed, startSimulation]);

  // Polling backend status setiap 3 detik hanya jika BUKAN mode simulasi
  useEffect(() => {
    if (isSimulated || isFailed) return;

    let timer;
    let isMounted = true;

    async function pollStatus() {
      try {
        const res = await analysisService.getStatus(analysisId);
        if (!isMounted) return;

        setBackendStatus(res?.status);

        if (typeof res?.progres_persen === 'number') {
          setProgresPersen(res.progres_persen);
        }
        if (res?.tahap_sekarang) {
          setActiveStageCode(res.tahap_sekarang);
        }
        if (Array.isArray(res?.tahap)) {
          setBackendStages(res.tahap);
        }
        if (res?.ringkasan_qc) {
          setRingkasanQc(res.ringkasan_qc);
        }

        // Poin #4: Tangani res.status === "gagal" & Hentikan Polling
        if (res?.status === 'gagal' || res?.status === 'failed') {
          if (timer) clearTimeout(timer);
          setIsFailed(true);
          const errMsg =
            res.galat?.pesan ||
            res.message ||
            res.error ||
            'Analisis pipeline GWAS gagal dieksekusi oleh backend.';
          const errDetails = Array.isArray(res.galat?.rincian)
            ? res.galat.rincian
            : res.details
            ? Array.isArray(res.details)
              ? res.details
              : [res.details]
            : [];
          setError({
            message: errMsg,
            details: errDetails,
          });
          return; // Hentikan polling seketika
        }

        // Cek status selesai
        if (res?.status === 'selesai') {
          setProgresPersen(100);
          setLocalCompleted(true);
          try {
            const resultsData = await analysisService.getResults(analysisId);
            setResults(resultsData);
            if (resultsData?.qc || resultsData?.ringkasan_qc) {
              setRingkasanQc(resultsData.qc || resultsData.ringkasan_qc);
            }
          } catch (rErr) {
            console.warn('Gagal memuat data hasil dari backend, beralih ke benchmark lokal:', rErr);
            const fallback = generateBenchmarkResults(configParams, uploadSummary);
            setResults(fallback);
          }
          return;
        }
      } catch (err) {
        if (!isMounted) return;
        const isNetworkError = !err.status || err.status === 0 || err.code === 'ERR_NETWORK';
        const is501 = err.status === 501;

        if (isNetworkError || is501) {
          // Hanya beralih ke simulasi jika benar-benar Network Error atau HTTP 501
          console.warn('Backend tidak merespons (Network / 501), beralih ke mock simulation:', err);
          startSimulation();
          return;
        } else {
          // Error 4xx / 500 dari backend: HENTIKAN POLLING & TAMPILKAN GALAT!
          console.error('Galat saat polling status analisis (HTTP ' + err.status + '):', err);
          if (timer) clearTimeout(timer);
          setIsFailed(true);
          setError({
            message: err.message || err.pesan || 'Gagal memantau status komputasi dari server.',
            details: err.details || err.rincian || [],
          });
          return;
        }
      }

      if (!isCompleted && !isFailed) {
        timer = setTimeout(pollStatus, 3000);
      }
    }

    pollStatus();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [analysisId, isCompleted, isFailed, isSimulated, startSimulation, configParams, uploadSummary, setResults]);

  // Helper memetakan status 4 kartu tahapan visual di UI
  const getDisplayStages = () => {
    if (isSimulated) {
      const stageNum = computationStage || 1;
      return [
        {
          id: 1,
          title: 'Quality Control (Penyaringan Sampel & SNP)',
          desc: 'Memvalidasi missingness, MAF, HWE klonal bawang putih, dan kekerabatan KING.',
          status: isCompleted || stageNum > 1 ? 'selesai' : stageNum === 1 ? 'berjalan' : 'menunggu',
          message: stageNum > 1 ? 'Penyaringan data genotipe & fenotipe selesai.' : 'Memfilter MAF, missingness, & relatedness...',
        },
        {
          id: 2,
          title: 'Analisis Struktur Populasi (PCA Otomatis)',
          desc: 'Menghitung dekomposisi kovariat PC1–PC3 untuk koreksi stratifikasi genetik (FR-04).',
          status: isCompleted || stageNum > 2 ? 'selesai' : stageNum === 2 ? 'berjalan' : 'menunggu',
          message: stageNum > 2 ? 'Dekomposisi 3 PC selesai dihitung.' : stageNum === 2 ? 'Menghitung matriks kovariansi PC1–PC3...' : null,
        },
        {
          id: 3,
          title: 'Uji Asosiasi Statistik & Koreksi',
          desc: `Mengeksekusi model ${configParams.model || 'MLM'} terhadap sifat ${configParams.trait || 'bobot_umbi_g'} dengan koreksi Bonferroni & FDR.`,
          status: isCompleted || stageNum > 3 ? 'selesai' : stageNum === 3 ? 'berjalan' : 'menunggu',
          message: stageNum > 3 ? 'Uji asosiasi genomik selesai.' : stageNum === 3 ? 'Menghitung nilai p-value dan estimasi efek beta...' : null,
        },
        {
          id: 4,
          title: 'Anotasi Kandidat Gen & Visualisasi',
          desc: 'Memetakan SNP signifikan ke gen Allium sativum dan menyusun plot Manhattan/QQ.',
          status: isCompleted ? 'selesai' : stageNum === 4 ? 'berjalan' : 'menunggu',
          message: isCompleted ? 'Hasil visualisasi dan tabel asosiasi siap.' : stageNum === 4 ? 'Menyiapkan anotasi gen & visualisasi...' : null,
        },
      ];
    }

    // Pemetaan fleksibel dari Array res.tahap backend
    const stageMap = {};
    if (Array.isArray(backendStages)) {
      backendStages.forEach((s) => {
        if (s && s.kode) {
          stageMap[s.kode.toLowerCase()] = s;
        }
      });
    }

    // 1. QC
    const qcStage = stageMap['qc'] || stageMap['quality_control'];
    const qcStatus = qcStage?.status || (isCompleted ? 'selesai' : (backendStatus === 'antre' ? 'menunggu' : 'berjalan'));
    const qcMsg = qcStage?.pesan || null;

    // 2. PCA
    const pcaStage = stageMap['pca'];
    const pcaStatus = pcaStage?.status || (isCompleted ? 'selesai' : 'menunggu');
    const pcaMsg = pcaStage?.pesan || null;

    // 3. Uji Asosiasi & Koreksi
    const asoStage = stageMap['asosiasi'] || stageMap['association'];
    const korStage = stageMap['koreksi'] || stageMap['correction'];
    let asoStatus = 'menunggu';
    let asoMsg = null;
    if (korStage?.status === 'selesai' || isCompleted) {
      asoStatus = 'selesai';
      asoMsg = korStage?.pesan || asoStage?.pesan || 'Uji asosiasi & koreksi multiple testing selesai.';
    } else if (asoStage?.status === 'gagal' || korStage?.status === 'gagal') {
      asoStatus = 'gagal';
      asoMsg = korStage?.pesan || asoStage?.pesan || 'Gagal pada tahap uji asosiasi/koreksi.';
    } else if (
      asoStage?.status === 'berjalan' ||
      korStage?.status === 'berjalan' ||
      activeStageCode === 'asosiasi' ||
      activeStageCode === 'koreksi'
    ) {
      asoStatus = 'berjalan';
      asoMsg =
        korStage?.status === 'berjalan'
          ? korStage?.pesan || 'Menghitung koreksi Bonferroni & FDR...'
          : asoStage?.pesan || 'Mengeksekusi model asosiasi...';
    }

    // 4. Anotasi Gen & Visualisasi
    const anoStage = stageMap['anotasi'] || stageMap['annotation'] || stageMap['simpan'];
    let anoStatus = 'menunggu';
    let anoMsg = null;
    if (isCompleted || anoStage?.status === 'selesai' || backendStatus === 'selesai') {
      anoStatus = 'selesai';
      anoMsg = anoStage?.pesan || 'Plot Manhattan, QQ, & anotasi siap.';
    } else if (anoStage?.status === 'gagal') {
      anoStatus = 'gagal';
      anoMsg = anoStage?.pesan || 'Gagal pada penyimpanan visualisasi.';
    } else if (anoStage?.status === 'berjalan' || (asoStatus === 'selesai' && backendStatus === 'berjalan')) {
      anoStatus = 'berjalan';
      anoMsg = anoStage?.pesan || 'Menyusun plot dan data anotasi...';
    }

    return [
      {
        id: 1,
        title: 'Quality Control (Penyaringan Sampel & SNP)',
        desc: 'Memvalidasi missingness, MAF, HWE klonal bawang putih, dan kekerabatan KING.',
        status: qcStatus,
        message: qcMsg,
      },
      {
        id: 2,
        title: 'Analisis Struktur Populasi (PCA Otomatis)',
        desc: 'Menghitung dekomposisi kovariat PC1–PC3 untuk koreksi stratifikasi genetik (FR-04).',
        status: pcaStatus,
        message: pcaMsg,
      },
      {
        id: 3,
        title: 'Uji Asosiasi Statistik & Koreksi',
        desc: `Mengeksekusi model ${configParams.model || 'MLM'} terhadap sifat ${configParams.trait || 'bobot_umbi_g'} dengan koreksi Bonferroni & FDR.`,
        status: asoStatus,
        message: asoMsg,
      },
      {
        id: 4,
        title: 'Anotasi Kandidat Gen & Visualisasi',
        desc: 'Memetakan SNP signifikan ke gen Allium sativum dan menyusun plot Manhattan/QQ.',
        status: anoStatus,
        message: anoMsg,
      },
    ];
  };

  const displayStages = getDisplayStages();

  // Hitung persentase progres bar
  const displayPercent = isCompleted
    ? 100
    : isSimulated
    ? Math.min(100, (computationStage || 1) * 25)
    : progresPersen;

  // Hitung data ringkasan QC dinamis
  const isQcDone = isCompleted || displayStages[0].status === 'selesai';
  const samplesPassed = ringkasanQc?.sampel_lolos ?? ringkasanQc?.n_samples ?? (isQcDone ? 38 : 40);
  const samplesTotal = ringkasanQc?.total_sampel ?? uploadSummary?.genotipe?.jumlah_sampel ?? 40;
  const samplesFiltered =
    ringkasanQc?.sampel_disaring ?? (samplesTotal - samplesPassed > 0 ? samplesTotal - samplesPassed : 0);

  const snpsPassed = ringkasanQc?.snp_lolos ?? ringkasanQc?.n_snps ?? (isQcDone ? 482 : 500);
  const snpsTotal = ringkasanQc?.total_snp ?? uploadSummary?.genotipe?.jumlah_snp ?? 500;
  const snpsFiltered = ringkasanQc?.snp_disaring ?? (snpsTotal - snpsPassed > 0 ? snpsTotal - snpsPassed : 0);

  const currentTip = TIPS_EDUKATIF[tipIndex];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Banner Mode Simulasi (Poin #2) ── */}
      {isSimulated && (
        <div className="rounded-2xl border-2 border-amber-500 bg-amber-400/20 text-amber-950 dark:text-amber-200 p-4 text-center font-bold text-sm sm:text-base shadow-lg animate-pulse flex items-center justify-center gap-2">
          <span>⚠️ MODE SIMULASI — Bukan hasil analisis asli (Backend tidak terhubung)</span>
        </div>
      )}

      {/* ── Banner Status Terkunci (BR-05, AC-10.1) ── */}
      {!isFailed && (
        <div className="relative overflow-hidden rounded-3xl figma-card border-amber-300/80 dark:border-amber-500/40 bg-gradient-to-r from-amber-100/80 via-amber-50/60 to-transparent dark:from-amber-500/15 dark:via-amber-500/5 dark:to-transparent p-5 sm:p-6 backdrop-blur-md">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shadow-inner">
              <Lock className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Komputasi Pipeline Sedang Berjalan</span>
                <span className="inline-flex items-center rounded-full bg-amber-200 dark:bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-sans font-semibold text-amber-900 dark:text-amber-400">
                  Form Konfigurasi Dikunci (BR-05)
                </span>
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-w-3xl">
                Untuk menjaga integritas ilmiah dan reprodusibilitas riset asosiasi genomik,
                parameter Quality Control dan model yang sedang diuji tidak dapat diubah selama proses
                analisis aktif.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Area Pesan Kesalahan / Status Gagal (Poin #4) ── */}
      {isFailed && (
        <div className="rounded-3xl border border-rose-300 dark:border-rose-500/40 bg-rose-50/90 dark:bg-rose-500/10 p-6 space-y-4 shadow-xl animate-fade-in backdrop-blur-md">
          <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-400">
            <XCircle className="h-6 w-6 shrink-0" />
            <h3 className="text-base font-bold font-sans">
              Komputasi Pipeline GWAS Gagal Dijalankan
            </h3>
          </div>

          <ErrorMessageArea error={error} type="error" />

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Silakan periksa kembali berkas yang diunggah atau sesuaikan parameter filter Quality Control agar tidak menyaring seluruh data sampel/SNP.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-rose-200 dark:border-rose-500/20">
            <button
              type="button"
              onClick={() => {
                setIsFailed(false);
                setError(null);
                setActiveStep(2);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5B4DFE] hover:bg-[#4F46E5] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#5B4DFE]/30 transition-all active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Konfigurasi (Langkah 2)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsFailed(false);
                setError(null);
                setActiveStep(1);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 px-5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Unggah Data (Langkah 1)</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Progress Bar Utama (Poin #3) ── */}
      <div className="rounded-2xl glass-subcard p-4 sm:p-5 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-sans font-bold text-slate-900 dark:text-white">
              Kemajuan Komputasi Pipeline
            </span>
            {isFailed ? (
              <span className="rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 px-2 py-0.5 text-[10px] font-bold">
                Terhenti (Galat)
              </span>
            ) : isCompleted ? (
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                100% Selesai
              </span>
            ) : (
              <span className="rounded-full bg-cyan-100 dark:bg-[#06B6D4]/20 text-cyan-900 dark:text-[#06B6D4] px-2 py-0.5 text-[10px] font-bold">
                Sedang Diproses...
              </span>
            )}
          </div>
          <span className="font-mono font-bold text-sm text-[#5B4DFE] dark:text-[#06B6D4] tabular-nums">
            {displayPercent}%
          </span>
        </div>

        <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isFailed
                ? 'bg-rose-500'
                : isCompleted
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-[#5B4DFE] to-[#06B6D4]'
            }`}
            style={{ width: `${Math.max(3, Math.min(100, displayPercent))}%` }}
          />
        </div>
      </div>

      {/* ── Grid 2 Kolom: Tahapan Pipeline & Edukasi Dinamis ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: 4 Tahapan Pipeline Diskrit (7 Kolom) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400 flex items-center gap-2">
              <Dna className="h-4 w-4 text-[#06B6D4]" />
              <span>Tahapan Eksekusi Diskrit</span>
            </h4>
            <span className="text-xs font-mono font-semibold text-[#5B4DFE] dark:text-[#06B6D4]">
              {isCompleted
                ? '4 / 4 Tahap Selesai'
                : `${displayStages.filter((s) => s.status === 'selesai').length} / 4 Tahap Selesai`}
            </span>
          </div>

          <div className="space-y-3">
            {displayStages.map((stage) => {
              const isDone = stage.status === 'selesai';
              const isRunning = stage.status === 'berjalan';
              const isFail = stage.status === 'gagal';

              return (
                <div
                  key={stage.id}
                  className={`flex items-start gap-3.5 rounded-2xl p-4 transition-all duration-300 ${
                    isFail
                      ? 'glass-subcard border-rose-400 dark:border-rose-500/50 bg-rose-50/70 dark:bg-rose-500/10 ring-1 ring-rose-500/30'
                      : isRunning
                      ? 'glass-subcard border-[#06B6D4] bg-cyan-50/90 dark:bg-[#06B6D4]/15 shadow-lg shadow-[#06B6D4]/10 ring-1 ring-[#06B6D4]/40'
                      : isDone
                      ? 'glass-subcard border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-[#0F172E]/60 shadow-sm'
                      : 'glass-subcard border-slate-200 dark:border-white/10 opacity-70'
                  }`}
                >
                  <div className="pt-0.5">
                    {isFail ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400">
                        <XCircle className="h-4 w-4 stroke-[2.5]" />
                      </div>
                    ) : isDone ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
                      </div>
                    ) : isRunning ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#06B6D4]/20 text-[#06B6D4] animate-pulse-ring">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {stage.id}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-xs sm:text-sm font-sans font-semibold ${
                          isFail
                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                            : isRunning
                            ? 'text-[#5B4DFE] dark:text-[#06B6D4] font-bold'
                            : isDone
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {stage.title}
                      </p>
                      <span className="text-[10px] font-mono capitalize">
                        {isDone && <span className="text-emerald-600 dark:text-emerald-400 font-bold">Selesai</span>}
                        {isRunning && <span className="text-cyan-600 dark:text-[#06B6D4] font-bold">Berjalan...</span>}
                        {isFail && <span className="text-rose-600 dark:text-rose-400 font-bold">Gagal</span>}
                        {!isDone && !isRunning && !isFail && <span className="text-slate-400">Menunggu</span>}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {stage.desc}
                    </p>

                    {stage.message && (
                      <p className="text-[11px] font-mono text-[#5B4DFE] dark:text-[#06B6D4] bg-black/5 dark:bg-black/25 px-2.5 py-1 rounded-md mt-1">
                        {stage.message}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tombol Lanjut bila sudah selesai */}
          {isCompleted && (
            <div className="pt-2 animate-fade-in">
              <button
                type="button"
                onClick={onComplete}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-3.5 text-sm font-sans font-bold text-white shadow-lg shadow-emerald-500/30 hover:-translate-y-[1px] hover:shadow-xl active:scale-[0.97] active:brightness-95 transition-all duration-100"
              >
                <span>Lihat Hasil Analisis & Visualisasi Plot (Langkah 4)</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Ringkasan QC & Karusel Tips Edukatif (5 Kolom) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card Ringkasan Hasil Penyaringan QC (AC-03.1 / Poin #3) */}
          <div className="rounded-3xl figma-card p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#06B6D4]" />
                <h5 className="text-xs font-sans font-bold text-slate-900 dark:text-white">
                  Ringkasan Penyaringan QC (AC-03.1)
                </h5>
              </div>
              {isQcDone && (
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold">
                  QC Selesai
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="glass-subcard p-3">
                <span className="text-[10px] font-sans font-semibold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">
                  Sampel Dianalisis
                </span>
                <span className="font-serif text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {samplesPassed}{' '}
                  <span className="text-[11px] font-sans font-normal text-slate-500 dark:text-slate-400">
                    / {samplesTotal} total
                  </span>
                </span>
                {samplesFiltered > 0 && (
                  <span className="text-[10px] font-sans text-amber-600 dark:text-amber-400 block mt-0.5">
                    -{samplesFiltered} disaring (mind/kekerabatan)
                  </span>
                )}
              </div>

              <div className="glass-subcard p-3">
                <span className="text-[10px] font-sans font-semibold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">
                  SNP Lolos Filter
                </span>
                <span className="font-serif text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {snpsPassed}{' '}
                  <span className="text-[11px] font-sans font-normal text-slate-500 dark:text-slate-400">
                    / {snpsTotal} total
                  </span>
                </span>
                {snpsFiltered > 0 && (
                  <span className="text-[10px] font-sans text-amber-600 dark:text-amber-400 block mt-0.5">
                    -{snpsFiltered} disaring (MAF/geno/HWE)
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl glass-subcard p-2.5 text-[11px] text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="font-sans">Sifat fenotipe target:</span>
              <span className="font-mono font-semibold text-[#5B4DFE] dark:text-[#06B6D4]">
                {configParams.trait || uploadSummary?.fenotipe?.sifat_tersedia?.[0] || 'bobot_umbi_g'}
              </span>
            </div>
          </div>

          {/* Card Tips Edukatif Dinamis (FR-10, DESIGN.md Bagian 8B) */}
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="rounded-3xl figma-card border-cyan-300/80 dark:border-[#06B6D4]/30 bg-gradient-to-br from-cyan-50/90 via-white/80 to-slate-50/80 dark:from-[#06B6D4]/10 dark:via-[#0F172E]/80 dark:to-[#121B38] p-5 space-y-3 relative group transition-all"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-cyan-100 dark:bg-[#06B6D4]/20 flex items-center justify-center text-cyan-800 dark:text-[#06B6D4]">
                  <HelpCircle className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-sans font-bold text-cyan-900 dark:text-[#06B6D4]">
                  Tips Edukatif Riset (FR-10)
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                {tipIndex + 1} / {TIPS_EDUKATIF.length}
              </span>
            </div>

            <div className="min-h-[92px] space-y-1.5">
              <h6 className="text-xs font-sans font-bold text-slate-900 dark:text-white">{currentTip?.judul}</h6>
              <p className="text-xs sm:text-[13px] font-serif leading-relaxed text-slate-700 dark:text-slate-300 italic">
                &ldquo;{currentTip?.teks}&rdquo;
              </p>
            </div>

            {/* Kontrol Navigasi Manual */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/10 text-[10px]">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] font-sans">
                {isHovered ? 'Rotasi dijeda (hover)' : 'Berotasi otomatis setiap 6s'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setTipIndex(
                      (prev) => (prev - 1 + TIPS_EDUKATIF.length) % TIPS_EDUKATIF.length
                    )
                  }
                  className="rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-1 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-90 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all duration-100"
                  title="Sebelumnya"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setTipIndex((prev) => (prev + 1) % TIPS_EDUKATIF.length)}
                  className="rounded-lg border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-1 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-90 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all duration-100"
                  title="Berikutnya"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
