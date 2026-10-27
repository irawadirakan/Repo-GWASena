import { useState } from 'react';
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
  Sparkles,
} from 'lucide-react';
import { DEFAULT_ANALYSIS_CONFIG, QC_PARAM_RANGES } from '../../constants/defaultParams.js';
import EduHintTooltip from '../common/EduHintTooltip.jsx';
import ErrorMessageArea from '../common/ErrorMessageArea.jsx';
import { analysisService } from '../../services/analysisService.js';
import { useAnalysisStore } from '../../store/useAnalysisStore.js';

/**
 * S-05: Step2Config (Konfigurasi Parameter QC & Model Asosiasi - Figma Aligned)
 * Modul: M-04, M-05, M-06 (FR-03 s.d. FR-06, BR-03, AC-04.1, AC-05.1, AC-05.2)
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
    setIsSimulated,
    startSimulation,
    runAnalysis,
  } = useAnalysisStore();

  const [trait, setTrait] = useState(
    configParams.trait || (availableTraits.length > 0 ? availableTraits[0] : 'bobot_umbi_g')
  );
  const [mind, setMind] = useState(configParams.qc?.mind ?? 0.10);
  const [geno, setGeno] = useState(configParams.qc?.geno ?? 0.10);
  const [maf, setMaf] = useState(configParams.qc?.maf ?? 0.05);
  const [hwe, setHwe] = useState(configParams.qc?.hwe ?? '1e-6');
  const [kingCutoff, setKingCutoff] = useState(configParams.qc?.king_cutoff ?? 0.177);

  // Model & Koreksi
  const [model, setModel] = useState(configParams.model || 'MLM');
  const [koreksi, setKoreksi] = useState(configParams.koreksi || ['bonferroni', 'fdr']);
  const [alpha, setAlpha] = useState(configParams.alpha ?? 0.05);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [backendNotice501, setBackendNotice501] = useState(null);

  // Toggle metode koreksi (bisa multi-select)
  const handleToggleKoreksi = (method) => {
    if (koreksi.includes(method)) {
      if (koreksi.length === 1) return; // Minimal 1 metode koreksi aktif
      setKoreksi(koreksi.filter((m) => m !== method));
    } else {
      setKoreksi([...koreksi, method]);
    }
  };

  const handleStartAnalysis = async (e, forceSimulation = false) => {
    if (e) e.preventDefault();
    setError(null);
    setBackendNotice501(null);
    setIsSubmitting(true);

    const payload = {
      trait,
      qc: {
        mind: parseFloat(mind),
        geno: parseFloat(geno),
        maf: parseFloat(maf),
        hwe: typeof hwe === 'string' ? parseFloat(hwe) : hwe,
        king_cutoff: parseFloat(kingCutoff),
      },
      n_pc: 3,
      model,
      koreksi,
      alpha: parseFloat(alpha),
    };

    setConfigParams(payload);

    try {
      if (forceSimulation) {
        setIsSubmitting(false);
        startSimulation();
        onRunSuccess?.({ simulated: true });
        return;
      }

      // Eksekusi pipeline melalui store (otomatis picu mock simulation 4 tahap jika tanpa backend)
      const res = await runAnalysis(analysisId, payload);
      setIsSubmitting(false);
      onRunSuccess?.(res);
    } catch (err) {
      setIsSubmitting(false);
      // Mode tanpa backend / HTTP 501 / Network Error:
      // Langsung picu simulasi progres 4 tahap otomatis hingga selesai ke Step 4
      console.warn('Backend tidak tersedia atau belum terintegrasi, menjalankan mock simulation otomatis:', err);
      startSimulation();
      onRunSuccess?.({ simulated: true });
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

      <ErrorMessageArea error={error} onDismiss={() => setError(null)} />

      {/* Banner 501 Transparan & Opsi Simulasi UI */}
      {backendNotice501 && (
        <div className="rounded-3xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-5 sm:p-6 backdrop-blur-md animate-fade-in space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Pemberitahuan Transparansi Pipeline (HTTP 501)
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {backendNotice501}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-amber-200 dark:border-amber-500/20">
            <button
              type="button"
              onClick={(e) => handleStartAnalysis(e, true)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 px-4 py-2 text-xs font-bold text-slate-950 shadow-md transition-all active:scale-[0.99]"
            >
              <Sparkles className="h-4 w-4" />
              <span>Buka Pratinjau Alur Komputasi & Visualisasi UI</span>
            </button>
            <span className="text-[11px] text-slate-600 dark:text-slate-400">
              (Menampilkan antarmuka Langkah 3 s.d. 6 dengan penanda simulasi yang jelas)
            </span>
          </div>
        </div>
      )}

      <form onSubmit={(e) => handleStartAnalysis(e, false)} className="space-y-8">
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

        {/* ── Bagian B: Parameter Quality Control (M-04) ── */}
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
            {/* 1. Missingness per Sampel (mind) */}
            <div className="space-y-2 glass-subcard p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="mind" className="text-xs font-bold text-slate-900 dark:text-white font-sans">
                    Missingness Sampel (mind)
                  </label>
                  <EduHintTooltip hintKey="mind" />
                </div>
                <span className="font-mono text-xs font-bold text-[#5B4DFE] dark:text-[#06B6D4] tabular-nums">
                  {mind}
                </span>
              </div>
              <input
                id="mind"
                type="range"
                min={QC_PARAM_RANGES.mind.min}
                max={QC_PARAM_RANGES.mind.max}
                step={QC_PARAM_RANGES.mind.step}
                value={mind}
                onChange={(e) => setMind(e.target.value)}
                className="w-full accent-[#5B4DFE] dark:accent-[#06B6D4] cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-sans">
                Default: 0.10 (buang sampel dengan missing data &gt; 10%)
              </span>
            </div>

            {/* 2. Missingness per SNP (geno) */}
            <div className="space-y-2 glass-subcard p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="geno" className="text-xs font-bold text-slate-900 dark:text-white font-sans">
                    Missingness SNP (geno)
                  </label>
                  <EduHintTooltip hintKey="geno" />
                </div>
                <span className="font-mono text-xs font-bold text-[#5B4DFE] dark:text-[#06B6D4] tabular-nums">
                  {geno}
                </span>
              </div>
              <input
                id="geno"
                type="range"
                min={QC_PARAM_RANGES.geno.min}
                max={QC_PARAM_RANGES.geno.max}
                step={QC_PARAM_RANGES.geno.step}
                value={geno}
                onChange={(e) => setGeno(e.target.value)}
                className="w-full accent-[#5B4DFE] dark:accent-[#06B6D4] cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-sans">
                Default: 0.10 (buang SNP yang hilang pada &gt; 10% populasi)
              </span>
            </div>

            {/* 3. Minor Allele Frequency (maf) */}
            <div className="space-y-2 glass-subcard p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="maf" className="text-xs font-bold text-slate-900 dark:text-white font-sans">
                    Minor Allele Frequency (maf)
                  </label>
                  <EduHintTooltip hintKey="maf" />
                </div>
                <span className="font-mono text-xs font-bold text-[#5B4DFE] dark:text-[#06B6D4] tabular-nums">
                  {maf}
                </span>
              </div>
              <input
                id="maf"
                type="range"
                min={QC_PARAM_RANGES.maf.min}
                max={QC_PARAM_RANGES.maf.max}
                step={QC_PARAM_RANGES.maf.step}
                value={maf}
                onChange={(e) => setMaf(e.target.value)}
                className="w-full accent-[#5B4DFE] dark:accent-[#06B6D4] cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-sans">
                Default: 0.05 (saring varian langka &lt; 5%)
              </span>
            </div>

            {/* 4. Relatedness / Kinship Cutoff (king_cutoff) */}
            <div className="space-y-2 glass-subcard p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="king" className="text-xs font-bold text-slate-900 dark:text-white font-sans">
                    Kinship Cutoff KING
                  </label>
                  <EduHintTooltip hintKey="king_cutoff" />
                </div>
                <span className="font-mono text-xs font-bold text-[#5B4DFE] dark:text-[#06B6D4] tabular-nums">
                  {kingCutoff}
                </span>
              </div>
              <input
                id="king"
                type="range"
                min={QC_PARAM_RANGES.king_cutoff.min}
                max={QC_PARAM_RANGES.king_cutoff.max}
                step={QC_PARAM_RANGES.king_cutoff.step}
                value={kingCutoff}
                onChange={(e) => setKingCutoff(e.target.value)}
                className="w-full accent-[#5B4DFE] dark:accent-[#06B6D4] cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-sans">
                Default: 0.177 (hubungan derajat pertama / klon kembar)
              </span>
            </div>

            {/* 5. Hardy-Weinberg Equilibrium (hwe) - Input khusus dengan catatan agronomi */}
            <div className="md:col-span-2 space-y-2 glass-subcard p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="hwe" className="text-xs font-bold text-slate-900 dark:text-white font-sans">
                    Ambang Batas HWE p-value (hwe)
                  </label>
                  <EduHintTooltip hintKey="hwe" />
                </div>
                <input
                  id="hwe"
                  type="text"
                  value={hwe}
                  onChange={(e) => setHwe(e.target.value)}
                  className="w-28 font-mono text-xs font-bold text-[#5B4DFE] dark:text-[#06B6D4] bg-white dark:bg-[#121B38] rounded-xl border border-slate-300 dark:border-white/10 px-3 py-1.5 text-right focus:outline-none focus:border-[#5B4DFE]"
                />
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span className="font-serif leading-relaxed">
                  <strong>Catatan Khusus Bawang Putih:</strong> Tanaman bawang putih (<span className="italic font-bold">Allium sativum</span> L.) umumnya diperbanyak secara vegetatif (klonal), sehingga penyimpangan HWE sering terjadi secara alami. Dianjurkan menggunakan ambang longgar (<code>1e-6</code>) agar varian penting tidak terbuang.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bagian C: PCA Otomatis (M-05, FR-04, AC-04.1) ── */}
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
              Otomatis & Wajib (FR-04)
            </span>
          </div>

          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
            Principal Component Analysis (PCA) dijalankan secara otomatis setelah tahap QC untuk
            menghasilkan <strong>3 komponen utama (PC1–PC3)</strong> sebagai kovariat struktur populasi.
            Tahap ini <strong>tidak dapat dilewati</strong> demi mencegah temuan asosiasi positif palsu akibat stratifikasi geografis aksesi.
          </p>
        </div>

        {/* ── Bagian D: Pemilihan Model Asosiasi (M-06, FR-05, BR-03, AC-05.1) ── */}
        <div className="figma-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#06B6D4]/15 text-[#06B6D4] text-xs font-bold font-sans">
                D
              </span>
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white font-sans">
                Model Uji Asosiasi (Pilih Tepat Satu - BR-03)
              </h3>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">Aturan Bisnis BR-03</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model 1: GLM */}
            <div
              onClick={() => setModel('GLM')}
              className={`glass-subcard p-5 cursor-pointer transition-all duration-150 active:scale-[0.985] ${
                model === 'GLM'
                  ? 'border-[#5B4DFE] dark:border-[#5B4DFE] ring-2 ring-[#5B4DFE]/40 bg-indigo-50/80 dark:bg-[#5B4DFE]/15'
                  : 'hover:border-slate-400 hover:-translate-y-[1px]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="model"
                    value="GLM"
                    checked={model === 'GLM'}
                    onChange={() => setModel('GLM')}
                    className="accent-[#5B4DFE] h-4 w-4 cursor-pointer"
                  />
                  <span className="text-base font-bold text-slate-900 dark:text-white font-sans">GLM</span>
                </div>
                <EduHintTooltip hintKey="glm" />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                General Linear Model. Menguji asosiasi dengan kovariat PC dari PCA. Komputasi cepat,
                cocok untuk populasi tanpa struktur kekerabatan yang kompleks.
              </p>
            </div>

            {/* Model 2: MLM (Rekomendasi Bawang Putih) */}
            <div
              onClick={() => setModel('MLM')}
              className={`glass-subcard p-5 cursor-pointer transition-all duration-150 active:scale-[0.985] ${
                model === 'MLM'
                  ? 'border-cyan-600 dark:border-[#06B6D4] ring-2 ring-cyan-500/40 bg-cyan-50/80 dark:bg-[#06B6D4]/15'
                  : 'hover:border-slate-400 hover:-translate-y-[1px]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="model"
                    value="MLM"
                    checked={model === 'MLM'}
                    onChange={() => setModel('MLM')}
                    className="accent-[#06B6D4] h-4 w-4 cursor-pointer"
                  />
                  <span className="text-base font-bold text-slate-900 dark:text-white font-sans">MLM</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-cyan-100 dark:bg-[#06B6D4]/20 border border-cyan-300 dark:border-[#06B6D4]/30 px-2.5 py-0.5 text-[10px] font-bold text-cyan-900 dark:text-[#06B6D4] font-sans">
                    Direkomendasikan
                  </span>
                  <EduHintTooltip hintKey="mlm" />
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                Mixed Linear Model. Menggabungkan kovariat PCA (efek tetap) DAN matriks kekerabatan
                genetik / <em>Kinship</em> (efek acak). Sangat direkomendasikan untuk tanaman klonal bawang putih.
              </p>
              {model === 'MLM' && (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 animate-fade-down">
                  <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5] animate-pop-in" />
                  <span>Matriks Kinship disertakan secara otomatis (AC-05.2)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bagian E: Koreksi Multiple Testing & Alpha (M-06, FR-06) ── */}
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
            <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">Pengendalian Positif Palsu</span>
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
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-sans">Bonferroni</span>
                  <EduHintTooltip hintKey="bonferroni" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">Koreksi paling ketat (alpha / total SNP).</p>
              </div>
            </label>

            {/* Checkbox FDR */}
            <label className="flex items-start gap-3 glass-subcard p-4 cursor-pointer hover:border-[#5B4DFE] transition-colors">
              <input
                type="checkbox"
                checked={koreksi.includes('fdr')}
                onChange={() => handleToggleKoreksi('fdr')}
                className="mt-0.5 rounded border-slate-400 dark:border-slate-600 text-[#5B4DFE] focus:ring-[#5B4DFE] h-4 w-4"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-sans">FDR (Benjamini-Hochberg)</span>
                  <EduHintTooltip hintKey="fdr" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">Koreksi adaptif untuk sifat poligenik.</p>
              </div>
            </label>

            {/* Input Alpha */}
            <div className="glass-subcard p-4 space-y-1.5">
              <label htmlFor="alpha" className="block text-xs font-bold text-slate-900 dark:text-white font-sans">
                Ambang Alpha Signifikansi
              </label>
              <input
                id="alpha"
                type="number"
                min={0.001}
                max={0.1}
                step={0.005}
                value={alpha}
                onChange={(e) => setAlpha(e.target.value)}
                className="w-full font-mono text-xs font-bold text-slate-900 dark:text-[#06B6D4] bg-white dark:bg-[#121B38] rounded-xl border border-slate-300 dark:border-white/10 py-2 px-3 focus:outline-none focus:border-[#5B4DFE]"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">Default standar riset: 0.05</span>
            </div>
          </div>
        </div>

        {/* ── Tombol Navigasi Wizard Footer ── */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={onPrev}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#162142] px-5 py-3 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1E2C58] hover:-translate-y-[1px] hover:shadow-md active:scale-[0.97] active:brightness-95 transition-all duration-100 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Unggah Berkas</span>
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#5B4DFE] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-[#5B4DFE]/30 hover:bg-[#4F46E5] hover:-translate-y-[1px] hover:shadow-xl active:scale-[0.97] active:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#5B4DFE]/50 transition-all duration-100 disabled:opacity-60 disabled:transform-none disabled:shadow-none"
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
