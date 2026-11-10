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

export const ORGANISM_GROUPS = [
  {
    kingdom: 'hewan',
    groupLabel: 'Hewan',
    options: [
      { value: 'mus_musculus', label: 'Mencit (Mus musculus)', kingdom: 'hewan', source: 'ensembl' },
      { value: 'rattus_norvegicus', label: 'Tikus (Rattus norvegicus)', kingdom: 'hewan', source: 'ensembl' },
      { value: 'bos_taurus', label: 'Sapi (Bos taurus)', kingdom: 'hewan', source: 'ensembl' },
      { value: 'gallus_gallus', label: 'Ayam (Gallus gallus)', kingdom: 'hewan', source: 'ensembl' },
      { value: 'sus_scrofa', label: 'Babi (Sus scrofa)', kingdom: 'hewan', source: 'ensembl' },
      { value: 'ovis_aries', label: 'Domba (Ovis aries)', kingdom: 'hewan', source: 'ensembl' },
      { value: 'capra_hircus', label: 'Kambing (Capra hircus)', kingdom: 'hewan', source: 'ensembl' },
      { value: 'equus_caballus', label: 'Kuda (Equus caballus)', kingdom: 'hewan', source: 'ensembl' },
      { value: 'danio_rerio', label: 'Ikan Zebra (Danio rerio)', kingdom: 'hewan', source: 'ensembl' },
    ],
  },
  {
    kingdom: 'tanaman',
    groupLabel: 'Tanaman',
    options: [
      { value: 'oryza_sativa', label: 'Padi (Oryza sativa)', kingdom: 'tanaman', source: 'ensembl' },
      { value: 'zea_mays', label: 'Jagung (Zea mays)', kingdom: 'tanaman', source: 'ensembl' },
      { value: 'glycine_max', label: 'Kedelai (Glycine max)', kingdom: 'tanaman', source: 'ensembl' },
      { value: 'solanum_lycopersicum', label: 'Tomat (Solanum lycopersicum)', kingdom: 'tanaman', source: 'ensembl' },
      { value: 'solanum_tuberosum', label: 'Kentang (Solanum tuberosum)', kingdom: 'tanaman', source: 'ensembl' },
      { value: 'triticum_aestivum', label: 'Gandum (Triticum aestivum)', kingdom: 'tanaman', source: 'ensembl' },
      { value: 'arabidopsis_thaliana', label: 'Arabidopsis thaliana', kingdom: 'tanaman', source: 'ensembl' },
      { value: 'allium_sativum', label: 'Bawang Putih (Allium sativum — GFF3 Lokal)', kingdom: 'tanaman', source: 'gff3' },
    ],
  },
];

export const ANIMAL_ORGANISM_OPTIONS = ORGANISM_GROUPS[0].options;
export const PLANT_ORGANISM_OPTIONS = ORGANISM_GROUPS[1].options;
export const ORGANISM_OPTIONS = ORGANISM_GROUPS.flatMap((g) => g.options);

const ORGANISM_ALIAS_MAP = {
  mus_musculus: 'mus_musculus',
  'mus musculus': 'mus_musculus',
  mencit: 'mus_musculus',
  rattus_norvegicus: 'rattus_norvegicus',
  'rattus norvegicus': 'rattus_norvegicus',
  bos_taurus: 'bos_taurus',
  'bos taurus': 'bos_taurus',
  gallus_gallus: 'gallus_gallus',
  'gallus gallus': 'gallus_gallus',
  sus_scrofa: 'sus_scrofa',
  'sus scrofa': 'sus_scrofa',
  ovis_aries: 'ovis_aries',
  'ovis aries': 'ovis_aries',
  capra_hircus: 'capra_hircus',
  'capra hircus': 'capra_hircus',
  equus_caballus: 'equus_caballus',
  'equus caballus': 'equus_caballus',
  danio_rerio: 'danio_rerio',
  'danio rerio': 'danio_rerio',
  oryza_sativa: 'oryza_sativa',
  'oryza sativa': 'oryza_sativa',
  zea_mays: 'zea_mays',
  'zea mays': 'zea_mays',
  glycine_max: 'glycine_max',
  'glycine max': 'glycine_max',
  solanum_lycopersicum: 'solanum_lycopersicum',
  'solanum lycopersicum': 'solanum_lycopersicum',
  solanum_tuberosum: 'solanum_tuberosum',
  'solanum tuberosum': 'solanum_tuberosum',
  triticum_aestivum: 'triticum_aestivum',
  'triticum aestivum': 'triticum_aestivum',
  arabidopsis_thaliana: 'arabidopsis_thaliana',
  'arabidopsis thaliana': 'arabidopsis_thaliana',
  allium_sativum: 'allium_sativum',
  'allium sativum': 'allium_sativum',
  'allium sativum l.': 'allium_sativum',
  'bawang putih': 'allium_sativum',
};

function formatScientificDisplayName(code) {
  const parts = String(code || '').split('_').filter(Boolean);
  if (parts.length === 0) return 'Allium sativum';
  return [parts[0].charAt(0).toUpperCase() + parts[0].slice(1), ...parts.slice(1)].join(' ');
}

export function normalizeOrganismCode(rawOrganism) {
  if (!rawOrganism || typeof rawOrganism !== 'string') return 'allium_sativum';
  const cleaned = rawOrganism.trim().toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
  if (!cleaned || cleaned === 'organisme target sesi') return 'allium_sativum';
  if (ORGANISM_ALIAS_MAP[cleaned]) return ORGANISM_ALIAS_MAP[cleaned];
  const underscored = cleaned
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');
  if (!underscored) return 'allium_sativum';
  return ORGANISM_ALIAS_MAP[underscored] || underscored;
}

export function formatScientificBinomial(rawOrganism) {
  const code = normalizeOrganismCode(rawOrganism);
  return formatScientificDisplayName(code);
}

export function buildManhattanInterpretation({
  sigCount = 0,
  thresholdVal = null,
  topPeakSnp = null,
  traitName = 'sifat target',
  organismScientific = 'organisme target',
}) {
  const count = Number(sigCount || 0);
  const ambangBonf =
    thresholdVal !== null && thresholdVal !== undefined && !isNaN(Number(thresholdVal)) && Number(thresholdVal) > 0
      ? Number(thresholdVal).toFixed(2)
      : '—';
  const traitDisplay = traitName && traitName !== '-' ? traitName : 'sifat target';
  const orgDisplay = organismScientific && organismScientific !== '-' ? organismScientific : 'organisme target';

  if (count > 0 && topPeakSnp) {
    const peakId = topPeakSnp.snp_id || topPeakSnp.snp_code || '—';
    const peakChr = topPeakSnp.chromosome ?? '—';
    const rawNl =
      topPeakSnp.neg_log10_p ??
      topPeakSnp.neglog10p ??
      (topPeakSnp.p_value > 0 ? -Math.log10(Number(topPeakSnp.p_value)) : null);
    const peakNl =
      rawNl !== null && rawNl !== undefined && !isNaN(Number(rawNl))
        ? Number(rawNl).toFixed(2)
        : '—';
    return (
      `Identifikasi lokus genomik mendeteksi ${count} varian SNP signifikan yang melampaui ambang batas Bonferroni ` +
      `(-log₁₀P ≥ ${ambangBonf}), dengan sinyal asosiasi puncak pada ${peakId} (Kromosom ${peakChr}, -log₁₀P = ${peakNl}). ` +
      `Konsentrasi puncak pada kromosom tersebut mengindikasikan keberadaan Quantitative Trait Loci (QTL) utama ` +
      `yang mengendalikan variasi fenotipe ${traitDisplay} pada ${orgDisplay}.`
    );
  }

  return (
    `Tidak ditemukan varian SNP yang melampaui ambang batas konservatif Bonferroni (-log₁₀P = ${ambangBonf}). ` +
    `Hal ini mengindikasikan bahwa sifat ${traitDisplay} pada ${orgDisplay} kemungkinan besar dikendalikan oleh ` +
    `arsitektur poligenik dengan efek alelik minor per lokus, sehingga disarankan meninjau kandidat teratas ` +
    `menggunakan ambang eksploratori FDR.`
  );
}

export function extractDefaultTraitFromColumns(cols) {
  if (!Array.isArray(cols) || cols.length === 0) return '';
  const nonId = cols.find(
    (c) =>
      typeof c === 'string' &&
      c.trim() !== '' &&
      !['sample_id', 'id', 'fid', 'iid'].includes(c.trim().toLowerCase())
  );
  return nonId || cols[0] || '';
}

export function resolveTargetTraitName({
  analysis = null,
  configParams = null,
  uploadSummary = null,
  results = null,
  qcSummary = null,
} = {}) {
  const rawResults = results?.raw_backend_results || {};
  const summaryObj = results?.summary || {};
  const candidates = [
    analysis?.trait_name,
    analysis?.parameters?.trait,
    analysis?.parameter?.trait,
    analysis?.trait,
    analysis?.phenotype_name,
    extractDefaultTraitFromColumns(analysis?.phenotype_columns),
    extractDefaultTraitFromColumns(analysis?.sifat_tersedia),
    extractDefaultTraitFromColumns(analysis?.columns),
    results?.asosiasi?.trait,
    summaryObj?.asosiasi?.trait,
    summaryObj?.trait,
    rawResults?.asosiasi?.trait,
    rawResults?.trait,
    results?.trait_name,
    results?.trait,
    qcSummary?.trait_name,
    qcSummary?.trait,
    configParams?.trait,
    uploadSummary?.trait_name,
    uploadSummary?.trait,
    extractDefaultTraitFromColumns(uploadSummary?.fenotipe?.daftar_sifat),
    extractDefaultTraitFromColumns(uploadSummary?.fenotipe?.sifat_tersedia),
    extractDefaultTraitFromColumns(uploadSummary?.sifat_tersedia),
  ];

  for (const cand of candidates) {
    if (cand !== null && cand !== undefined) {
      const trimmed = String(cand).trim();
      if (trimmed && trimmed !== '-' && trimmed !== '—') {
        return trimmed;
      }
    }
  }

  const orgStr = `${analysis?.organism || ''} ${configParams?.organism || ''} ${uploadSummary?.genotipe?.nama_berkas || ''}`.toLowerCase();
  if (/mus_musculus|mouse|mencit|hs1940/.test(orgStr)) {
    return 'CD8';
  }
  return '—';
}

export function getOrganismMeta(rawOrganism) {
  const code = normalizeOrganismCode(rawOrganism);
  const preset = ORGANISM_OPTIONS.find((opt) => opt.value === code);
  if (preset) {
    return { ...preset, isCustom: false };
  }
  return {
    value: code,
    label: `${formatScientificDisplayName(code)} (Kustom Ensembl)`,
    kingdom: 'custom',
    source: code === 'allium_sativum' ? 'gff3' : 'ensembl',
    isCustom: true,
  };
}

const CLIENT_DETECTION_RULES = [
  { keywords: ['mus_musculus', 'mus musculus', 'mouse', 'mice', 'mencit', 'hs1940', 'mus'], organism: 'mus_musculus', kingdom: 'hewan', label: 'Mencit (Mus musculus)' },
  { keywords: ['rattus_norvegicus', 'rattus', 'rat', 'tikus'], organism: 'rattus_norvegicus', kingdom: 'hewan', label: 'Tikus (Rattus norvegicus)' },
  { keywords: ['bos_taurus', 'cattle', 'cow', 'sapi'], organism: 'bos_taurus', kingdom: 'hewan', label: 'Sapi (Bos taurus)' },
  { keywords: ['gallus_gallus', 'gallus', 'chicken', 'ayam'], organism: 'gallus_gallus', kingdom: 'hewan', label: 'Ayam (Gallus gallus)' },
  { keywords: ['sus_scrofa', 'pig', 'babi'], organism: 'sus_scrofa', kingdom: 'hewan', label: 'Babi (Sus scrofa)' },
  { keywords: ['ovis_aries', 'ovis', 'sheep', 'domba'], organism: 'ovis_aries', kingdom: 'hewan', label: 'Domba (Ovis aries)' },
  { keywords: ['capra_hircus', 'capra', 'goat', 'kambing'], organism: 'capra_hircus', kingdom: 'hewan', label: 'Kambing (Capra hircus)' },
  { keywords: ['equus_caballus', 'equus', 'horse', 'kuda'], organism: 'equus_caballus', kingdom: 'hewan', label: 'Kuda (Equus caballus)' },
  { keywords: ['danio_rerio', 'danio', 'zebrafish'], organism: 'danio_rerio', kingdom: 'hewan', label: 'Ikan Zebra (Danio rerio)' },
  { keywords: ['solanum_tuberosum', 'potato', 'kentang'], organism: 'solanum_tuberosum', kingdom: 'tanaman', label: 'Kentang (Solanum tuberosum)' },
  { keywords: ['solanum_lycopersicum', 'tomato', 'tomat', 'solanum'], organism: 'solanum_lycopersicum', kingdom: 'tanaman', label: 'Tomat (Solanum lycopersicum)' },
  { keywords: ['oryza_sativa', 'oryza', 'rice', 'padi'], organism: 'oryza_sativa', kingdom: 'tanaman', label: 'Padi (Oryza sativa)' },
  { keywords: ['zea_mays', 'zea', 'maize', 'corn', 'jagung'], organism: 'zea_mays', kingdom: 'tanaman', label: 'Jagung (Zea mays)' },
  { keywords: ['glycine_max', 'soybean', 'glycine', 'kedelai', 'soy'], organism: 'glycine_max', kingdom: 'tanaman', label: 'Kedelai (Glycine max)' },
  { keywords: ['triticum_aestivum', 'triticum', 'wheat', 'gandum'], organism: 'triticum_aestivum', kingdom: 'tanaman', label: 'Gandum (Triticum aestivum)' },
  { keywords: ['arabidopsis_thaliana', 'arabidopsis'], organism: 'arabidopsis_thaliana', kingdom: 'tanaman', label: 'Arabidopsis thaliana' },
  { keywords: ['allium_sativum', 'allium', 'garlic', 'bawang', 'umbi'], organism: 'allium_sativum', kingdom: 'tanaman', label: 'Bawang Putih (Allium sativum)' },
];

export function detectOrganismClientSide({ filenames = [], traits = [], numChromosomes = null, snpIds = [] } = {}) {
  const corpus = [...filenames, ...traits].filter(Boolean).join(' ').toLowerCase();
  for (const rule of CLIENT_DETECTION_RULES) {
    for (const kw of rule.keywords) {
      const matched =
        kw.length <= 4
          ? new RegExp(`(^|[^a-z0-9])${kw}([^a-z0-9]|$)`).test(corpus)
          : corpus.includes(kw);
      if (matched) {
        return {
          organism: rule.organism,
          kingdom: rule.kingdom,
          label: rule.label,
          detected_by: 'nama berkas/profil dataset',
          auto_detected: true,
        };
      }
    }
  }
  const hasRsSnps = Array.isArray(snpIds) && snpIds.some((id) => /^rs\d+/i.test(String(id || '')));
  if (numChromosomes && (numChromosomes === 19 || numChromosomes === 20 || (numChromosomes > 12 && hasRsSnps))) {
    return { organism: 'mus_musculus', kingdom: 'hewan', label: 'Mencit (Mus musculus)', detected_by: 'heuristik kromosom', auto_detected: true };
  }
  if (numChromosomes === 12) {
    return { organism: 'oryza_sativa', kingdom: 'tanaman', label: 'Padi (Oryza sativa)', detected_by: 'heuristik kromosom', auto_detected: true };
  }
  return {
    organism: 'allium_sativum',
    kingdom: 'tanaman',
    label: 'Bawang Putih (Allium sativum)',
    detected_by: 'default referensi lokal',
    auto_detected: false,
  };
}

export const DEFAULT_ANALYSIS_CONFIG = {
  organism: 'allium_sativum',
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
  alpha: { min: 0.0001, max: 0.20, step: 'any' },
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
