import { Check, Lock, ChevronRight } from 'lucide-react';
import { WIZARD_STEPS } from '../../constants/defaultParams.js';

/**
 * WizardStepper - Interactive Pipeline Flow Bar (Figma Design Aligned)
 * Menampilkan alur mengalir interaktif:
 * Unggah & Validasi ⟶ Konfigurasi QC & Model ⟶ Komputasi Pipeline ⟶ Hasil & Visualisasi ⟶ Anotasi Gen ⟶ Ekspor & Laporan
 * Bebas kata kaku "Langkah 1, 2, dst." dan dapat diklik bebas untuk tahap yang telah terbuka.
 */
export default function WizardStepper({ activeStep, onStepClick, status }) {
  const isLockedDuringCompute = status === 'antre' || status === 'berjalan';
  const isFinished = status === 'selesai';
  const isTervalidasi = status === 'tervalidasi';

  // Tentukan apakah sebuah tahap dapat diklik
  const isStepClickable = (stepNum) => {
    if (isLockedDuringCompute) return false;
    if (isFinished) {
      // Saat selesai, tahap 4, 5, 6 dapat diklik bebas dua arah, serta tahap 1 & 2
      return true;
    }
    if (isTervalidasi) {
      return stepNum === 1 || stepNum === 2;
    }
    return stepNum === 1;
  };

  return (
    <div className="w-full space-y-2">
      {/* ── Tampilan Mobile (< 1024px): Indikator Alur Ringkas ── */}
      <div className="lg:hidden figma-pill-stepper p-4 space-y-2 flex-col">
        <div className="flex items-center justify-between text-sm w-full">
          <span className="font-bold font-sans text-slate-900 dark:text-[#22D3EE] tracking-tight">
            {WIZARD_STEPS[activeStep - 1]?.label}
          </span>
          <span className="text-slate-700 dark:text-slate-300 text-xs font-mono font-bold">
            Tahap {activeStep} / 6 ({Math.round((activeStep / 6) * 100)}%)
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#0284C7] to-[#06B6D4] transition-all duration-300"
            style={{ width: `${(activeStep / 6) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Tampilan Desktop (>= 1024px): Interactive Pipeline Flow Bar ── */}
      <div className="hidden lg:block w-full figma-pill-stepper px-4 py-3">
        <ol className="flex items-center justify-between w-full" aria-label="Alur Pipeline Analisis GWAS">
          {WIZARD_STEPS.map((s, idx) => {
            const stepNum = s.step;
            const isActive = activeStep === stepNum;
            const isCompleted = stepNum < activeStep || (isFinished && stepNum <= 3);
            const clickable = isStepClickable(stepNum);

            return (
              <li key={s.id} className="flex-1 flex items-center last:flex-none">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onStepClick?.(stepNum)}
                  className={`group inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm transition-all text-left ${
                    isActive
                      ? 'font-bold cursor-default bg-cyan-100/90 dark:bg-[#06B6D4]/15 border border-cyan-400 dark:border-cyan-500/40 shadow-sm'
                      : clickable
                      ? 'hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/15 active:scale-95 transition-all duration-100 cursor-pointer'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                  title={clickable ? `Pindah ke ${s.label}` : 'Tahap belum terbuka'}
                >
                  {/* Node Circle Indicator */}
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs transition-all ${
                      isActive
                        ? 'bg-[#06B6D4] text-white dark:text-[#0B132C] font-extrabold ring-4 ring-[#06B6D4]/25 shadow-md shadow-[#06B6D4]/30'
                        : isCompleted
                        ? 'bg-emerald-600 dark:bg-[#0284C7] text-white shadow-sm'
                        : isLockedDuringCompute
                        ? 'bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/15 text-slate-500 dark:text-slate-400'
                        : 'bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-300 group-hover:border-slate-400'
                    }`}
                  >
                    {isCompleted && !isActive ? (
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    ) : isLockedDuringCompute && stepNum !== activeStep ? (
                      <Lock className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    ) : (
                      <span className="font-bold">{stepNum}</span>
                    )}
                  </div>

                  {/* Label Tahap */}
                  <span
                    className={`whitespace-nowrap text-xs tracking-tight ${
                      isActive
                        ? 'text-slate-900 dark:text-[#22D3EE] font-extrabold'
                        : isCompleted
                        ? 'text-emerald-800 dark:text-slate-200 font-bold group-hover:text-blue-600 dark:group-hover:text-[#06B6D4]'
                        : 'text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    {s.label}
                  </span>
                </button>

                {/* Connecting Arrow Flow Between Nodes */}
                {idx < WIZARD_STEPS.length - 1 && (
                  <div className="flex items-center px-1 text-slate-300 dark:text-white/20 shrink-0">
                    <ChevronRight
                      className={`h-4 w-4 ${
                        stepNum < activeStep || (isFinished && stepNum <= 3)
                          ? 'text-[#0284C7] dark:text-[#06B6D4]'
                          : 'text-slate-300 dark:text-white/20'
                      }`}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {/* Banner Kunci Selama Komputasi */}
        {isLockedDuringCompute && (
          <div className="mt-2.5 flex items-center justify-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 px-3 py-1.5 text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-300">
            <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Tahap lain terkunci untuk menjaga integritas data selama komputasi berlangsung.</span>
          </div>
        )}
      </div>
    </div>
  );
}
