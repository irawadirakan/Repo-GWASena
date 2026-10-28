/**
 * Parameter Default & Batas Validasi GWASena 2.0
 * Acuan: docs/gwasena-v2/DESIGN.md & API_INTEGRATION.md
 */

export const DEFAULT_QC_PARAMS = {
  mind: 0.10,
  geno: 0.10,
  maf: 0.05,
  hwe: null,
  king_cutoff: null,
};

export const DEFAULT_ANALYSIS_CONFIG = {
  trait: '',
  qc: { ...DEFAULT_QC_PARAMS },
  n_pc: 3,
  model: 'MLM',
  koreksi: ['bonferroni', 'fdr'],
  alpha: 0.05,
};

export const QC_PARAM_RANGES = {
  mind: { min: 0.0, max: 0.5, step: 0.01 },
  geno: { min: 0.0, max: 0.5, step: 0.01 },
  maf: { min: 0.01, max: 0.49, step: 0.01 },
  hwe: { min: 1e-10, max: 1e-1, step: 'scientific' },
  king_cutoff: { min: 0.0, max: 0.5, step: 0.001 },
  alpha: { min: 0.001, max: 0.1, step: 0.005 },
};

export const ANALYSIS_STATUSES = {
  draft: {
    label: 'Draft',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-surface-elevated dark:text-text-muted dark:border-border-subtle',
    color: '#64748B',
  },
  tervalidasi: {
    label: 'Tervalidasi',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    color: '#10B981',
  },
  antre: {
    label: 'Dalam Antrean',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    color: '#F59E0B',
  },
  berjalan: {
    label: 'Sedang Berjalan',
    badgeClass: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30',
    color: '#06B6D4',
  },
  selesai: {
    label: 'Selesai',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    color: '#10B981',
  },
  gagal: {
    label: 'Gagal',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
    color: '#EF4444',
  },
};

export const WIZARD_STEPS = [
  { step: 1, id: 'upload', label: 'Unggah & Validasi' },
  { step: 2, id: 'config', label: 'Konfigurasi QC & Model' },
  { step: 3, id: 'compute', label: 'Komputasi Pipeline' },
  { step: 4, id: 'results', label: 'Hasil & Visualisasi' },
  { step: 5, id: 'annotation', label: 'Anotasi Gen' },
  { step: 6, id: 'export', label: 'Ekspor & Laporan' },
];
