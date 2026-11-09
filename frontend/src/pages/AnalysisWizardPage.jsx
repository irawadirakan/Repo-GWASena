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
    isSimulated,
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

    // Jangan tindih state lokal jika sedang dalam proses simulasi komputasi aktif
    if (useAnalysisStore.getState().isSimulated && useAnalysisStore.getState().isComputing) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsAccessDenied(false);

    try {
      const data = await analysisService.getAnalysisDetail(id);
      if (data) {
        setCurrentAnalysis(data);

        // Jika analisis sudah selesai, otomatis muat hasil lengkap dan plot asli dari backend
        if (data.status === 'selesai') {
          try {
            const fullResults = await analysisService.getFullAnalysisResults(id);
            useAnalysisStore.getState().setResults(fullResults);
            useAnalysisStore.getState().setIsSimulated(false);
          } catch (rErr) {
            console.warn('Gagal memuat hasil asosiasi sesi selesai:', rErr);
          }
        }
      }
    } catch (err) {
      if (err?.status === 403) {
        setIsAccessDenied(true);
      } else {
        console.warn('Backend detail sesi tidak dapat diakses atau offline:', err);
        // Fallback: pastikan sesi lokal tetap memiliki data dasar yang valid agar tidak crash
        const existing = useAnalysisStore.getState().currentAnalysis;
        if (!existing || (existing.id !== id && existing.analysis_id !== id)) {
          const autoNamed =
            typeof window !== 'undefined' && localStorage.getItem(`gwasena_auto_name_${id}`);
          setCurrentAnalysis({
            analysis_id: id,
            id: id,
            analysis_name: autoNamed ? 'Analisis Tanpa Judul' : `Analisis GWAS #${id}`,
            status: 'draft',
            organism: 'Allium sativum (Bawang Putih)',
          });
        }
        if (err?.status !== 0 && err?.status !== 404 && !isSimulated && !useAnalysisStore.getState().isSimulated) {
          setError(err);
        }
      }
    } finally {
      setIsLoading(false);
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

  // Objek sesi aman dengan fallback null-safety
  const safeSession = currentAnalysis || {
    analysis_id: id || 'local',
    id: id || 'local',
    analysis_name: `Analisis GWAS #${id || ''}`,
    status: 'draft',
    organism: 'Allium sativum (Bawang Putih)',
  };

  const statusKey = safeSession?.status?.toLowerCase() || 'draft';
  const statusConfig = ANALYSIS_STATUSES[statusKey] || ANALYSIS_STATUSES.draft;
  const availableTraits =
    uploadSummary?.fenotipe?.daftar_sifat ||
    uploadSummary?.fenotipe?.sifat_tersedia ||
    safeSession?.sifat_tersedia ||
    [];

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

            {/* Simulation Badge if active */}
            {isSimulated && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:text-amber-300">
                Simulasi UI Aktif
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="glass-subcard px-4 py-2 text-sm flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold shadow-sm">
            <Dna className="h-4 w-4 text-[#0284C7] dark:text-[#06B6D4]" />
            <span>{safeSession?.organism || 'Genomic Association Suite'}</span>
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
            analysisId={id}
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
            analysis={safeSession}
            onNavigateStep={(stepNum) => setActiveStep(stepNum)}
          />
        )}
        </div>
      </ErrorBoundary>
    </div>
  );
}
