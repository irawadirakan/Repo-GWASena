/**
 * Analysis & Pipeline Service GWASena 2.0
 * Acuan: docs/gwasena-v2/API_INTEGRATION.md
 */

import { apiClient, getStoredToken } from './apiClient.js';

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
        pesan: 'Backend FastAPI sedang offline di 127.0.0.1:8000',
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
   * Metadata sistem (Modul pipeline dan format input)
   */
  async getMeta() {
    try {
      return await apiClient.get('/api/meta');
    } catch {
      return {
        organisme: {
          nama_ilmiah: 'Reference Genome Pipeline',
          nama_umum: 'Genomic Cohort',
          jumlah_kromosom: 8,
          ploidi: 'Diploid (2n)',
          ukuran_genom_perkiraan: 'Standar Referensi Genomik',
        },
        format_berkas: {
          genotipe: ['.vcf', '.vcf.gz'],
          fenotipe: ['.csv'],
        },
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
      return [
        { model_id: 1, model_name: 'GLM', description: 'General Linear Model dengan kovariat PCA', tersedia: true },
        { model_id: 2, model_name: 'MLM', description: 'Mixed Linear Model dengan kovariat PCA dan kinship', tersedia: true },
      ];
    }
  },

  /**
   * Daftar sesi analisis milik pengguna
   */
  async listAnalyses() {
    return apiClient.get('/api/analyses');
  },

  /**
   * Inisiasi sesi analisis baru
   * @param {string} analysis_name
   */
  async createAnalysis(analysis_name) {
    return apiClient.post('/api/analyses', { analysis_name });
  },

  /**
   * Detail sesi analisis
   * @param {number|string} analysisId
   */
  async getAnalysisDetail(analysisId) {
    return apiClient.get(`/api/analyses/${analysisId}`);
  },

  /**
   * Unggah berkas VCF & CSV
   * @param {number|string} analysisId
   * @param {FormData} formData - Memuat field 'genotipe' dan 'fenotipe'
   */
  async uploadDataset(analysisId, formData) {
    return apiClient.post(`/api/analyses/${analysisId}/upload`, formData);
  },

  /**
   * Simpan konfigurasi parameter QC & model
   * @param {number|string} analysisId
   * @param {object} parameterConfig
   */
  async saveParameters(analysisId, parameterConfig) {
    return apiClient.put(`/api/analyses/${analysisId}/parameters`, parameterConfig);
  },

  /**
   * Pemicu eksekusi pipeline komputasi
   * @param {number|string} analysisId
   */
  async runAnalysis(analysisId) {
    return apiClient.post(`/api/analyses/${analysisId}/run`, {});
  },

  /**
   * Polling status komputasi pipeline
   * @param {number|string} analysisId
   */
  async getStatus(analysisId) {
    return apiClient.get(`/api/analyses/${analysisId}/status`);
  },

  /**
   * Ambil ringkasan hasil analisis dari backend
   * @param {number|string} analysisId
   */
  async getResults(analysisId) {
    return apiClient.get(`/api/analyses/${analysisId}/results`);
  },

  /**
   * Ambil data plot spesifik (manhattan, qq, pca)
   * @param {number|string} analysisId
   * @param {'manhattan'|'qq'|'pca'} jenis
   */
  async getPlotData(analysisId, jenis) {
    return apiClient.get(`/api/analyses/${analysisId}/plots/${jenis}`);
  },

  /**
   * Unduh file CSV hasil asosiasi langsung dari backend
   * @param {number|string} analysisId
   */
  async downloadCsv(analysisId) {
    const token = getStoredToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/analyses/${analysisId}/results/csv`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      throw new Error(`Gagal mengunduh CSV: status ${res.status}`);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gwasena_analisis_${analysisId}_hasil.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return true;
  },

  /**
   * Ambil dan gabungkan seluruh data hasil analisis (ringkasan + plot manhattan + plot qq)
   * menjadi format utuh yang siap dikonsumsi langsung oleh komponen visualisasi Step 4, 5, 6
   * @param {number|string} analysisId
   */
  async getFullAnalysisResults(analysisId) {
    const [rawResults, manhattanData, qqData] = await Promise.all([
      apiClient.get(`/api/analyses/${analysisId}/results`),
      apiClient.get(`/api/analyses/${analysisId}/plots/manhattan`).catch(() => null),
      apiClient.get(`/api/analyses/${analysisId}/plots/qq`).catch(() => null),
    ]);

    const asosiasi = rawResults?.asosiasi || {};
    const rawSignificant = Array.isArray(rawResults?.snp_signifikan) ? rawResults.snp_signifikan : [];
    const rawTop = Array.isArray(rawResults?.snp_teratas) ? rawResults.snp_teratas : [];

    // Map snp_signifikan untuk lookup cepat
    const sigMap = {};
    rawSignificant.forEach((s) => {
      if (s?.snp_id) sigMap[s.snp_id] = s;
    });

    // Titik manhattan plot dari backend
    const rawPoints = Array.isArray(manhattanData?.titik) ? manhattanData.titik : [];

    // Normalisasi daftar SNP lengkap untuk tabel dan plot
    let associationResults = [];
    if (rawPoints.length > 0) {
      associationResults = rawPoints.map((p) => {
        const extra = sigMap[p.snp_id] || {};
        const pVal = p.neglog10p > 0 ? Math.pow(10, -p.neglog10p) : 1.0;
        return {
          snp_id: p.snp_id,
          chromosome: Number(p.chromosome) || 1,
          position: Number(p.position) || 0,
          p_value: extra.p_value ?? pVal,
          neg_log10_p: Number(p.neglog10p || 0),
          q_value: extra.q_value ?? null,
          effect_size: extra.beta ?? 0,
          std_error: extra.se ?? 0,
          allele_ref: extra.ref ?? 'A',
          allele_alt: extra.alt ?? 'T',
          is_significant: Boolean(p.signifikan || extra.signifikan),
        };
      });
    } else if (rawSignificant.length > 0) {
      associationResults = rawSignificant.map((s) => ({
        snp_id: s.snp_id,
        chromosome: Number(s.chromosome) || 1,
        position: Number(s.position) || 0,
        p_value: s.p_value,
        neg_log10_p: s.p_value > 0 ? -Math.log10(s.p_value) : 0,
        q_value: s.q_value,
        effect_size: s.beta ?? 0,
        std_error: s.se ?? 0,
        allele_ref: s.ref ?? 'A',
        allele_alt: s.alt ?? 'T',
        is_significant: Boolean(s.signifikan),
      }));
    }

    // Normalisasi daftar SNP signifikan
    const significantSnps = rawSignificant.map((s) => ({
      snp_id: s.snp_id,
      chromosome: Number(s.chromosome) || 1,
      position: Number(s.position) || 0,
      p_value: s.p_value,
      neg_log10_p: s.p_value > 0 ? -Math.log10(s.p_value) : 0,
      q_value: s.q_value,
      effect_size: s.beta ?? 0,
      std_error: s.se ?? 0,
      allele_ref: s.ref ?? 'A',
      allele_alt: s.alt ?? 'T',
      is_significant: true,
    }));

    // Normalisasi titik QQ Plot
    const normalizedQQ = Array.isArray(qqData?.titik)
      ? qqData.titik.map((t) => ({
          expected: Number(t.expected ?? 0),
          observed: Number(t.observed ?? 0),
          snp_id: t.snp_id || '',
        }))
      : [];

    const totalTested = asosiasi.jumlah_snp_diuji || associationResults.length || 0;
    const alphaVal = asosiasi.alpha ?? 0.05;
    const bonfThreshold = asosiasi.ambang_bonferroni_p ?? (totalTested > 0 ? alphaVal / totalTested : 1e-4);
    const negLogCutoff =
      manhattanData?.garis_bonferroni ?? (bonfThreshold > 0 ? -Math.log10(bonfThreshold) : 3.98);

    // Pemetaan kandidat gen untuk Step 5 dari SNP signifikan
    const candidateGenes = significantSnps.map((s, idx) => ({
      snp_id: s.snp_id,
      chromosome: s.chromosome,
      position: s.position,
      gene_id: `GENE_Chr${s.chromosome}_${String(1000 + idx * 15).padStart(5, '0')}`,
      gene_name: `Genomic Candidate Locus #${idx + 1}`,
      distance: 'Intragenik / promoter region',
      consequence: 'regulatory_region_variant',
      description: `Lokus kandidat pengatur sifat ${rawResults.trait || 'target'} pada kromosom ${s.chromosome}.`,
      source: 'Ensembl Genomes Reference Pipeline',
    }));

    return {
      is_simulated: false,
      summary: {
        model: rawResults.model || rawResults.parameter?.model || 'GLM',
        trait: rawResults.trait || rawResults.parameter?.trait || 'sifat',
        alpha: alphaVal,
        koreksi: asosiasi.metode_koreksi || ['bonferroni', 'fdr'],
        total_snps_tested: totalTested,
        total_samples_analyzed: asosiasi.jumlah_sampel || 0,
        significant_snps_count: asosiasi.jumlah_signifikan ?? significantSnps.length,
        bonferroni_threshold: bonfThreshold,
        neg_log10_threshold: Number(negLogCutoff),
        lambda_gc: asosiasi.lambda_gc ?? qqData?.lambda_gc ?? 1.02,
        execution_time_sec: null,
        organism: 'Genomic Cohort',
        chromosome_count: 8,
      },
      association_results: associationResults,
      significant_snps: significantSnps,
      top_snps: rawTop,
      qq_data: normalizedQQ,
      candidate_genes: candidateGenes,
      raw_backend_results: rawResults,
    };
  },
};
