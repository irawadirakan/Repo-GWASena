import { useState, useEffect, useRef } from 'react';

function formatProgressPercent(val) {
  const num = Number(val) || 0;
  const rounded = Math.round(num * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
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
} from 'lucide-react';
import { useAnalysisStore } from '../../store/useAnalysisStore.js';
import { analysisService } from '../../services/analysisService.js';
import { TIPS_EDUKATIF } from '../../constants/eduHints.js';
import { resolveTargetTraitName } from '../../constants/defaultParams.js';
import ErrorMessageArea from '../common/ErrorMessageArea.jsx';

/**
 * Step3Computation (Langkah 3): Layar Tunggu Komputasi Pipeline (Figma Aligned)
 * Acuan: 06 — Komputasi_ QC Berjalan.png s.d. 06d — Komputasi_ Semua Selesai.png
 *
 * Mengunci konfigurasi form, menampilkan progres 4 tahapan diskrit,
 * menyajikan ringkasan QC, serta karusel Tips Edukatif dinamis.
 */
export default function Step3Computation({ analysisId, analysis = null, onComplete }) {
  const {
    currentAnalysis,
    configParams,
    uploadSummary,
    results,
    setResults,
    isCompleted: storeCompleted,
    setActiveStep,
    globalProgress,
    stageProgress,
    ensureProgressAnalysis,
    setGlobalProgress,
    setStageProgress,
  } = useAnalysisStore();

  const [localCompleted, setLocalCompleted] = useState(false);
  const isCompleted = storeCompleted || localCompleted;

  // State polling dari backend
  const [activeStageCode, setActiveStageCode] = useState(null);
  const [backendStages, setBackendStages] = useState([]);
  const [backendStatus, setBackendStatus] = useState(null);
  const [pesanStatus, setPesanStatus] = useState(null);
  const [durasiDetik, setDurasiDetik] = useState(null);
  const [ringkasanQc, setRingkasanQc] = useState(null);
  const [statusTrait, setStatusTrait] = useState(null);

  // State galat & pembatalan
  const [isFailed, setIsFailed] = useState(false);
  const [error, setError] = useState(null);

  const latestStagesRef = useRef([]);

  // Pastikan high-water mark progres tersinkron dengan analysisId aktif (tidak regress saat remount)
  useEffect(() => {
    if (analysisId) {
      ensureProgressAnalysis(analysisId);
    }
  }, [analysisId, ensureProgressAnalysis]);

  // Interpolasi progres asimptotik monotonik (+0.2% setiap 2 detik, mentok <= 92% & di bawah batas tahap berikutnya)
  useEffect(() => {
    if (isCompleted || isFailed) return;
    const interval = setInterval(() => {
      const stages = latestStagesRef.current || [];
      const storeState = useAnalysisStore.getState();
      const stagePctMap = storeState.stageProgress || {};

      let doneCount = 0;
      let hasRunning = false;
      for (const s of stages) {
        const curStagePct = Number(stagePctMap[s.id]) || 0;
        if (s.status === 'selesai' || curStagePct >= 100) {
          doneCount += 1;
        } else if (s.status === 'berjalan') {
          hasRunning = true;
          const nextStagePct = Math.min(92, Math.round((Math.max(45, curStagePct) + 0.2) * 10) / 10);
          setStageProgress(s.id, nextStagePct, 92);
        }
      }

      if (hasRunning) {
        const nextMilestone = (doneCount + 1) * 25;
        const globalCeiling = Math.min(92, Math.max(0, nextMilestone - 0.8));
        const curGlobal = Number(storeState.globalProgress) || 0;
        if (curGlobal < globalCeiling) {
          const nextGlobal = Math.min(globalCeiling, Math.round((curGlobal + 0.2) * 10) / 10);
          setGlobalProgress(nextGlobal, globalCeiling);
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isCompleted, isFailed, setGlobalProgress, setStageProgress]);

  // Carousel & Countdown State untuk Tips Edukatif (6 detik)
  const [tipIndex, setTipIndex] = useState(0);
  const [countdown, setCountdown] = useState(6);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-rotate Tips Edukatif setiap 6 detik dengan hitung mundur 1 detik jika tidak di-hover
  useEffect(() => {
    if (isHovered) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setTipIndex((idx) => (idx + 1) % TIPS_EDUKATIF.length);
          return 6;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isHovered]);

  // Handler navigasi manual: putar tips & setel ulang countdown ke 6s penuh
  const handlePrevTip = () => {
    setTipIndex((prev) => (prev - 1 + TIPS_EDUKATIF.length) % TIPS_EDUKATIF.length);
    setCountdown(6);
  };

  const handleNextTip = () => {
    setTipIndex((prev) => (prev + 1) % TIPS_EDUKATIF.length);
    setCountdown(6);
  };

  // Polling backend status setiap 3 detik (100% alur API nyata tanpa fallback simulasi)
  useEffect(() => {
    if (!analysisId || isFailed) return;

    let timer;
    let isMounted = true;

    async function pollStatus() {
      try {
        const res = await analysisService.getStatus(analysisId);
        if (!isMounted) return;

        const statusLower = String(res?.status || '').toLowerCase();
        setBackendStatus(res?.status);
        if (res?.pesan_status) setPesanStatus(res.pesan_status);
        if (typeof res?.durasi_detik === 'number') setDurasiDetik(res.durasi_detik);

        if (typeof res?.progres_persen === 'number') {
          const isCompleteResp =
            statusLower === 'selesai' || statusLower === 'completed' || statusLower === 'success';
          setGlobalProgress(res.progres_persen, isCompleteResp ? 100 : 99);
        }
        if (res?.tahap_sekarang) {
          setActiveStageCode(res.tahap_sekarang);
        }
        if (Array.isArray(res?.tahap)) {
          setBackendStages(res.tahap);
        }
        if (res?.trait_name || res?.trait) setStatusTrait(res.trait_name || res.trait);
        if (res?.ringkasan_qc) {
          setRingkasanQc(res.ringkasan_qc);
        }

        // Tangani status gagal -> hentikan polling & buka kunci navigasi untuk perbaikan parameter
        if (statusLower === 'gagal' || statusLower === 'failed') {
          if (timer) clearTimeout(timer);
          setIsFailed(true);
          useAnalysisStore.setState((s) => ({
            isComputing: false,
            isCompleted: false,
            isFailed: true,
            currentAnalysis: s.currentAnalysis ? { ...s.currentAnalysis, status: 'gagal' } : s.currentAnalysis,
          }));
          const errMsg =
            res.galat?.pesan ||
            res.pesan_status ||
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
          return;
        }

        // Cek status selesai -> kunci 100% seluruh tahapan & muat hasil nyata dari backend
        if (statusLower === 'selesai' || statusLower === 'completed' || statusLower === 'success') {
          setGlobalProgress(100, 100);
          [1, 2, 3, 4].forEach((sid) => setStageProgress(sid, 100, 100));
          try {
            const resultsData = await analysisService.getFullAnalysisResults(analysisId);
            if (!isMounted) return;
            setResults(resultsData);
            setLocalCompleted(true);
            useAnalysisStore.setState((s) => ({
              isComputing: false,
              isCompleted: true,
              isFailed: false,
              currentAnalysis: s.currentAnalysis ? { ...s.currentAnalysis, status: 'selesai' } : s.currentAnalysis,
            }));
            if (resultsData?.raw_backend_results?.qc || resultsData?.qc || resultsData?.ringkasan_qc) {
              setRingkasanQc(resultsData.raw_backend_results?.qc || resultsData.qc || resultsData.ringkasan_qc);
            }
          } catch (rErr) {
            if (!isMounted) return;
            setIsFailed(true);
            useAnalysisStore.setState((s) => ({
              isComputing: false,
              isCompleted: false,
              isFailed: true,
              currentAnalysis: s.currentAnalysis ? { ...s.currentAnalysis, status: 'gagal' } : s.currentAnalysis,
            }));
            setError({
              message: rErr?.message || rErr?.pesan || 'Komputasi selesai, namun gagal memuat hasil dari server.',
              details: rErr?.details || rErr?.rincian || [],
            });
          }
          return;
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Galat saat polling status analisis:', err);
        if (timer) clearTimeout(timer);
        setIsFailed(true);
        useAnalysisStore.setState({
          isComputing: false,
          isFailed: true,
        });
        setError({
          message: err?.message || err?.pesan || 'Gagal memantau status komputasi dari server.',
          details: err?.details || err?.rincian || [],
        });
        return;
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
  }, [analysisId, isCompleted, isFailed, setResults]);

  const effectiveAnalysis = analysis || currentAnalysis;
  const resolvedTraitName = resolveTargetTraitName({
    analysis: {
      ...(effectiveAnalysis || {}),
      ...(statusTrait ? { trait_name: statusTrait } : {}),
    },
    configParams,
    uploadSummary,
    results,
    qcSummary: ringkasanQc,
  });

  // Helper memetakan status 4 kartu tahapan visual di UI
  const getDisplayStages = () => {
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
    const qcStatus = qcStage?.status || (isCompleted ? 'selesai' : (String(backendStatus || '').toLowerCase() === 'berjalan' ? 'berjalan' : 'menunggu'));
    const qcMsg = qcStage?.pesan || null;

    // 2. PCA
    const pcaStage = stageMap['pca'];
    const pcaStatus = pcaStage?.status || (isCompleted ? 'selesai' : 'menunggu');
    const pcaMsg = pcaStage?.pesan || null;

    // 3. Uji Asosiasi & Koreksi
    const asoStage = stageMap['asosiasi'] || stageMap['association'] || stageMap['gwas'];
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
        desc: 'Memvalidasi tingkat missingness, MAF, kepatuhan HWE, dan estimasi kekerabatan genomik.',
        status: qcStatus,
        message: qcMsg,
        rawPercent: qcStage?.progres_persen ?? qcStage?.progress,
      },
      {
        id: 2,
        title: 'Analisis Struktur Populasi (PCA Otomatis)',
        desc: 'Menghitung dekomposisi kovariat PC1–PC3 untuk mengoreksi stratifikasi struktur populasi.',
        status: pcaStatus,
        message: pcaMsg,
        rawPercent: pcaStage?.progres_persen ?? pcaStage?.progress,
      },
      {
        id: 3,
        title: 'Uji Asosiasi Statistik & Koreksi',
        desc: `Mengeksekusi model ${configParams.model || 'MLM'} terhadap sifat ${resolvedTraitName !== '—' ? resolvedTraitName : 'target'} dengan koreksi Bonferroni & FDR.`,
        status: asoStatus,
        message: asoMsg,
        rawPercent: korStage?.progres_persen ?? korStage?.progress ?? asoStage?.progres_persen ?? asoStage?.progress,
      },
      {
        id: 4,
        title: 'Anotasi Kandidat Gen (GFF3 / Ensembl)',
        desc: 'Memetakan SNP signifikan ke genom referensi kandidat gen dan menyusun plot Manhattan & QQ.',
        status: anoStatus,
        message: anoMsg,
        rawPercent: anoStage?.progres_persen ?? anoStage?.progress,
      },
    ];
  };

  const displayStages = getDisplayStages();
  latestStagesRef.current = displayStages;

  // Sinkronisasi monotonik status tahapan & global progress ke Zustand (Math.max guard)
  const stageSignature = displayStages.map((s) => `${s.id}:${s.status}:${s.rawPercent ?? ''}`).join('|');
  useEffect(() => {
    if (isCompleted) {
      setGlobalProgress(100, 100);
      [1, 2, 3, 4].forEach((sid) => setStageProgress(sid, 100, 100));
      return;
    }
    for (const stg of displayStages) {
      if (stg.status === 'selesai') {
        setStageProgress(stg.id, 100, 100);
      } else if (stg.status === 'berjalan') {
        const incoming = typeof stg.rawPercent === 'number' ? Math.max(45, stg.rawPercent) : 45;
        setStageProgress(stg.id, incoming, 92);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageSignature, isCompleted, setGlobalProgress, setStageProgress]);

  // Hitung persentase progres global (dijamin monotonik & terkunci 100% saat selesai)
  const displayPercent = isCompleted ? 100 : Math.min(99, Number(globalProgress) || 0);
  const formattedDisplayPercent = formatProgressPercent(displayPercent);

  // Hitung data ringkasan QC dinamis dari respons backend/unggah
  const isQcDone = isCompleted || displayStages[0].status === 'selesai';
  const rawSamplesTotal =
    ringkasanQc?.sampel_awal ??
    ringkasanQc?.sampel_total ??
    ringkasanQc?.total_sampel ??
    uploadSummary?.genotipe?.jumlah_sampel ??
    null;
  const rawSamplesPassed = ringkasanQc?.sampel_lolos ?? ringkasanQc?.n_samples ?? rawSamplesTotal;
  const samplesPassed = rawSamplesPassed ?? '—';
  const samplesTotal = rawSamplesTotal ?? '—';
  const samplesFiltered =
    typeof ringkasanQc?.sampel_disaring === 'number'
      ? ringkasanQc.sampel_disaring
      : rawSamplesTotal != null && rawSamplesPassed != null && rawSamplesTotal - rawSamplesPassed > 0
      ? rawSamplesTotal - rawSamplesPassed
      : 0;

  const rawSnpsTotal =
    ringkasanQc?.snp_awal ??
    ringkasanQc?.snp_total ??
    ringkasanQc?.total_snp ??
    uploadSummary?.genotipe?.jumlah_snp ??
    null;
  const rawSnpsPassed = ringkasanQc?.snp_lolos ?? ringkasanQc?.n_snps ?? rawSnpsTotal;
  const snpsPassed = rawSnpsPassed ?? '—';
  const snpsTotal = rawSnpsTotal ?? '—';
  const snpsFiltered =
    typeof ringkasanQc?.snp_disaring === 'number'
      ? ringkasanQc.snp_disaring
      : rawSnpsTotal != null && rawSnpsPassed != null && rawSnpsTotal - rawSnpsPassed > 0
      ? rawSnpsTotal - rawSnpsPassed
      : 0;

  const currentTip = TIPS_EDUKATIF[tipIndex];

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Banner Status Terkunci ── */}
      {!isFailed && (
        <div className="relative overflow-hidden rounded-3xl figma-card border-amber-300/80 dark:border-amber-500/40 bg-gradient-to-r from-amber-100/80 via-amber-50/60 to-transparent dark:from-amber-500/15 dark:via-amber-500/5 dark:to-transparent p-5 sm:p-6 backdrop-blur-md">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shadow-inner">
              <Lock className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Komputasi Pipeline Sedang Berjalan</span>
                <span className="inline-flex items-center rounded-full bg-amber-200 dark:bg-amber-500/20 px-2.5 py-0.5 text-xs font-sans font-bold text-amber-950 dark:text-amber-300">
                  Form Konfigurasi Dikunci
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

      {/* ─── Area Pesan Kesalahan / Status Gagal (Evaluasi Tester Poin 18) ─── */}
      {isFailed && (() => {
        const errText = typeof error === 'string' ? error : (error?.message || error?.pesan || '');
        const isQcTooStrict = /qc|sampel|sedikit|filter|maf|geno|mind|hwe|kinship/i.test(errText);
        const isFileCorrupted = /format|berkas|file|vcf|csv|kolom|parse|bialel/i.test(errText);

        return (
          <div className="rounded-3xl border border-rose-300 dark:border-rose-500/40 bg-rose-50/90 dark:bg-rose-500/10 p-6 space-y-4 shadow-xl animate-fade-in backdrop-blur-md">
            <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-400">
              <XCircle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold font-sans">
                Komputasi Pipeline GWAS Gagal Dijalankan
              </h3>
            </div>

            <ErrorMessageArea error={error} type="error" />

            {/* Rekomendasi Tindakan Spesifik Berdasarkan Jenis Galat (Evaluasi Tester Poin 18) */}
            <div className="rounded-2xl p-4 border bg-white/80 dark:bg-[#070C1D]/80 border-rose-200 dark:border-rose-500/20 text-xs sm:text-sm font-sans space-y-2">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Rekomendasi Tindakan Korektif Ilmiah:</span>
              </div>
              {isQcTooStrict ? (
                <p className="text-rose-900 dark:text-rose-200 leading-relaxed font-medium">
                  <strong>Masalah disebabkan oleh ambang filter Quality Control yang terlalu ketat.</strong> Sampel atau varian SNP tersaring habis sebelum uji statistik dimulai. Disarankan menekan tombol <strong>"Kembali ke Konfigurasi QC & Model"</strong> untuk melonggarkan ambang missingness atau MAF.
                </p>
              ) : isFileCorrupted ? (
                <p className="text-rose-900 dark:text-rose-200 leading-relaxed font-medium">
                  <strong>Masalah disebabkan oleh format atau integritas berkas data yang tidak valid.</strong> Pastikan berkas VCF memuat varian bialelik dan tabel CSV fenotipe memiliki Sample ID yang 100% cocok. Disarankan menekan tombol <strong>"Kembali ke Unggah & Validasi"</strong>.
                </p>
              ) : (
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  Masalah dapat disebabkan oleh ambang filter Quality Control yang terlalu ketat atau ketidakcocokan format berkas. Silakan gunakan tombol navigasi di bawah untuk menyesuaikan parameter atau memeriksa kembali berkas input Anda.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-rose-200 dark:border-rose-500/20">
              <button
                type="button"
                onClick={() => {
                  setIsFailed(false);
                  setError(null);
                  setActiveStep(2);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md ${
                  isQcTooStrict
                    ? 'bg-[#5B4DFE] hover:bg-[#4F46E5] text-white ring-2 ring-[#5B4DFE]/40'
                    : 'bg-[#5B4DFE] hover:bg-[#4F46E5] text-white'
                }`}
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Kembali ke Konfigurasi QC & Model (Langkah 2)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFailed(false);
                  setError(null);
                  setActiveStep(1);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-xs ${
                  isFileCorrupted
                    ? 'bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold ring-2 ring-[#0284C7]/40'
                    : 'border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200'
                }`}
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Kembali ke Unggah & Validasi (Langkah 1)</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* ─── Progress Bar Utama (Poin #3) ── */}
      <div className="rounded-2xl glass-subcard p-4 sm:p-5 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-sans font-bold text-slate-900 dark:text-white">
              Kemajuan Komputasi Pipeline
            </span>
            {isFailed ? (
              <span className="rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 px-2.5 py-0.5 text-xs font-bold">
                Terhenti (Galat)
              </span>
            ) : isCompleted ? (
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-bold">
                100% Selesai
              </span>
            ) : (
              <span className="rounded-full bg-cyan-100 dark:bg-[#06B6D4]/20 text-cyan-900 dark:text-[#06B6D4] px-2.5 py-0.5 text-xs font-bold">
                Sedang Diproses...
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 font-mono text-xs sm:text-sm">
            {durasiDetik !== null && (
              <span className="text-slate-600 dark:text-slate-300 font-semibold">
                Durasi: {Number(durasiDetik).toFixed(1)}s
              </span>
            )}
            <span
              data-testid="global-progress-percent"
              className="font-bold text-[#5B4DFE] dark:text-[#06B6D4] tabular-nums"
            >
              {formattedDisplayPercent}%
            </span>
          </div>
        </div>

        {pesanStatus && (
          <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            <span>{pesanStatus}</span>
          </div>
        )}

        <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden p-0.5">
          <div
            data-testid="global-progress-bar"
            className={`h-full rounded-full transition-all duration-500 ${
              isFailed
                ? 'bg-rose-500'
                : isCompleted
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-[#5B4DFE] to-[#06B6D4] animate-pulse'
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
              <span>Tahapan Eksekusi</span>
            </h4>
            <span className="text-xs font-mono font-semibold text-[#5B4DFE] dark:text-[#06B6D4]">
              {isCompleted
                ? '4 / 4 Tahap Selesai'
                : `${displayStages.filter((s) => s.status === 'selesai' || (stageProgress?.[s.id] || 0) >= 100).length} / 4 Tahap Selesai`}
            </span>
          </div>

          <div className="space-y-3">
            {displayStages.map((stage) => {
              const persistedPct = Number(stageProgress?.[stage.id]) || 0;
              const isDone = isCompleted || stage.status === 'selesai' || persistedPct >= 100;
              const isFail = !isDone && stage.status === 'gagal';
              const isRunning = !isDone && !isFail && stage.status === 'berjalan';
              const stagePercent = isDone
                ? 100
                : isRunning
                ? Math.max(45, Math.min(92, persistedPct))
                : persistedPct;
              const formattedStagePercent = formatProgressPercent(stagePercent);

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
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="capitalize">
                          {isDone && <span className="text-emerald-600 dark:text-emerald-400 font-bold">Selesai</span>}
                          {isRunning && <span className="text-[#0284C7] dark:text-[#06B6D4] font-bold">Berjalan...</span>}
                          {isFail && <span className="text-rose-600 dark:text-rose-400 font-bold">Gagal</span>}
                          {!isDone && !isRunning && !isFail && <span className="text-slate-500 font-semibold">Menunggu</span>}
                        </span>
                        <span
                          data-testid={`stage-percent-${stage.id}`}
                          className={`font-bold tabular-nums px-1.5 py-0.5 rounded-md border ${
                            isDone
                              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-500/15 border-emerald-300/60 dark:border-emerald-500/30'
                              : isRunning
                              ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-100/80 dark:bg-cyan-500/15 border-cyan-300/60 dark:border-cyan-500/30'
                              : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {formattedStagePercent}%
                        </span>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {stage.desc}
                    </p>

                    {stage.message && (
                      <p className="text-xs font-mono font-bold text-[#0284C7] dark:text-[#06B6D4] bg-cyan-50 dark:bg-black/30 px-3 py-1.5 rounded-lg mt-1.5 border border-cyan-200 dark:border-white/5">
                        {stage.message}
                      </p>
                    )}

                    {/* Progress bar per tahap eksekusi */}
                    <div
                      role="progressbar"
                      aria-label={`Progres ${stage.title}`}
                      aria-valuenow={stagePercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mt-2"
                    >
                      <div
                        className={`h-full rounded-full ${
                          isDone
                            ? 'bg-emerald-500 w-full transition-all duration-300'
                            : isRunning
                            ? 'bg-cyan-500 animate-pulse transition-all duration-300'
                            : isFail
                            ? stagePercent > 0
                              ? 'bg-rose-500 transition-all duration-300'
                              : 'bg-rose-500 w-0'
                            : stagePercent > 0
                            ? 'bg-cyan-500/70 transition-all duration-300'
                            : 'bg-slate-300 dark:bg-slate-600 w-0'
                        }`}
                        style={{ width: `${stagePercent}%` }}
                      />
                    </div>
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
                className="w-full figma-btn-primary py-3.5 text-sm sm:text-base cursor-pointer"
              >
                <span>Lihat Hasil Analisis & Visualisasi Plot (Langkah 4)</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Ringkasan QC & Karusel Tips Edukatif (5 Kolom) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card Ringkasan Hasil Penyaringan QC */}
          <div className="rounded-3xl figma-card p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#06B6D4]" />
                <h5 className="text-sm font-sans font-bold text-slate-900 dark:text-white">
                  Ringkasan Penyaringan Quality Control
                </h5>
              </div>
              {isQcDone && (
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 px-2.5 py-0.5 text-xs font-bold">
                  QC Selesai
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="glass-subcard p-3.5">
                <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">
                  Sampel Dianalisis
                </span>
                <span className="font-serif text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {samplesPassed}{' '}
                  <span className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-300">
                    / {samplesTotal} total
                  </span>
                </span>
                {samplesFiltered > 0 && (
                  <span className="text-xs font-sans font-semibold text-amber-700 dark:text-amber-400 block mt-1">
                    -{samplesFiltered} disaring (mind/kekerabatan)
                  </span>
                )}
              </div>

              <div className="glass-subcard p-3.5">
                <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">
                  SNP Lolos Filter
                </span>
                <span className="font-serif text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {snpsPassed}{' '}
                  <span className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-300">
                    / {snpsTotal} total
                  </span>
                </span>
                {snpsFiltered > 0 && (
                  <span className="text-xs font-sans font-semibold text-amber-700 dark:text-amber-400 block mt-1">
                    -{snpsFiltered} disaring (MAF/geno/HWE)
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl glass-subcard p-3 flex items-center justify-between text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
              <span>Sifat fenotipe target:</span>
              <span
                data-testid="qc-target-trait-value"
                className="font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800/60 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 font-mono"
              >
                {resolvedTraitName}
              </span>
            </div>
          </div>

          {/* Card Tips Edukatif Dinamis */}
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
                <span className="text-sm font-sans font-bold text-cyan-950 dark:text-[#06B6D4]">
                  Tips Edukatif Riset Genomik
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Badge Countdown Waktu */}
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-cyan-100/90 dark:bg-[#06B6D4]/20 text-cyan-900 dark:text-cyan-300 border border-cyan-300/60 dark:border-[#06B6D4]/30 flex items-center gap-1.5 shadow-sm font-bold">
                  <span className={`h-1.5 w-1.5 rounded-full ${isHovered ? 'bg-amber-500' : 'bg-cyan-500 animate-pulse'}`} />
                  {isHovered ? 'DIJEDA' : `${countdown}s`}
                </span>
                {/* Tombol Panah Navigasi */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevTip}
                    className="rounded-lg border border-slate-300 dark:border-white/10 bg-white/90 dark:bg-white/5 p-1 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-90 text-slate-800 dark:text-slate-200 transition-all duration-100 shadow-sm"
                    title="Sebelumnya (Reset 6s)"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextTip}
                    className="rounded-lg border border-slate-300 dark:border-white/10 bg-white/90 dark:bg-white/5 p-1 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-90 text-slate-800 dark:text-slate-200 transition-all duration-100 shadow-sm"
                    title="Berikutnya (Reset 6s)"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bilah Progres Countdown 6s */}
            <div className="w-full h-1.5 bg-slate-200/80 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 rounded-full"
                style={{
                  width: `${(countdown / 6) * 100}%`,
                  transition: countdown === 6 ? 'none' : 'width 1s linear',
                }}
              />
            </div>

            {/* Konten Tips Berotasi dengan Efek Transisi Fade-In */}
            <div key={tipIndex} className="min-h-[80px] space-y-1.5 animate-fade-in pt-1">
              <h6 className="text-sm font-sans font-bold text-slate-900 dark:text-white">{currentTip?.judul}</h6>
              <p className="text-xs sm:text-sm font-serif leading-relaxed text-slate-800 dark:text-slate-200 italic">
                &ldquo;{currentTip?.teks}&rdquo;
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
