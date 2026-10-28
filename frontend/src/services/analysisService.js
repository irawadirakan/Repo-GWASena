/**
 * Analysis & Pipeline Service (M-02 s.d. M-08) GWASena 2.0
 * Acuan: docs/gwasena-v2/API_INTEGRATION.md
 */

import { apiClient } from './apiClient.js';

export const analysisService = {
  /**
   * Status kesehatan sistem (FastAPI, DB, Redis)
   */
  async checkHealth() {
    try {
      return await apiClient.get('/api/health');
    } catch {
      return {
        status: 'offline',
        api: 'offline',
        postgres: 'offline',
        redis: 'offline',
        pesan: 'Backend FastAPI sedang offline di localhost:8000',
      };
    }
  },

  /**
   * Health check celery worker
   */
  async checkWorkerHealth() {
    try {
      return await apiClient.get('/api/health/worker');
    } catch {
      return { status: 'offline' };
    }
  },

  /**
   * Metadata sistem (Organisme Allium sativum, modul pipeline, format input)
   */
  async getMeta() {
    try {
      return await apiClient.get('/api/meta');
    } catch {
      return {
        organisme: 'Allium sativum L.',
        nama_umum: 'Bawang Putih',
        jumlah_kromosom: 8,
        ukuran_genom_gb: 16.2,
      };
    }
  },

  /**
   * Referensi model uji asosiasi (GLM, MLM)
   */
  async getModels() {
    try {
      return await apiClient.get('/api/analyses/models');
    } catch {
      return { models: ['GLM', 'MLM'] };
    }
  },

  /**
   * Daftar sesi analisis milik pengguna (S-10 / FR-12)
   */
  async listAnalyses() {
    try {
      return await apiClient.get('/api/analyses');
    } catch {
      // Fallback data riwayat jika backend offline
      return [
        {
          analysis_id: 1,
          analysis_name: 'Analisis Bobot Umbi Bawang Putih (Demo)',
          organism: 'Allium sativum L.',
          created_at: '2026-10-24T10:00:00Z',
          status: 'selesai',
          sifat_tersedia: ['bobot_umbi_g', 'diameter_umbi_mm', 'jumlah_siung'],
        },
        {
          analysis_id: 2,
          analysis_name: 'Eksplorasi Plasma Nutfah Kultivar Lumbu Hijau',
          organism: 'Allium sativum L.',
          created_at: '2026-10-24T12:30:00Z',
          status: 'tervalidasi',
          sifat_tersedia: ['bobot_umbi_g', 'diameter_umbi_mm'],
        },
      ];
    }
  },

  /**
   * Inisiasi sesi analisis baru (S-03 / UC-01)
   * @param {string} analysis_name
   */
  async createAnalysis(analysis_name) {
    try {
      return await apiClient.post('/api/analyses', { analysis_name });
    } catch {
      return {
        analysis_id: Math.floor(Math.random() * 900) + 10,
        analysis_name: analysis_name || 'Analisis Bobot Umbi Bawang Putih',
        status: 'draft',
        organism: 'Allium sativum L.',
        created_at: new Date().toISOString(),
      };
    }
  },

  /**
   * Detail sesi analisis (S-04 s.d. S-09)
   * @param {number|string} analysisId
   */
  async getAnalysisDetail(analysisId) {
    try {
      return await apiClient.get(`/api/analyses/${analysisId}`);
    } catch {
      const numId = Number(analysisId);
      const isCompletedDemo = numId === 1;
      const isConfigDemo = numId === 2;

      return {
        analysis_id: numId || analysisId || 1,
        analysis_name:
          numId === 2
            ? 'Eksplorasi Plasma Nutfah Kultivar Lumbu Hijau'
            : `Analisis GWAS #${analysisId}`,
        organism: 'Allium sativum L.',
        status: isCompletedDemo ? 'selesai' : isConfigDemo ? 'tervalidasi' : 'draft',
        sifat_tersedia: ['bobot_umbi_g', 'diameter_umbi_mm', 'jumlah_siung'],
        created_at: new Date().toISOString(),
      };
    }
  },

  /**
   * Unggah berkas VCF & CSV (S-04 / M-02)
   * @param {number|string} analysisId
   * @param {FormData} formData - Memuat key 'genotipe' dan 'fenotipe'
   */
  async uploadDataset(analysisId, formData) {
    return apiClient.post(`/api/analyses/${analysisId}/upload`, formData);
  },

  /**
   * Simpan konfigurasi parameter QC & model (S-05 / M-03)
   * @param {number|string} analysisId
   * @param {object} parameterConfig
   */
  async saveParameters(analysisId, parameterConfig) {
    return apiClient.put(`/api/analyses/${analysisId}/parameters`, parameterConfig);
  },

  /**
   * Pemicu eksekusi pipeline komputasi (S-05 -> S-06)
   * @param {number|string} analysisId
   */
  async runAnalysis(analysisId) {
    return apiClient.post(`/api/analyses/${analysisId}/run`, {});
  },

  /**
   * Polling status komputasi pipeline (S-06 / M-03)
   * @param {number|string} analysisId
   */
  async getStatus(analysisId) {
    return apiClient.get(`/api/analyses/${analysisId}/status`);
  },

  /**
   * Ambil hasil analisis & visualisasi (S-07 / M-06, M-08)
   * @param {number|string} analysisId
   */
  async getResults(analysisId) {
    return apiClient.get(`/api/analyses/${analysisId}/results`);
  },
};
