import { useState, useEffect } from 'react';
import {
  Sliders,
  Dna,
  ShieldCheck,
  CheckCircle2,
  Info,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Play,
  HelpCircle,
} from 'lucide-react';
import { DEFAULT_ANALYSIS_CONFIG, QC_PARAM_RANGES } from '../../constants/defaultParams.js';
import EduHintTooltip from '../common/EduHintTooltip.jsx';
import ErrorMessageArea from '../common/ErrorMessageArea.jsx';
import { analysisService } from '../../services/analysisService.js';
import { useAnalysisStore } from '../../store/useAnalysisStore.js';

/**
 * Step2Config (Konfigurasi Parameter QC & Model Asosiasi - Figma Aligned)
 * Acuan: 05b — Konfigurasi_ GLM Terpilih (Terisi).png & 05c — Konfigurasi_ MLM Terpilih (Terisi).png
 */
export default function Step2Config({
  analysisId,
  availableTraits = [],
  onPrev,
  onRunSuccess,
}) {
  const {
    configParams,
    setConfigParams,
    runAnalysis,
    isComputing,
    currentAnalysis,
  } = useAnalysisStore();

  const isLockedDuringCompute =
    isComputing ||
    ['antre', 'berjalan', 'pending', 'running'].includes(
      String(currentAnalysis?.status || '').toLowerCase()
    );

  const [trait, setTrait] = useState(
    configParams.trait || (availableTraits.length > 0 ? availableTraits[0] : 'bobot_umbi_g')
  );

  // Sinkronkan trait jika availableTraits dimuat dari backend
  useEffect(() => {
    if (availableTraits.length > 0 && (!trait || !availableTraits.includes(trait))) {
      setTrait(availableTraits[0]);
    }
  }, [availableTraits, trait]);
  const [mind, setMind] = useState(configParams.qc?.mind ?? 0.10);
  const [geno, setGeno] = useState(configParams.qc?.geno ?? 0.10);
  const [maf, setMaf] = useState(configParams.qc?.maf ?? 0.05);

  // HWE Filter (Nonaktif secara bawaan untuk populasi klonal atau struktur silang spesifik)
  const [isHweActive, setIsHweActive] = useState(
    configParams.qc?.hwe !== null && configParams.qc?.hwe !== undefined
  );
  const [hwe, setHwe] = useState(
    configParams.qc?.hwe != null ? String(configParams.qc.hwe) : '1e-6'
  );

  // KING Cutoff Filter (Nonaktif secara bawaan untuk populasi klonal atau struktur silang spesifik)
  const [isKingActive, setIsKingActive] = useState(
    configParams.qc?.king_cutoff !== null && configParams.qc?.king_cutoff !== undefined
  );
  const [kingCutoff, setKingCutoff] = useState(
    configParams.qc?.king_cutoff != null ? configParams.qc.king_cutoff : 0.177
  );

  // Model & Koreksi
  const [model, setModel] = useState(configParams.model || 'MLM');
  const [koreksi, setKoreksi] = useState(configParams.koreksi || ['bonferroni', 'fdr']);
  const [alpha, setAlpha] = useState(configParams.alpha ?? 0.05);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Toggle metode koreksi (bisa multi-select)
  const handleToggleKoreksi = (method) => {
    if (koreksi.includes(method)) {
      if (koreksi.length === 1) return; // Minimal 1 metode koreksi aktif
      setKoreksi(koreksi.filter((m) => m !== method));
    } else {
      setKoreksi([...koreksi, method]);
    }
  };

  const handleStartAnalysis = async (e) => {
    if (e) e.preventDefault();
    if (isLockedDuringCompute) return;
    setError(null);
    setIsSubmitting(true);

    const payload = {
      trait,
      qc: {
        mind: parseFloat(mind),
        geno: parseFloat(geno),
        maf: parseFloat(maf),
        hwe: isHweActive && hwe ? (typeof hwe === 'string' ? parseFloat(hwe) : hwe) : null,
        king_cutoff: isKingActive && kingCutoff != null ? parseFloat(kingCutoff) : null,
      },
      n_pc: 3,
      model,
      koreksi,
      alpha: parseFloat(alpha),
    };

    setConfigParams(payload);

    try {
      const res = await runAnalysis(analysisId, payload);
      setIsSubmitting(false);
      onRunSuccess?.(res);
    } catch (err) {
      setIsSubmitting(false);
      console.error('Eksekusi parameter ditolak atau gagal menghubungi server:', err);
      setError({
        message: err?.message || err?.pesan || 'Terjadi kesalahan saat memproses parameter analisis.',
        details: err?.details || err?.rincian || [],
      });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Header Langkah ── */}
      <div className="border-b border-slate-200 dark:border-white/10 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          2. Konfigurasi Parameter Quality Control & Model Asosiasi
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Tentukan sifat agronomi yang diuji, sesuaikan filter penyaringan data varian genomik, serta pilih model asosiasi (GLM atau MLM).
        </p>
      </div>

      {/* ── Banner Panduan Parameter [EDU-HINT] (Hanya Tampil di Langkah 2) ── */}
      <div className="flex items-center gap-3 rounded-2xl border border-cyan-300 dark:border-cyan-500/30 bg-cyan-50/90 dark:bg-cyan-950/30 p-3.5 sm:p-4 text-xs sm:text-sm text-cyan-950 dark:text-cyan-200 backdrop-blur-md shadow-sm">
        <span className="text-lg shrink-0">💡</span>
        <p className="font-sans leading-relaxed">
          <strong className="font-bold">Panduan Parameter:</strong> Klik atau arahkan kursor ke ikon tanda tanya (?) di pojok setiap kartu untuk membaca penjelasan ilmiah dan fungsi bagian tersebut.
        </p>
      </div>

      <ErrorMessageArea error={error} onDismiss={() => setError(null)} />

      <form onSubmit={handleStartAnalysis} noValidate className="space-y-8">
        {/* ── Bagian A: Pemilihan Sifat Fenotipe (Trait) ── */}
        <div className="figma-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#06B6D4]/15 text-[#06B6D4] text-xs font-bold font-sans">
                A
              </span>
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white font-sans">
                Sifat Fenotipe Target Analisis
              </h3>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">Tepat 1 sifat per sesi analisis</span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 font-sans">
            Pilih satu karakter agronomi kuantitatif dari berkas CSV yang telah divalidasi:
          </p>

          <div className="max-w-md">
            <select
              value={trait}
              onChange={(e) => setTrait(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2.5 px-3.5 text-sm font-mono font-medium text-slate-900 dark:text-white focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] cursor-pointer"
            >
              {availableTraits.length > 0 ? (
                availableTraits.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))
              ) : (
                <>
                  <option value="bobot_umbi_g">bobot_umbi_g (Bobot Umbi - g)</option>
                  <option value="diameter_umbi_mm">diameter_umbi_mm (Diameter Umbi - mm)</option>
                  <option value="jumlah_siung">jumlah_siung (Jumlah Siung per Umbi)</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* ── Bagian B: Parameter Quality Control ── */}
        <div className="figma-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#5B4DFE]/15 text-[#5B4DFE] text-xs font-bold font-sans">
                B
              </span>
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white font-sans">
                Parameter Quality Control (QC)
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">Standar PLINK 2 Engine</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Missingness per Sampel (mind) - Evaluasi Tester Poin 12 */}
            <div className="space-y-2 glass-subcard p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="mind" className="text-xs font-bold text-slate-900 dark:text-white font-sans">
                    Missingness Sampel (mind)
                  </label>
                  <EduHintTooltip hintKey="mind" />
                </div>
                <span className="font-mono text-xs font-bold text-[#5B4DFE] dark:text-[#06B6D4] tabular-nums">
                  {Number(mind).toFixed(2)}
                </span>
              </div>
              <input
                id="mind"
                type="range"
                min="0.00"
                max="0.50"
                step="0.01"
                value={mind}
                onChange={(e) => setMind(e.target.value)}
                className="w-full accent-[#5B4DFE] dark:accent-[#06B6D4] cursor-pointer"
              />
              <div className="flex items-center justify-between text-[11px] font-sans font-medium text-slate-700 dark:text-slate-300">
                <span>Rentang nilai: 0.00 – 0.50</span>
                <span>Default: 0.10 (&gt;10% sampel hilang disaring)</span>
              </div>
            </div>

            {/* 2. Missingness per SNP (geno) - Evaluasi Tester Poin 12 */}
            <div className="space-y-2 glass-subcard p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="geno" className="text-sm font-bold text-slate-900 dark:text-white font-sans">
                    Missingness SNP (geno)
                  </label>
                  <EduHintTooltip hintKey="geno" />
                </div>
                <span className="font-mono text-sm font-bold text-[#0284C7] dark:text-[#06B6D4] tabular-nums">
                  {Number(geno).toFixed(2)}
                </span>
              </div>
              <input
                id="geno"
                type="range"
                min="0.00"
                max="0.50"
                step="0.01"
                value={geno}
                onChange={(e) => setGeno(e.target.value)}
                className="w-full accent-[#0284C7] dark:accent-[#06B6D4] cursor-pointer"
              />
              <div className="flex items-center justify-between text-[11px] font-sans font-medium text-slate-700 dark:text-slate-300">
                <span>Rentang nilai: 0.00 – 0.50</span>
                <span>Default: 0.10 (&gt;10% SNP hilang disaring)</span>
              </div>
            </div>

            {/* 3. Minor Allele Frequency (maf) - Evaluasi Tester Poin 12 */}
            <div className="space-y-2 glass-subcard p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="maf" className="text-sm font-bold text-slate-900 dark:text-white font-sans">
                    Minor Allele Frequency (maf)
                  </label>
                  <EduHintTooltip hintKey="maf" />
                </div>
                <span className="font-mono text-sm font-bold text-[#0284C7] dark:text-[#06B6D4] tabular-nums">
                  {Number(maf).toFixed(2)}
                </span>
              </div>
              <input
                id="maf"
                type="range"
                min="0.01"
                max="0.50"
                step="0.01"
                value={maf}
                onChange={(e) => setMaf(e.target.value)}
                className="w-full accent-[#0284C7] dark:accent-[#06B6D4] cursor-pointer"
              />
              <div className="flex items-center justify-between text-[11px] font-sans font-medium text-slate-700 dark:text-slate-300">
                <span>Rentang nilai: 0.01 – 0.50</span>
                <span>Default: 0.05 (saring alel &lt;5%)</span>
              </div>
            </div>

            {/* 4. Relatedness / Kinship Cutoff (king_cutoff) */}
            <div className={`space-y-3 glass-subcard p-4 transition-all duration-200 ${!isKingActive ? 'opacity-85' : ''}`}>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isKingActive}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsKingActive(checked);
                      if (checked && kingCutoff == null) setKingCutoff(0.177);
                    }}
                    className="rounded border-slate-400 dark:border-slate-600 text-[#0284C7] focus:ring-[#0284C7] h-4 w-4 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-slate-900 dark:text-white font-sans">
                    Aktifkan Filter Kinship KING (king_cutoff)
                  </span>
                </label>
                <EduHintTooltip hintKey="king_cutoff" />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-[13px] font-sans font-semibold text-slate-700 dark:text-slate-300">
                  {isKingActive ? 'Ambang kinship aktif:' : 'Status filter:'}
                </span>
                {isKingActive ? (
                  <span className="font-mono text-sm font-bold text-[#0284C7] dark:text-[#06B6D4] tabular-nums">
                    {kingCutoff}
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                    Nonaktif (null)
                  </span>
                )}
              </div>

              <input
                id="king"
                type="range"
                disabled={!isKingActive}
                min={QC_PARAM_RANGES.king_cutoff.min}
                max={QC_PARAM_RANGES.king_cutoff.max}
                step={QC_PARAM_RANGES.king_cutoff.step}
                value={kingCutoff ?? 0.177}
                onChange={(e) => setKingCutoff(e.target.value)}
                className={`w-full accent-[#0284C7] dark:accent-[#06B6D4] ${isKingActive ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
              />
              <div className="flex items-center justify-between text-[11px] font-sans font-medium text-slate-700 dark:text-slate-300">
                <span>Rentang nilai: 0.05 – 0.50</span>
                <span>Rekomendasi: 0.177 (Nonaktif secara bawaan)</span>
              </div>
            </div>

            {/* 5. Hardy-Weinberg Equilibrium (hwe) - Input khusus dengan catatan agronomi */}
            <div className={`md:col-span-2 space-y-3 glass-subcard p-4 transition-all duration-200 ${!isHweActive ? 'opacity-85' : ''}`}>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isHweActive}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsHweActive(checked);
                      if (checked && !hwe) setHwe('1e-6');
                    }}
                    className="rounded border-slate-400 dark:border-slate-600 text-[#5B4DFE] focus:ring-[#5B4DFE] h-4 w-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-sans">
                    Aktifkan Filter Hardy-Weinberg (HWE)
                  </span>
                </label>
                <EduHintTooltip hintKey="hwe" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-white font-sans block">
                    Ambang Batas HWE p-value (hwe)
                  </span>
                  <span className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 font-medium font-sans">
                    {isHweActive ? 'Rekomendasi nilai awal: 1e-6' : 'Nonaktif secara bawaan untuk tanaman klonal'}
                  </span>
                </div>
                {isHweActive ? (
                  <input
                    id="hwe"
                    type="text"
                    value={hwe}
                    onChange={(e) => setHwe(e.target.value)}
                    className="w-32 font-mono text-sm font-bold text-[#0284C7] dark:text-[#06B6D4] bg-white dark:bg-[#121B38] rounded-xl border border-slate-300 dark:border-white/10 px-3 py-1.5 text-right focus:outline-none focus:border-[#0284C7]"
                    placeholder="1e-6"
                  />
                ) : (
                  <span className="rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                    Nonaktif (null)
                  </span>
                )}
              </div>

              <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed flex items-start gap-2.5 font-medium">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  <strong>Catatan Penggunaan Filter HWE & Kinship:</strong> Filter ini bersifat opsional dan dinonaktifkan secara default. Aktifkan hanya jika sesuai dengan struktur dan sistem reproduksi populasi yang dianalisis.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bagian C: PCA Otomatis ── */}
        <div className="rounded-3xl border border-indigo-200 dark:border-[#5B4DFE]/30 bg-indigo-50/70 dark:bg-[#5B4DFE]/10 p-6 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#5B4DFE]/15 text-[#5B4DFE] text-xs font-bold font-sans">
                C
              </span>
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white font-sans">
                Struktur Populasi (PCA Otomatis)
              </h3>
              <EduHintTooltip hintKey="pca" />
            </div>
            <span className="rounded-full bg-indigo-100 dark:bg-[#5B4DFE]/20 border border-indigo-300 dark:border-[#5B4DFE]/30 px-3 py-0.5 text-xs font-bold text-indigo-900 dark:text-[#06B6D4] font-sans">
              Otomatis & Terintegrasi
            </span>
          </div>

          <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-sans font-medium">
            Principal Component Analysis (PCA) dihitung secara deterministik menggunakan dekomposisi nilai singular (SVD / PLINK 2 <code>--pca 3</code>) setelah tahap QC untuk menghasilkan <strong>3 komponen utama (PC1–PC3)</strong> sebagai kovariat struktur populasi. Tahap ini <strong>tidak dapat dilewati</strong> demi mencegah temuan asosiasi positif palsu (<em>spurious associations</em>) akibat stratifikasi geografis atau kekerabatan aksesi.
          </p>
        </div>

        {/* ── Bagian D: Pemilihan Model Asosiasi ── */}
        <div className="figma-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#06B6D4]/15 text-[#06B6D4] text-xs font-bold font-sans">
                D
              </span>
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white font-sans">
                Model Uji Asosiasi Statistik
              </h3>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">Pilih Salah Satu Model</span>
          </div>

          <div role="radiogroup" aria-label="Pilih model uji asosiasi" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model 1: GLM (Single Mutually Exclusive Choice, BR-03) */}
            <div
              role="radio"
              aria-checked={model === 'GLM'}
              tabIndex={0}
              onClick={() => !isLockedDuringCompute && setModel('GLM')}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isLockedDuringCompute) {
                  e.preventDefault();
                  setModel('GLM');
                }
              }}
              className={`glass-subcard p-6 cursor-pointer transition-all duration-200 active:scale-[0.985] rounded-3xl ${
                model === 'GLM'
                  ? 'border-[#5B4DFE] dark:border-[#5B4DFE] ring-2 ring-[#5B4DFE]/40 bg-indigo-50/80 dark:bg-[#5B4DFE]/15 shadow-md'
                  : 'hover:border-slate-400 hover:-translate-y-[1px]'
              }`}
            >
              <div className="relative text-center pb-3 border-b border-slate-200/80 dark:border-white/10 mb-3.5">
                <div className="absolute right-0 top-0">
                  <EduHintTooltip hintKey="glm" />
                </div>
                <h4 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-sans">
                  GLM
                </h4>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                  (General Linear Model)
                </p>
              </div>
              <div className="space-y-2 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-sans font-medium">
                <p>Menguji asosiasi antara SNP dan sifat fenotipe dengan menggunakan kovariat struktur populasi (PC1–PC3) sebagai efek tetap.</p>
                <p className="text-emerald-600 dark:text-emerald-400 font-medium text-xs sm:text-sm mt-2">
                  Komputasi lebih cepat dan sesuai untuk populasi dengan tingkat kekerabatan rendah.
                </p>
              </div>
            </div>

            {/* Model 2: MLM (Single Mutually Exclusive Choice, BR-03) */}
            <div
              role="radio"
              aria-checked={model === 'MLM'}
              tabIndex={0}
              onClick={() => !isLockedDuringCompute && setModel('MLM')}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isLockedDuringCompute) {
                  e.preventDefault();
                  setModel('MLM');
                }
              }}
              className={`glass-subcard p-6 cursor-pointer transition-all duration-200 active:scale-[0.985] rounded-3xl ${
                model === 'MLM'
                  ? 'border-cyan-600 dark:border-[#06B6D4] ring-2 ring-cyan-500/40 bg-cyan-50/80 dark:bg-[#06B6D4]/15 shadow-md'
                  : 'hover:border-slate-400 hover:-translate-y-[1px]'
              }`}
            >
              <div className="relative text-center pb-3 border-b border-slate-200/80 dark:border-white/10 mb-3.5">
                <div className="absolute left-0 top-0">
                  <span className="rounded-full bg-cyan-100 dark:bg-[#06B6D4]/20 border border-cyan-300 dark:border-[#06B6D4]/30 px-2.5 py-0.5 text-[11px] font-bold text-cyan-900 dark:text-[#06B6D4] font-sans">
                    Direkomendasikan
                  </span>
                </div>
                <div className="absolute right-0 top-0">
                  <EduHintTooltip hintKey="mlm" />
                </div>
                <h4 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-sans">
                  MLM
                </h4>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                  (Mixed Linear Model)
                </p>
              </div>
              <div className="space-y-2 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-sans font-medium">
                <p>Menguji asosiasi antara SNP dan sifat fenotipe dengan menggabungkan kovariat struktur populasi (PC1–PC3) sebagai efek tetap dan matriks kekerabatan genetik (Kinship) sebagai efek acak.</p>
                <p className="text-emerald-600 dark:text-emerald-400 font-medium text-xs sm:text-sm mt-2">
                  Lebih sesuai untuk populasi dengan struktur kekerabatan atau hubungan genetik yang kompleks.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Bagian E: Koreksi Multiple Testing & Alpha ── */}
        <div className="figma-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold font-sans">
                E
              </span>
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white font-sans">
                Koreksi Multiple Testing & Ambang Signifikansi
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-sans">Pilih Salah Satu atau Keduanya</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Checkbox Bonferroni */}
            <label className="flex items-start gap-3 glass-subcard p-4 cursor-pointer hover:border-[#5B4DFE] transition-colors">
              <input
                type="checkbox"
                checked={koreksi.includes('bonferroni')}
                onChange={() => handleToggleKoreksi('bonferroni')}
                className="mt-0.5 rounded border-slate-400 dark:border-slate-600 text-[#5B4DFE] focus:ring-[#5B4DFE] h-4 w-4"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-slate-900 dark:text-white font-sans">Bonferroni</span>
                  <EduHintTooltip hintKey="bonferroni" />
                </div>
                <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 font-sans font-medium">Koreksi paling ketat (alpha / total SNP).</p>
              </div>
            </label>

            {/* Checkbox FDR */}
            <label className="flex items-start gap-3 glass-subcard p-4 cursor-pointer hover:border-[#0284C7] transition-colors">
              <input
                type="checkbox"
                checked={koreksi.includes('fdr')}
                onChange={() => handleToggleKoreksi('fdr')}
                className="mt-0.5 rounded border-slate-400 dark:border-slate-600 text-[#0284C7] focus:ring-[#0284C7] h-4 w-4"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-slate-900 dark:text-white font-sans">FDR (Benjamini-Hochberg)</span>
                  <EduHintTooltip hintKey="fdr" />
                </div>
                <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 font-sans font-medium">Koreksi adaptif untuk sifat poligenik.</p>
              </div>
            </label>

            {/* Ambang Alpha Signifikansi dengan Edu-Hint & Interactive Chips */}
            <div className="flex-1 min-w-[260px] p-4 rounded-2xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/90 dark:border-slate-800/90 shadow-sm flex flex-col justify-between backdrop-blur-md">
              <div>
                {/* Header Label + Ikon EDU-HINT (?) */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="alpha" className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 font-sans">
                      Ambang Alpha Signifikansi
                    </label>
                    {/* Tombol Edu-Hint Interaktif (Draggable Floating Panel) */}
                    <EduHintTooltip hintKey="alpha" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
                    α = {isNaN(Number(alpha)) ? '0.05' : Number(alpha).toFixed(2)}
                  </span>
                </div>

                {/* Kotak Input Angka */}
                <div className="relative mb-3">
                  <input
                    id="alpha"
                    type="number"
                    step="any"
                    min="0.0001"
                    max="0.20"
                    value={alpha}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setAlpha(isNaN(val) ? '' : val);
                    }}
                    className="w-full px-3.5 py-2 text-sm sm:text-base font-bold text-center rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-inner focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
                  />
                </div>

                {/* Tombol Kapsul Preset Interaktif Berwarna Jelas (Clickable Chips) */}
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {/* 1. Ketat (Nuansa Biru / Indigo) */}
                  <button
                    type="button"
                    onClick={() => setAlpha(0.01)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-bold border transition-all duration-150 active:scale-95 cursor-pointer ${
                      Number(alpha) === 0.01
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/30 ring-2 ring-blue-400/40'
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60'
                    }`}
                  >
                    0.01 (Ketat)
                  </button>

                  {/* 2. Standar — Default (Nuansa Cyan / Teal) */}
                  <button
                    type="button"
                    onClick={() => setAlpha(0.05)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-bold border transition-all duration-150 active:scale-95 cursor-pointer ${
                      Number(alpha) === 0.05
                        ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-500/30 ring-2 ring-teal-400/40'
                        : 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200/80 dark:bg-teal-950/40 dark:hover:bg-teal-900/50 dark:text-teal-300 dark:border-teal-800/60'
                    }`}
                  >
                    0.05 (Standar — Default)
                  </button>

                  {/* 3. Eksploratori (Nuansa Amber / Oranye / Violet) */}
                  <button
                    type="button"
                    onClick={() => setAlpha(0.10)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-bold border transition-all duration-150 active:scale-95 cursor-pointer ${
                      Number(alpha) === 0.10
                        ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/30 ring-2 ring-amber-400/40'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60'
                    }`}
                  >
                    0.10 (Eksploratori)
                  </button>
                </div>
              </div>

              {/* Keterangan Rentang Nilai Valid */}
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Nilai valid: 0.0001 – 0.20 (Rekomendasi standar: 0.05)
              </p>
            </div>
          </div>
        </div>

        {/* ── Tombol Navigasi Wizard Footer ── */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-white/10">
          <button
            type="button"
            disabled={isSubmitting || isLockedDuringCompute}
            onClick={onPrev}
            className="figma-btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Unggah Berkas</span>
          </button>

          <button
            type="submit"
            disabled={isSubmitting || isLockedDuringCompute}
            className="figma-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Menyimpan & Menyiapkan Komputasi...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-white" />
                <span>Jalankan Analisis GWAS</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
