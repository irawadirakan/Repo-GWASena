import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Dna,
} from 'lucide-react';
import { analysisService } from '../services/analysisService.js';
import { useAnalysisStore } from '../store/useAnalysisStore.js';
import { ANALYSIS_STATUSES } from '../constants/defaultParams.js';
import WizardStepper from '../components/wizard/WizardStepper.jsx';
import Step1Upload from '../components/wizard/Step1Upload.jsx';
import Step2Config from '../components/wizard/Step2Config.jsx';
import Step3Computation from '../components/wizard/Step3Computation.jsx';
import Step4Results from '../components/wizard/Step4Results.jsx';
import Step5Annotation from '../components/wizard/Step5Annotation.jsx';
import Step6Export from '../components/wizard/Step6Export.jsx';
import AccessDeniedState from '../components/common/AccessDeniedState.jsx';
import ErrorMessageArea from '../components/common/ErrorMessageArea.jsx';

/**
 * AnalysisWizardPage - Kontainer Orkestrasi Sesi Analisis GWAS (S-04 s.d. S-09) (Figma Aligned)
 * Acuan: 04c — Unggah_ Valid (Boleh Lanjut).png & 06 — Komputasi_ QC Berjalan.png
 */
export default function AnalysisWizardPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    activeStep,
    setActiveStep,
    currentAnalysis,
    setCurrentAnalysis,
    uploadSummary,
    setUploadSummary,
    isSimulated,
  } = useAnalysisStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  async function loadAnalysis() {
    // Jangan tindih state lokal jika sedang dalam proses simulasi komputasi aktif
    if (useAnalysisStore.getState().isSimulated && useAnalysisStore.getState().isComputing) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsAccessDenied(false);

    try {
      const data = await analysisService.getAnalysisDetail(id);
      setCurrentAnalysis(data);
    } catch (err) {
      if (err.status === 403) {
        setIsAccessDenied(true);
      } else if (isSimulated || useAnalysisStore.getState().isSimulated) {
        console.warn('Backend tidak tersedia dalam mode simulasi, mempertahankan sesi lokal:', err);
      } else {
        setError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      loadAnalysis();
    }
  }, [id]);

  if (isAccessDenied) {
    return <AccessDeniedState analysisId={id} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-[#06B6D4] mb-2" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Memuat sesi analisis #{id}...</p>
      </div>
    );
  }

  const statusKey = currentAnalysis?.status?.toLowerCase() || 'draft';
  const statusConfig = ANALYSIS_STATUSES[statusKey] || ANALYSIS_STATUSES.draft;
  const availableTraits =
    uploadSummary?.fenotipe?.sifat_tersedia || currentAnalysis?.sifat_tersedia || [];

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* ── Banner Mode Simulasi (Poin #2) ── */}
      {isSimulated && (
        <div className="rounded-2xl border-2 border-amber-500 bg-amber-400/20 text-amber-950 dark:text-amber-200 p-4 text-center font-bold text-sm sm:text-base shadow-lg animate-pulse flex items-center justify-center gap-2">
          <span>⚠️ MODE SIMULASI — Bukan hasil analisis asli (Backend tidak terhubung)</span>
        </div>
      )}

      {/* ── Top Session Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </Link>
            <span className="text-slate-400 dark:text-slate-500">/</span>
            <span className="font-mono text-xs text-cyan-700 dark:text-[#06B6D4] font-semibold">Sesi #{id}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {currentAnalysis?.analysis_name || `Analisis GWAS #${id}`}
            </h1>

            {/* Badge Status */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold ${statusConfig.badgeClass}`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: statusConfig.color }}
              />
              {statusConfig.label}
            </span>

            {/* Simulation Badge if active */}
            {isSimulated && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                Simulasi UI Aktif
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="glass-subcard px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-serif italic font-medium text-slate-700 dark:text-slate-300">
              {currentAnalysis?.organism || 'Allium sativum L.'}
            </span>{' '}
            <span className="text-[11px] font-sans">(2n=16)</span>
          </div>
        </div>
      </div>

      <ErrorMessageArea error={error} onDismiss={() => setError(null)} />

      {/* ── Wizard Stepper 6 Langkah (Figma Unified Pill) ── */}
      <WizardStepper
        activeStep={activeStep}
        onStepClick={(stepNum) => setActiveStep(stepNum)}
        status={currentAnalysis?.status}
      />

      {/* ── Konten Langkah Aktif (3-Layer High Separation Glass) ── */}
      <div
        key={activeStep}
        className="figma-card p-6 sm:p-8 animate-step-transition"
      >
        {activeStep === 1 && (
          <Step1Upload
            analysisId={id}
            onUploadSuccess={(res) => {
              setUploadSummary(res);
              if (!res?.simulated && !isSimulated && !useAnalysisStore.getState().isSimulated) {
                loadAnalysis(); // Muat ulang data sesi dari backend jika bukan mode simulasi/offline
              }
            }}
            onNext={() => setActiveStep(2)}
          />
        )}

        {activeStep === 2 && (
          <Step2Config
            analysisId={id}
            availableTraits={availableTraits}
            onPrev={() => setActiveStep(1)}
            onRunSuccess={(res) => {
              setActiveStep(3);
              if (!res?.simulated && !isSimulated && !useAnalysisStore.getState().isSimulated) {
                loadAnalysis();
              }
            }}
          />
        )}

        {activeStep === 3 && (
          <Step3Computation
            analysisId={id}
            onComplete={() => {
              setActiveStep(4);
              if (!isSimulated && !useAnalysisStore.getState().isSimulated) {
                loadAnalysis();
              }
            }}
          />
        )}

        {activeStep === 4 && (
          <Step4Results
            onNavigateStep={(stepNum) => setActiveStep(stepNum)}
          />
        )}

        {activeStep === 5 && (
          <Step5Annotation
            onNavigateStep={(stepNum) => setActiveStep(stepNum)}
          />
        )}

        {activeStep === 6 && (
          <Step6Export
            analysisId={id}
            onNavigateStep={(stepNum) => setActiveStep(stepNum)}
          />
        )}
      </div>
    </div>
  );
}
