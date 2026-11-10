/**
 * Analysis Wizard Store GWASena 2.0
 * Berjalan 100% menggunakan alur API nyata tanpa fallback ke mode simulasi/mock.
 */

import { create } from 'zustand';
import {
  DEFAULT_ANALYSIS_CONFIG,
  detectOrganismClientSide,
  normalizeOrganismCode,
  extractDefaultTraitFromColumns,
  resolveTargetTraitName,
} from '../constants/defaultParams.js';
import { analysisService } from '../services/analysisService.js';

const isLockedStatus = (status) => {
  const s = String(status || '').toLowerCase();
  return s === 'antre' || s === 'berjalan' || s === 'pending' || s === 'running';
};

const isSummaryValid = (uploadSummary) => {
  if (!uploadSummary) return false;
  if (uploadSummary.validation && uploadSummary.validation.is_valid === false) return false;
  if (uploadSummary.validation && uploadSummary.validation.sample_match === false) return false;
  const matchStatus = uploadSummary.kecocokan_sample_id?.status;
  if (matchStatus && String(matchStatus).toLowerCase() !== 'cocok') return false;
  const st = String(uploadSummary.status || '').toLowerCase();
  return Boolean(
    uploadSummary.validation?.is_valid ||
      st === 'tervalidasi' ||
      st === 'success' ||
      matchStatus === 'cocok'
  );
};

const isValidatedUpload = (uploadSummary, analysis) => {
  if (uploadSummary) {
    if (uploadSummary.validation && uploadSummary.validation.is_valid === false) return false;
    if (uploadSummary.validation && uploadSummary.validation.sample_match === false) return false;
    const matchStatus = uploadSummary.kecocokan_sample_id?.status;
    if (matchStatus && String(matchStatus).toLowerCase() !== 'cocok') return false;
  }
  const s = String(analysis?.status || '').toLowerCase();
  if (s === 'tervalidasi' || s === 'antre' || s === 'berjalan' || s === 'selesai' || s === 'completed' || s === 'running' || s === 'pending') {
    return true;
  }
  return isSummaryValid(uploadSummary);
};

export const useAnalysisStore = create((set, get) => ({
  activeStep: 1, // 1: Upload, 2: Config, 3: Compute, 4: Results, 5: Annotation, 6: Export
  currentAnalysis: null,
  uploadSummary: null,
  configParams: { ...DEFAULT_ANALYSIS_CONFIG },
  jobStatus: null,
  results: null,
  isSimulated: false,
  isLoading: false,
  error: null,

  computationStage: 1,
  isComputing: false,
  isCompleted: false,
  isFailed: false,
  progressAnalysisId: null,
  globalProgress: 0,
  stageProgress: { 1: 0, 2: 0, 3: 0, 4: 0 },

  /**
   * State Guard navigasi langkah wizard (BR-01, BR-02, BR-05, AC-10.1)
   */
  setActiveStep: (step) => {
    const target = Math.min(Math.max(step, 1), 6);
    const { isComputing, currentAnalysis, uploadSummary, activeStep } = get();

    // BR-05 / AC-10.1: Kunci perubahan langkah saat komputasi aktif (PENDING / RUNNING)
    if ((isComputing || isLockedStatus(currentAnalysis?.status)) && target !== 3) {
      return activeStep;
    }

    // BR-01 / BR-02: Dilarang melompat ke Langkah >= 2 bila dataset belum tervalidasi / Sample ID tidak cocok
    if (target >= 2 && !isValidatedUpload(uploadSummary, currentAnalysis)) {
      return activeStep;
    }

    // Dilarang melompat ke Langkah >= 4 bila analisis belum selesai
    const s = String(currentAnalysis?.status || '').toLowerCase();
    if (target >= 4 && s !== 'selesai' && s !== 'completed' && s !== 'success' && !get().isCompleted) {
      return activeStep;
    }

    set({ activeStep: target });
    return target;
  },

  setCurrentAnalysis: (analysis, options = {}) => {
    const { preserveStep = false } = options;
    const prevState = get();
    const prevId = prevState.currentAnalysis?.analysis_id || prevState.currentAnalysis?.id;
    const nextId = analysis?.analysis_id || analysis?.id;
    const hydratedTrait = resolveTargetTraitName({
      analysis,
      configParams: prevId && nextId && String(prevId) === String(nextId) ? prevState.configParams : null,
      uploadSummary: prevState.uploadSummary,
    });
    const nextOrg = analysis?.organism
      ? normalizeOrganismCode(analysis.organism)
      : prevState.configParams?.organism;
    const switchedSession = nextId && String(prevState.progressAnalysisId || '') !== String(nextId);
    set({
      currentAnalysis: analysis,
      isSimulated: false,
      ...(switchedSession
        ? {
            progressAnalysisId: nextId,
            globalProgress: 0,
            stageProgress: { 1: 0, 2: 0, 3: 0, 4: 0 },
          }
        : {}),
      configParams: {
        ...prevState.configParams,
        ...(nextOrg ? { organism: nextOrg } : {}),
        ...(hydratedTrait && hydratedTrait !== '—' ? { trait: hydratedTrait } : {}),
      },
    });
    if (analysis?.status) {
      const status = String(analysis.status).toLowerCase();
      if (status === 'draft') {
        set({
          ...(preserveStep ? {} : { activeStep: 1 }),
          isComputing: false,
          isCompleted: false,
          isFailed: false,
          globalProgress: 0,
          stageProgress: { 1: 0, 2: 0, 3: 0, 4: 0 },
        });
      } else if (status === 'tervalidasi') {
        if (!preserveStep && get().activeStep < 2) set({ activeStep: 2 });
        set({
          isComputing: false,
          isCompleted: false,
          globalProgress: 0,
          stageProgress: { 1: 0, 2: 0, 3: 0, 4: 0 },
        });
      } else if (status === 'antre' || status === 'berjalan' || status === 'pending' || status === 'running') {
        set({ activeStep: 3, isComputing: true, isCompleted: false, isFailed: false });
      } else if (status === 'selesai' || status === 'completed' || status === 'success') {
        set({
          isComputing: false,
          isCompleted: true,
          isFailed: false,
          globalProgress: 100,
          stageProgress: { 1: 100, 2: 100, 3: 100, 4: 100 },
        });
        if (!preserveStep && get().activeStep < 4) set({ activeStep: 4 });
      } else if (status === 'gagal' || status === 'failed') {
        set({
          ...(preserveStep ? {} : { activeStep: 3 }),
          isComputing: false,
          isCompleted: false,
          isFailed: true,
        });
      }
    }
  },

  updateAnalysisName: async (name) => {
    const cur = get().currentAnalysis;
    const aid = cur?.analysis_id || cur?.id;
    set((state) => ({
      currentAnalysis: {
        ...(state.currentAnalysis || {}),
        analysis_name: name,
      },
    }));
    if (aid && (typeof aid === 'number' || !String(aid).startsWith('sim-'))) {
      try {
        await analysisService.updateAnalysisName(aid, name);
      } catch (e) {
        console.warn('Gagal menyimpan nama analisis baru ke backend:', e);
      }
    }
  },

  setUploadSummary: (summary) =>
    set((state) => {
      const valid = isSummaryValid(summary);
      const traitsList =
        summary?.sifat_tersedia ||
        summary?.fenotipe?.daftar_sifat ||
        summary?.fenotipe?.sifat_tersedia ||
        [];
      const detectedInfo =
        summary?.detected_organism ||
        (summary?.organism
          ? {
              organism: normalizeOrganismCode(summary.organism),
              auto_detected: Boolean(summary.detected_organism?.auto_detected),
            }
          : detectOrganismClientSide({
              filenames: [
                summary?.genotipe?.nama_berkas,
                summary?.fenotipe?.nama_berkas,
              ],
              traits: traitsList,
            }));
      const resolvedOrg = normalizeOrganismCode(
        detectedInfo?.organism ||
          summary?.organism ||
          state.configParams?.organism ||
          state.currentAnalysis?.organism
      );
      const detectedTrait =
        summary?.trait_name ||
        summary?.trait ||
        extractDefaultTraitFromColumns(traitsList) ||
        '';
      const keepExistingTrait =
        state.configParams?.trait &&
        (traitsList.length === 0 || traitsList.includes(state.configParams.trait));
      const resolvedTrait = keepExistingTrait
        ? state.configParams.trait
        : detectedTrait || state.configParams?.trait || '';
      return {
        uploadSummary: summary,
        isSimulated: false,
        configParams: {
          ...state.configParams,
          organism: resolvedOrg,
          detectedOrganism: detectedInfo,
          ...(resolvedTrait ? { trait: resolvedTrait } : {}),
        },
        currentAnalysis: state.currentAnalysis
          ? {
              ...state.currentAnalysis,
              status: valid ? 'tervalidasi' : state.currentAnalysis.status,
              organism: resolvedOrg,
              detected_organism: detectedInfo,
              ...(resolvedTrait ? { trait_name: resolvedTrait } : {}),
              sifat_tersedia:
                traitsList.length > 0
                  ? traitsList
                  : state.currentAnalysis.sifat_tersedia || [],
            }
          : summary?.analysis_id
          ? {
              analysis_id: summary.analysis_id,
              id: summary.analysis_id,
              analysis_name: 'Analisis GWAS',
              status: valid ? 'tervalidasi' : 'draft',
              organism: resolvedOrg,
              detected_organism: detectedInfo,
              ...(resolvedTrait ? { trait_name: resolvedTrait } : {}),
              sifat_tersedia: traitsList,
            }
          : null,
      };
    }),

  setConfigParams: (params) =>
    set((state) => {
      // Kunci perubahan parameter selama status komputasi RUNNING / ANTRE (BR-05)
      if (state.isComputing || isLockedStatus(state.currentAnalysis?.status)) {
        return state;
      }
      const next =
        typeof params === 'function' ? params(state.configParams) : { ...state.configParams, ...params };
      // BR-03: Pastikan model tunggal (GLM atau MLM) dan PCA otomatis selalu aktif
      const validModel = next.model === 'MLM' ? 'MLM' : 'GLM';
      return {
        configParams: {
          ...next,
          model: validModel,
          n_pc: 3,
        },
      };
    }),

  setJobStatus: (status) => set({ jobStatus: status }),

  setResults: (results) =>
    set({
      results,
      isSimulated: false,
    }),

  setIsSimulated: () => set({ isSimulated: false }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setIsFailed: (isFailed) => set({ isFailed }),

  setComputationStage: (computationStage) => set({ computationStage }),

  ensureProgressAnalysis: (analysisId) =>
    set((state) => {
      if (!analysisId) return state;
      if (String(state.progressAnalysisId || '') === String(analysisId)) return state;
      return {
        progressAnalysisId: analysisId,
        globalProgress: 0,
        stageProgress: { 1: 0, 2: 0, 3: 0, 4: 0 },
      };
    }),

  resetComputationProgress: (analysisId = null) =>
    set({
      progressAnalysisId: analysisId,
      globalProgress: 0,
      stageProgress: { 1: 0, 2: 0, 3: 0, 4: 0 },
    }),

  setGlobalProgress: (incomingPercent, maxCap = 100) =>
    set((state) => {
      const prev = Number(state.globalProgress) || 0;
      const rawIncoming = Number(incomingPercent);
      const safeIncoming = Number.isFinite(rawIncoming)
        ? Math.min(maxCap, Math.max(0, rawIncoming))
        : 0;
      const rounded = Math.round(safeIncoming * 10) / 10;
      const next = Math.max(prev, rounded);
      if (next === prev) return state;
      return { globalProgress: next };
    }),

  setStageProgress: (stageId, incomingPercent, maxCap = 100) =>
    set((state) => {
      const prev = Number(state.stageProgress?.[stageId]) || 0;
      const rawIncoming = Number(incomingPercent);
      const safeIncoming = Number.isFinite(rawIncoming)
        ? Math.min(maxCap, Math.max(0, rawIncoming))
        : 0;
      const rounded = Math.round(safeIncoming * 10) / 10;
      const next = Math.max(prev, rounded);
      if (next === prev) return state;
      return {
        stageProgress: {
          ...state.stageProgress,
          [stageId]: next,
        },
      };
    }),

  /**
   * Eksekusi parameter & pipeline nyata ke backend.
   * Jika terjadi galat apa pun (4xx, 5xx, network error), error dilempar tanpa simulasi palsu.
   */
  runAnalysis: async (analysisId, payload) => {
    if (!analysisId) {
      throw new Error('ID sesi analisis tidak ditemukan. Inisiasi sesi dari Dashboard terlebih dahulu.');
    }

    if (payload) {
      const validModel = payload.model === 'MLM' ? 'MLM' : 'GLM';
      set({
        configParams: {
          ...payload,
          model: validModel,
          n_pc: 3,
        },
      });
    }
    const currentPayload = payload || get().configParams;
    const effectiveTrait =
      currentPayload?.trait ||
      resolveTargetTraitName({
        analysis: get().currentAnalysis,
        configParams: get().configParams,
        uploadSummary: get().uploadSummary,
      });

    await analysisService.saveParameters(analysisId, {
      ...currentPayload,
      ...(effectiveTrait && effectiveTrait !== '—' ? { trait: effectiveTrait } : {}),
      n_pc: 3,
    });
    const res = await analysisService.runAnalysis(analysisId);

    set({
      activeStep: 3,
      isSimulated: false,
      isComputing: true,
      isCompleted: false,
      isFailed: false,
      progressAnalysisId: analysisId,
      globalProgress: 0,
      stageProgress: { 1: 0, 2: 0, 3: 0, 4: 0 },
      error: null,
      jobStatus: res?.status || 'antre',
      currentAnalysis: {
        ...(get().currentAnalysis || {}),
        status: res?.status || 'antre',
        organism: currentPayload?.organism || get().currentAnalysis?.organism,
      },
    });
    return res;
  },

  reset: () =>
    set({
      activeStep: 1,
      currentAnalysis: null,
      uploadSummary: null,
      configParams: { ...DEFAULT_ANALYSIS_CONFIG },
      jobStatus: null,
      results: null,
      isSimulated: false,
      isLoading: false,
      error: null,
      computationStage: 1,
      isComputing: false,
      isCompleted: false,
      isFailed: false,
      progressAnalysisId: null,
      globalProgress: 0,
      stageProgress: { 1: 0, 2: 0, 3: 0, 4: 0 },
    }),
}));
