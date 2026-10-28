/**
 * Benchmark Simulation Dataset & Mock Results for Garlic (Allium sativum L.)
 * Acuan: docs/gwasena-v2/DESIGN.md & API_INTEGRATION.md
 *
 * Memfasilitasi evaluasi visual Manhattan Plot (WebGL/Plotly), QQ Plot,
 * Anotasi Gen Kandidat, dan Ekspor CSV/PNG/Laporan ketika backend 501.
 */

// 8 Kromosom Bawang Putih dengan perkiraan panjang relatif (Mbp)
const GARLIC_CHROMOSOMES = [
  { chr: 1, length: 180000000 },
  { chr: 2, length: 175000000 },
  { chr: 3, length: 190000000 },
  { chr: 4, length: 165000000 },
  { chr: 5, length: 170000000 },
  { chr: 6, length: 160000000 },
  { chr: 7, length: 155000000 },
  { chr: 8, length: 150000000 },
];

export function generateBenchmarkResults(params = {}, uploadSummary = null) {
  const model = params.model || 'MLM';
  const trait = params.trait || (uploadSummary?.fenotipe?.sifat_tersedia?.[0]) || 'bobot_umbi_g';
  const alpha = Number(params.alpha) || 0.05;

  // 1. Generate ~482 SNPs terdistribusi di 8 kromosom
  const totalSnps = 482;
  const snpList = [];

  // Seeded deterministic generation for reproducible plots
  let seed = 42;
  function pseudoRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  // 4 Top hits yang terbukti signifikan secara biologis pada bawang putih
  const topHits = [
    {
      id: 'snp005',
      chr: 3,
      pos: 42150820,
      pVal: 2.3e-8,
      beta: 4.85,
      se: 0.62,
      gene: 'AsPMT1',
      geneName: 'Phosphoethanolamine N-methyltransferase 1',
      distance: '1.2 kb downstream',
      consequence: 'missense_variant',
      desc: 'Biosintesis alliin dan akumulasi organosulfur dalam pembentukan umbi bawang putih.',
    },
    {
      id: 'snp008',
      chr: 5,
      pos: 18920440,
      pVal: 6.8e-8,
      beta: 3.42,
      se: 0.54,
      gene: 'AsALMT9',
      geneName: 'Aluminum-activated malate transporter 9',
      distance: '3.5 kb upstream',
      consequence: 'regulatory_region_variant',
      desc: 'Modulasi akumulasi asam malat vakuolar dan osmoregulasi ekspansi sel umbi.',
    },
    {
      id: 'snp021',
      chr: 3,
      pos: 42185100,
      pVal: 4.1e-7,
      beta: 3.12,
      se: 0.58,
      gene: 'AsWRKY71',
      geneName: 'WRKY transcription factor 71',
      distance: 'Intronik',
      consequence: 'splice_region_variant',
      desc: 'Regulasi faktor transkripsi respons toleransi stres dan pembesaran siung.',
    },
    {
      id: 'snp042',
      chr: 7,
      pos: 65301200,
      pVal: 7.9e-7,
      beta: 2.95,
      se: 0.59,
      gene: 'AsSUT1',
      geneName: 'Sucrose transporter 1',
      distance: '8.4 kb downstream',
      consequence: 'intergenic_variant',
      desc: 'Translokasi sukrosa fotosintetik dari daun ke organ sink umbi cadangan.',
    },
  ];

  let snpIndex = 1;
  const bonferroniThreshold = alpha / totalSnps; // ~0.0001037 -> -log10 ≈ 3.98
  const defaultGenomeWideThreshold = 5e-8; // -log10 = 7.30

  GARLIC_CHROMOSOMES.forEach(({ chr, length }) => {
    const snpsInChr = Math.floor(totalSnps / 8);
    for (let i = 0; i < snpsInChr; i++) {
      const snpId = `snp${String(snpIndex).padStart(3, '0')}`;
      const pos = Math.floor((i + 1) * (length / (snpsInChr + 2)) + (pseudoRandom() * 100000));
      
      // Cek apakah ini salah satu top hit
      const hit = topHits.find((h) => h.id === snpId);
      let pVal;
      let beta;
      let se;

      if (hit) {
        pVal = hit.pVal;
        beta = hit.beta;
        se = hit.se;
      } else {
        // Distribusi null hypothesis sebagian besar p-val > 0.001
        const u = pseudoRandom();
        pVal = Math.max(0.0005, Math.min(0.999, Math.pow(u, 1.35)));
        beta = Number(((pseudoRandom() - 0.48) * 1.5).toFixed(3));
        se = Number((0.25 + pseudoRandom() * 0.45).toFixed(3));
      }

      const negLog10P = -Math.log10(pVal);
      // Koreksi FDR approximation
      const qVal = Math.min(1.0, (pVal * totalSnps) / snpIndex);

      snpList.push({
        snp_id: snpId,
        chromosome: chr,
        position: pos,
        p_value: pVal,
        neg_log10_p: Number(negLog10P.toFixed(4)),
        q_value: Number(qVal.toExponential(3)),
        effect_size: beta,
        std_error: se,
        allele_ref: ['A', 'C', 'G', 'T'][Math.floor(pseudoRandom() * 4)],
        allele_alt: ['T', 'G', 'A', 'C'][Math.floor(pseudoRandom() * 4)],
        maf: Number((0.05 + pseudoRandom() * 0.42).toFixed(3)),
        is_significant: pVal < bonferroniThreshold,
      });

      snpIndex++;
    }
  });

  // Urutkan snpList berdasarkan kromosom lalu posisi
  snpList.sort((a, b) => a.chromosome - b.chromosome || a.position - b.position);

  // Ambil yang signifikan
  const significantSnps = snpList.filter((s) => s.is_significant);

  // Kandidat Gen Anotasi
  const candidateGenes = topHits.map((hit) => ({
    snp_id: hit.id,
    chromosome: hit.chr,
    position: hit.pos,
    gene_id: hit.gene,
    gene_name: hit.geneName,
    distance: hit.distance,
    consequence: hit.consequence,
    description: hit.desc,
    source: 'GFF3 Allium sativum ASM12345v1 / Ensembl Plants',
  }));

  // Hitung QQ Plot data
  // Expected -log10(p): uniform distribution
  const sortedPValues = snpList.map((s) => s.p_value).sort((a, b) => a - b);
  const qqData = sortedPValues.map((obsP, idx) => {
    const rank = idx + 1;
    const expP = rank / (totalSnps + 1);
    return {
      expected: Number((-Math.log10(expP)).toFixed(4)),
      observed: Number((-Math.log10(obsP)).toFixed(4)),
    };
  });

  return {
    is_simulated: true,
    summary: {
      model,
      koreksi: params.koreksi || ['bonferroni', 'fdr'],
      alpha,
      trait,
      total_snps_tested: totalSnps,
      total_samples_analyzed: 38,
      significant_snps_count: significantSnps.length,
      bonferroni_threshold: Number(bonferroniThreshold.toExponential(4)),
      neg_log10_threshold: Number((-Math.log10(bonferroniThreshold)).toFixed(2)),
      lambda_gc: 1.024, // Indikator kontrol inflasi populasi genomik yang sangat baik (< 1.05)
      execution_time_sec: 14.8,
      organism: 'Allium sativum L.',
      chromosome_count: 8,
    },
    qc_summary: {
      samples_before: 40,
      samples_after: 38,
      samples_filtered: 2,
      snps_before: 500,
      snps_after: 482,
      snps_filtered: 18,
      filters: {
        missingness_sample: { filtered: 2, threshold: params.mind || 0.10 },
        missingness_snp: { filtered: 6, threshold: params.geno || 0.10 },
        maf: { filtered: 8, threshold: params.maf || 0.05 },
        hwe: { filtered: 4, threshold: params.hwe || '1e-6' },
      },
    },
    association_results: snpList,
    significant_snps: significantSnps,
    candidate_genes: candidateGenes,
    qq_data: qqData,
  };
}
