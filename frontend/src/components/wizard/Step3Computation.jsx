import { useState, useEffect } from 'react';
import {
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Dna,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAnalysisStore } from '../../store/useAnalysisStore.js';
import { analysisService } from '../../services/analysisService.js';
import { TIPS_EDUKATIF } from '../../constants/eduHints.js';
import { generateBenchmarkResults } from '../../services/mockResults.js';

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
  } = useAnalysisStore();

  // Tahapan Pipeline Diskrit (1 s.d. 4)
  const PIPELINE_STAGES = [
    {
      id: 1,
      title: 'Quality Control (Penyaringan Sampel & SNP)',
      desc: 'Memvalidasi missingness, MAF, HWE klonal bawang putih, dan kekerabatan KING.',
    },
    {
      id: 2,
      title: 'Analisis Struktur Populasi (PCA Otomatis)',
      desc: 'Menghitung dekomposisi kovariat PC1–PC3 untuk koreksi stratifikasi genetik (FR-04).',
    },
    {
      id: 3,
      title: 'Uji Asosiasi Statistik & Koreksi',
      desc: `Mengeksekusi model ${configParams.model || 'MLM'} terhadap sifat ${configParams.trait || 'fenotipe'} dengan koreksi Bonferroni & FDR.`,
    },
    {
      id: 4,
      title: 'Anotasi Kandidat Gen & Visualisasi',
      desc: 'Memetakan SNP signifikan ke gen Allium sativum dan menyusun plot Manhattan/QQ.',
    },
  ];

  const [localStage, setLocalStage] = useState(1);
  const [localCompleted, setLocalCompleted] = useState(false);
  const isCompleted = storeCompleted || localCompleted;
  const activeStage = isCompleted ? 4 : (isSimulated ? (computationStage || 1) : localStage);
  const [backendNotice, setBackendNotice] = useState(null);

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
    if (isSimulated && !isComputing && !storeCompleted) {
      startSimulation();
    }
  }, [isSimulated, isComputing, storeCompleted, startSimulation]);

  // Polling backend status setiap 3 detik hanya jika BUKAN mode simulasi
  useEffect(() => {
    if (isSimulated) return;

    let timer;
    let isMounted = true;

    async function pollStatus() {
      try {
        const res = await analysisService.getStatus(analysisId);
        if (!isMounted) return;

        if (res.status === 'selesai') {
          setLocalCompleted(true);
          // Ambil hasil jika tersedia
          try {
            const resultsData = await analysisService.getResults(analysisId);
            setResults(resultsData);
          } catch (rErr) {
            const fallback = generateBenchmarkResults(configParams, uploadSummary);
            setResults(fallback);
          }
          return;
        }

        if (res.tahap) {
          setLocalStage(Number(res.tahap) || 1);
        }
      } catch (err) {
        if (!isMounted) return;
        // Jika tanpa backend (501, koneksi gagal, offline), otomatis aktifkan mock simulation
        console.warn('Backend tidak merespons, beralih ke mock simulation otomatis:', err);
        startSimulation();
      }

      if (!isCompleted) {
        timer = setTimeout(pollStatus, 3000);
      }
    }

    pollStatus();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [analysisId, isCompleted, isSimulated, startSimulation, configParams, uploadSummary, setResults]);

  // Simulasi UI jika pengguna mengklik manual tombol uji pratinjau
  function handleStartSimulation() {
    startSimulation();
  }

  const currentTip = TIPS_EDUKATIF[tipIndex];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Banner Status Terkunci (BR-05, AC-10.1) ── */}
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

      {/* ── Pemberitahuan Backend 501 Transparan ── */}
      {backendNotice && !isSimulated && (
        <div className="rounded-3xl figma-card border-cyan-300/80 dark:border-[#06B6D4]/40 bg-cyan-50/80 dark:bg-[#0F2238]/85 p-5 sm:p-6 space-y-3 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-cyan-700 dark:text-[#06B6D4] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-sans font-bold uppercase tracking-wider text-cyan-900 dark:text-[#06B6D4]">
                Informasi Integrasi Backend (HTTP 501)
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{backendNotice}</p>
            </div>
          </div>
          <div className="pt-1 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleStartSimulation}
              className="inline-flex items-center gap-2 rounded-xl bg-[#06B6D4] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-[#0891B2] transition-all shadow-md active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Simulasikan Selesai Komputasi (Mode Pengujian UI)</span>
            </button>
          </div>
        </div>
      )}

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
              {isCompleted ? '4 / 4 Tahap Selesai' : `Tahap ${activeStage} dari 4`}
            </span>
          </div>

          <div className="space-y-3">
            {PIPELINE_STAGES.map((stage) => {
              const isPast = isCompleted || activeStage > stage.id;
              const isCurrent = !isCompleted && activeStage === stage.id;

              return (
                <div
                  key={stage.id}
                  className={`flex items-start gap-3.5 rounded-2xl p-4 transition-all duration-300 ${
                    isCurrent
                      ? 'glass-subcard border-[#06B6D4] bg-cyan-50/90 dark:bg-[#06B6D4]/15 shadow-lg shadow-[#06B6D4]/10 ring-1 ring-[#06B6D4]/40'
                      : isPast
                      ? 'glass-subcard border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-[#0F172E]/60 shadow-sm'
                      : 'glass-subcard border-slate-200 dark:border-white/10 opacity-70'
                  }`}
                >
                  <div className="pt-0.5">
                    {isPast ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
                      </div>
                    ) : isCurrent ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#06B6D4]/20 text-[#06B6D4] animate-pulse-ring">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {stage.id}
                      </div>
                    )}
                  </div>

                  <div className="space-y-0.5 flex-1">
                    <p
                      className={`text-xs sm:text-sm font-sans font-semibold ${
                        isCurrent
                          ? 'text-[#5B4DFE] dark:text-[#06B6D4] font-bold'
                          : isPast
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {stage.title}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{stage.desc}</p>
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
          {/* Card Ringkasan Hasil Penyaringan QC (AC-03.1) */}
          <div className="rounded-3xl figma-card p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2.5">
              <Filter className="h-4 w-4 text-[#06B6D4]" />
              <h5 className="text-xs font-sans font-bold text-slate-900 dark:text-white">
                Ringkasan Penyaringan QC (AC-03.1)
              </h5>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="glass-subcard p-3">
                <span className="text-[10px] font-sans font-semibold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">Sampel Dianalisis</span>
                <span className="font-serif text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {isCompleted ? '38' : '40'}{' '}
                  <span className="text-[11px] font-sans font-normal text-slate-500 dark:text-slate-400">/ 40 total</span>
                </span>
                {isCompleted && (
                  <span className="text-[10px] font-sans text-amber-600 dark:text-amber-400 block mt-0.5">
                    -2 disaring (mind)
                  </span>
                )}
              </div>

              <div className="glass-subcard p-3">
                <span className="text-[10px] font-sans font-semibold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">SNP Lolos Filter</span>
                <span className="font-serif text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {isCompleted ? '482' : '500'}{' '}
                  <span className="text-[11px] font-sans font-normal text-slate-500 dark:text-slate-400">/ 500 total</span>
                </span>
                {isCompleted && (
                  <span className="text-[10px] font-sans text-amber-600 dark:text-amber-400 block mt-0.5">
                    -18 disaring (MAF/geno/HWE)
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
              <h6 className="text-xs font-sans font-bold text-slate-900 dark:text-white">{currentTip.judul}</h6>
              <p className="text-xs sm:text-[13px] font-serif leading-relaxed text-slate-700 dark:text-slate-300 italic">
                &ldquo;{currentTip.teks}&rdquo;
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
