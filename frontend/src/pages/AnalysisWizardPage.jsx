import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Dna,
} from 'lucide-react';
import { analysisService } from '../services/analysisService.js';
import { useAnalysisStore } from '../store/useAnalysisStore.js';
import { ANALYSIS_STATUSES, getOrganismMeta, resolveTargetTraitName } from '../constants/defaultParams.js';
import WizardStepper from '../components/wizard/WizardStepper.jsx';
import Step1Upload from '../components/wizard/Step1Upload.jsx';
import Step2Config from '../components/wizard/Step2Config.jsx';
import Step3Computation from '../components/wizard/Step3Computation.jsx';
import Step4Results from '../components/wizard/Step4Results.jsx';
import Step5Annotation from '../components/wizard/Step5Annotation.jsx';
import Step6Export from '../components/wizard/Step6Export.jsx';
import AccessDeniedState from '../components/common/AccessDeniedState.jsx';
import ErrorMessageArea from '../components/common/ErrorMessageArea.jsx';
import ErrorBoundary from '../components/common/ErrorBoundary.jsx';

/**
 * AnalysisWizardPage - Kontainer Orkestrasi Sesi Analisis GWAS (Figma Aligned)
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
    configParams,
  } = useAnalysisStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  // Proteksi null-safety terhadap rute tidak valid / undefined
  useEffect(() => {
    if (!id || id === 'undefined' || id === 'null') {
      console.warn('ID sesi tidak valid, mengalihkan ke dashboard...');
      navigate('/dashboard', { replace: true });
    }
  }, [id, navigate]);

  async function loadAnalysis() {
    if (!id || id === 'undefined' || id === 'null') {
      setIsLoading(false);
      return;
    }

    const store = useAnalysisStore.getState();
    const prevId = store.currentAnalysis?.analysis_id || store.currentAnalysis?.id;
    const summaryId = store.uploadSummary?.analysis_id;
    if ((prevId && String(prevId) !== String(id)) || (summaryId && String(summaryId) !== String(id))) {
      store.reset();
    }

    setIsLoading(true);
    setError(null);
    setIsAccessDenied(false);

    try {
      const data = await analysisService.getAnalysisDetail(id);
      if (data) {
        setCurrentAnalysis(data);

        if (String(data.status || '').toLowerCase() === 'selesai') {
          try {
            const fullResults = await analysisService.getFullAnalysisResults(id);
            useAnalysisStore.getState().setResults(fullResults);
          } catch (rErr) {
            setError(rErr);
          }
        }
      }
    } catch (err) {
      if (err?.status === 403) {
        setIsAccessDenied(true);
      } else {
        setError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshAnalysisQuiet(targetId = id) {
    if (!targetId || targetId === 'undefined' || targetId === 'null') return;
    try {
      const data = await analysisService.getAnalysisDetail(targetId);
      if (data) {
        setCurrentAnalysis(data, { preserveStep: true });
        if (String(data.status || '').toLowerCase() === 'selesai') {
          const fullResults = await analysisService.getFullAnalysisResults(targetId);
          useAnalysisStore.getState().setResults(fullResults);
        }
      }
    } catch (err) {
      setError(err);
    }
  }

  useEffect(() => {
    if (id && id !== 'undefined' && id !== 'null') {
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

  if (!currentAnalysis && error) {
    return (
      <div className="space-y-4 py-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Dashboard</span>
        </Link>
        <ErrorMessageArea error={error} />
      </div>
    );
  }

  const safeSession = currentAnalysis || {
    analysis_id: id,
    id: id,
    analysis_name: `Analisis GWAS #${id || ''}`,
    status: 'draft',
    organism: 'Allium sativum (Bawang Putih)',
  };

  const statusKey = safeSession?.status?.toLowerCase() || 'draft';
  const statusConfig = ANALYSIS_STATUSES[statusKey] || ANALYSIS_STATUSES.draft;
  const resolvedSessionTrait = resolveTargetTraitName({
    analysis: safeSession,
    configParams,
    uploadSummary,
  });
  const enrichedSession =
    resolvedSessionTrait && resolvedSessionTrait !== '—'
      ? { ...safeSession, trait_name: resolvedSessionTrait, trait: resolvedSessionTrait }
      : safeSession;
  const availableTraits =
    uploadSummary?.fenotipe?.daftar_sifat ||
    uploadSummary?.fenotipe?.sifat_tersedia ||
    safeSession?.sifat_tersedia ||
    [];

  return (
    <div className="space-y-6 pb-16 animate-fade-in">

      {/* ── Top Session Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
            <span className="text-slate-400 dark:text-slate-500 font-bold">/</span>
            <span className="font-mono text-sm text-[#0284C7] dark:text-[#06B6D4] font-bold">Sesi #{id}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {safeSession?.analysis_name || `Analisis GWAS #${id}`}
            </h1>

            {/* Badge Status */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusConfig.badgeClass}`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: statusConfig.color }}
              />
              {statusConfig.label}
            </span>


          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="glass-subcard px-4 py-2 text-sm flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold shadow-sm">
            <Dna className="h-4 w-4 text-[#0284C7] dark:text-[#06B6D4]" />
            <span>
              {safeSession?.organism
                ? getOrganismMeta(safeSession.organism).label
                : 'Genomic Association Suite'}
            </span>
          </div>
        </div>
      </div>

      <ErrorMessageArea error={error} onDismiss={() => setError(null)} />

      {/* ── Wizard Stepper 6 Langkah (Figma Unified Pill) ── */}
      <WizardStepper
        activeStep={activeStep}
        onStepClick={(stepNum) => setActiveStep(stepNum)}
        status={safeSession?.status}
      />

      {/* ── Konten Langkah Aktif dengan Proteksi Error Boundary Lokal ── */}
      <ErrorBoundary key={activeStep}>
        <div
          className="figma-card p-6 sm:p-8 animate-step-transition"
        >
        {activeStep === 1 && (
          <Step1Upload
            analysisId={id}
            onUploadSuccess={(res) => {
              setUploadSummary(res);
              refreshAnalysisQuiet(res?.analysis_id || id);
            }}
            onNext={() => setActiveStep(2)}
          />
        )}

        {activeStep === 2 && (
          <Step2Config
            analysisId={id}
            availableTraits={availableTraits}
            onPrev={() => setActiveStep(1)}
            onRunSuccess={() => {
              setActiveStep(3);
              refreshAnalysisQuiet(id);
            }}
          />
        )}

        {activeStep === 3 && (
          <Step3Computation
            analysisId={id}
            analysis={enrichedSession}
            onComplete={() => {
              setActiveStep(4);
              refreshAnalysisQuiet(id);
            }}
          />
        )}

        {activeStep === 4 && (
          <Step4Results
            analysisId={id}
            analysis={enrichedSession}
            onNavigateStep={(stepNum) => setActiveStep(stepNum)}
          />
        )}

        {activeStep === 5 && (
          <Step5Annotation
            analysisId={id}
            onNavigateStep={(stepNum) => setActiveStep(stepNum)}
          />
        )}

        {activeStep === 6 && (
          <Step6Export
            analysisId={id}
            analysis={enrichedSession}
            onNavigateStep={(stepNum) => setActiveStep(stepNum)}
          />
        )}
        </div>
      </ErrorBoundary>
    </div>
  );
}
