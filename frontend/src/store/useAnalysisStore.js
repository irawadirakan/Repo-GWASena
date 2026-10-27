/**
 * Analysis Wizard Store GWASena 2.0
 * Acuan: docs/gwasena-v2/USER_FLOW.md & API_INTEGRATION.md
 */

import { create } from 'zustand';
import { DEFAULT_ANALYSIS_CONFIG } from '../constants/defaultParams.js';

export const useAnalysisStore = create((set, get) => ({
  activeStep: 1, // 1: Upload, 2: Config, 3: Compute, 4: Results, 5: Annotation, 6: Export
  currentAnalysis: null,
  uploadSummary: null,
  configParams: { ...DEFAULT_ANALYSIS_CONFIG },
  jobStatus: null,
  results: null,
  isSimulated: false, // Mode Pratinjau UI jika backend 501
  isLoading: false,
  error: null,

  setActiveStep: (step) => set({ activeStep: Math.min(Math.max(step, 1), 6) }),

  setCurrentAnalysis: (analysis) => {
    set({ currentAnalysis: analysis });
    // Sinkronkan activeStep berdasarkan status sesi jika ada
    if (analysis?.status) {
      const status = analysis.status;
      if (status === 'draft') set({ activeStep: 1 });
      else if (status === 'tervalidasi') set({ activeStep: 2 });
      else if (status === 'antre' || status === 'berjalan') set({ activeStep: 3 });
      else if (status === 'selesai') {
        if (get().activeStep < 4) set({ activeStep: 4 });
      }
    }
  },

  setUploadSummary: (summary) => set({ uploadSummary: summary }),

  setConfigParams: (params) =>
    set((state) => ({
      configParams: typeof params === 'function' ? params(state.configParams) : { ...state.configParams, ...params },
    })),

  setJobStatus: (status) => set({ jobStatus: status }),

  setResults: (results) => set({ results }),

  setIsSimulated: (val) => set({ isSimulated: val }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

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
    }),
}));
