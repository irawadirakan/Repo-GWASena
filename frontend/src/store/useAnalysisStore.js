/**
 * Analysis Wizard Store GWASena 2.0
 * Acuan: docs/gwasena-v2/USER_FLOW.md & API_INTEGRATION.md
 */

import { create } from 'zustand';
import { DEFAULT_ANALYSIS_CONFIG } from '../constants/defaultParams.js';
import { generateBenchmarkResults } from '../services/mockResults.js';
import { analysisService } from '../services/analysisService.js';

export const MOCK_GARLIC_DATASET_SUMMARY = {
  status: 'valid',
  pesan: 'Validasi dataset berhasil! 100% Sample ID cocok (25 sampel Allium sativum lolos).',
  genotipe: {
    nama_berkas: 'garlic_benchmark.vcf',
    format: 'VCF v4.2',
    jumlah_sampel: 25,
    jumlah_snp: 500,
    varian_dilewati: { multialelik: 12 },
  },
  fenotipe: {
    nama_berkas: 'phenotype_weight.csv',
    jumlah_sampel: 25,
    varietas_tercatat: 25,
    sifat_tersedia: ['bobot_umbi_g', 'diameter_umbi_mm', 'jumlah_siung'],
  },
  kecocokan_sample_id: {
    persentase_kecocokan: 100,
    jumlah_sampel_cocok: 25,
    status: 'cocok',
  },
  integritas: {
    kesamaan_sampel: '100%',
    sampel_cocok: 25,
    kelengkapan: '100%',
    vcf_valid: true,
    csv_valid: true,
  },
  simulated: true,
};

export const useAnalysisStore = create((set, get) => ({
  activeStep: 1, // 1: Upload, 2: Config, 3: Compute, 4: Results, 5: Annotation, 6: Export
  currentAnalysis: null,
  uploadSummary: null,
  configParams: { ...DEFAULT_ANALYSIS_CONFIG },
  jobStatus: null,
  results: null,
  isSimulated: false, // Mode Pratinjau UI jika backend 501 / tanpa backend
  isLoading: false,
  error: null,

  // State simulasi komputasi Step 3
  computationStage: 1,
  isComputing: false,
  isCompleted: false,
  isFailed: false,
  simulationTimeoutIds: [],

  setActiveStep: (step) => set({ activeStep: Math.min(Math.max(step, 1), 6) }),

  setCurrentAnalysis: (analysis) => {
    set({ currentAnalysis: analysis });
    // Sinkronkan activeStep berdasarkan status sesi jika ada,
    // asalkan tidak sedang dalam simulasi komputasi aktif
    if (!get().isSimulated && !get().isComputing && analysis?.status) {
      const status = analysis.status;
      if (status === 'draft') set({ activeStep: 1 });
      else if (status === 'tervalidasi') set({ activeStep: 2 });
      else if (status === 'antre' || status === 'berjalan') {
        if (get().activeStep < 3) set({ activeStep: 3 });
      } else if (status === 'selesai') {
        if (get().activeStep < 4) set({ activeStep: 4 });
      }
    }
  },

  setUploadSummary: (summary) =>
    set((state) => ({
      uploadSummary: summary,
      currentAnalysis: {
        ...(state.currentAnalysis || {
          id: 'sim-garlic-01',
          analysis_name: 'Simulasi GWAS Allium sativum L.',
          organism: 'Allium sativum L.',
        }),
        status: summary ? 'tervalidasi' : state.currentAnalysis?.status || 'draft',
        sifat_tersedia:
          summary?.fenotipe?.sifat_tersedia ||
          state.currentAnalysis?.sifat_tersedia ||
          ['bobot_umbi_g', 'diameter_umbi_mm', 'jumlah_siung'],
      },
    })),

  // Memuat data contoh benchmark Allium sativum L. secara instan 1-klik
  loadMockGarlicDataset: () => {
    const summary = { ...MOCK_GARLIC_DATASET_SUMMARY };
    set((state) => ({
      uploadSummary: summary,
      isSimulated: true,
      currentAnalysis: {
        ...(state.currentAnalysis || {
          id: 'sim-garlic-01',
          analysis_name: 'Simulasi GWAS Allium sativum L.',
          organism: 'Allium sativum L.',
        }),
        status: 'tervalidasi',
        sifat_tersedia: summary.fenotipe.sifat_tersedia,
      },
    }));
    return summary;
  },

  setConfigParams: (params) =>
    set((state) => ({
      configParams: typeof params === 'function' ? params(state.configParams) : { ...state.configParams, ...params },
    })),

  setJobStatus: (status) => set({ jobStatus: status }),

  setResults: (results) => set({ results }),

  setIsSimulated: (val) => set({ isSimulated: val }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setIsFailed: (isFailed) => set({ isFailed }),

  setComputationStage: (computationStage) => set({ computationStage }),

  // Memulai simulasi progres 4 tahap otomatis hingga selesai ke Step 4
  startSimulation: (options = {}) => {
    const { speedMultiplier = 1, onComplete } = options;

    // Bersihkan timer sebelumnya jika ada
    const currentTimers = get().simulationTimeoutIds || [];
    currentTimers.forEach(clearTimeout);

    // Inisialisasi awal simulasi di Step 3
    set({
      isSimulated: true,
      isComputing: true,
      isCompleted: false,
      isFailed: false,
      computationStage: 1,
      activeStep: 3,
      error: null,
      currentAnalysis: {
        ...(get().currentAnalysis || {
          id: 'sim-garlic-01',
          analysis_name: 'Simulasi GWAS Allium sativum L.',
          organism: 'Allium sativum L.',
        }),
        status: 'berjalan',
      },
    });

    const t1 = setTimeout(() => {
      set({ computationStage: 2 });
    }, 1300 * speedMultiplier);

    const t2 = setTimeout(() => {
      set({ computationStage: 3 });
    }, 2600 * speedMultiplier);

    const t3 = setTimeout(() => {
      set({ computationStage: 4 });
    }, 3900 * speedMultiplier);

    const t4 = setTimeout(() => {
      const mockResults = generateBenchmarkResults(get().configParams, get().uploadSummary);
      set({
        results: mockResults,
        isComputing: false,
        isCompleted: true,
        isFailed: false,
        computationStage: 4,
        currentAnalysis: {
          ...(get().currentAnalysis || {}),
          status: 'selesai',
        },
      });
      if (typeof onComplete === 'function') onComplete();
    }, 5200 * speedMultiplier);

    // Otomatis selesai dan lanjut ke Step 4 (Hasil Analisis & Visualisasi Plot)
    const t5 = setTimeout(() => {
      set({ activeStep: 4 });
    }, 6500 * speedMultiplier);

    set({ simulationTimeoutIds: [t1, t2, t3, t4, t5] });
  },

  // Jalankan analisis dengan fallback HANYA jika terjadi Network Error murni atau HTTP 501
  runAnalysis: async (analysisId, payload, options = {}) => {
    if (payload) {
      get().setConfigParams(payload);
    }
    const currentPayload = payload || get().configParams;

    if (analysisId) {
      try {
        await analysisService.saveParameters(analysisId, currentPayload);
        const res = await analysisService.runAnalysis(analysisId);
        set({
          activeStep: 3,
          isSimulated: false,
          isComputing: true,
          isCompleted: false,
          isFailed: false,
          jobStatus: res?.status || 'berjalan',
          currentAnalysis: {
            ...(get().currentAnalysis || {}),
            status: 'berjalan',
          },
        });
        return res;
      } catch (err) {
        const isNetworkError = !err.status || err.status === 0 || err.code === 'ERR_NETWORK';
        const is501 = err.status === 501;

        if (isNetworkError || is501) {
          console.warn('Backend tidak tersedia (Network Error / 501), menjalankan mock simulation:', err);
          get().startSimulation(options);
          return { simulated: true };
        }

        // Error 4xx / 500 dari backend: DILARANG PINDAH SIMULASI & DILARANG PINDAH LANGKAH!
        console.error('Eksekusi parameter/analisis ditolak backend:', err);
        throw err;
      }
    }

    // Jika tanpa analysisId (sesi demo murni tanpa database): jalankan mock simulation
    get().startSimulation(options);
    return { simulated: true };
  },

  stopSimulation: () => {
    const currentTimers = get().simulationTimeoutIds || [];
    currentTimers.forEach(clearTimeout);
    set({ isComputing: false, simulationTimeoutIds: [] });
  },

  reset: () => {
    const currentTimers = get().simulationTimeoutIds || [];
    currentTimers.forEach(clearTimeout);
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
      simulationTimeoutIds: [],
    });
  },
}));
