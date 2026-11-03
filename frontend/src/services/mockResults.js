/**
 * Benchmark Simulation Dataset & Mock Results for Genomic Association Studies
 * Acuan: docs/gwasena-v2/DESIGN.md & API_INTEGRATION.md
 *
 * Memfasilitasi evaluasi visual Manhattan Plot (WebGL/Plotly), QQ Plot,
 * Anotasi Gen Kandidat, dan Ekspor CSV/PNG/Laporan ketika backend offline / 501.
 */

// 8 Kromosom Genom Model dengan perkiraan panjang relatif (bp)
const GARLIC_CHROMOSOMES = [
  { chr: 1, length: 180000000, nSnps: 63 },
  { chr: 2, length: 175000000, nSnps: 63 },
  { chr: 3, length: 190000000, nSnps: 63 },
  { chr: 4, length: 165000000, nSnps: 63 },
  { chr: 5, length: 170000000, nSnps: 62 },
  { chr: 6, length: 160000000, nSnps: 62 },
  { chr: 7, length: 155000000, nSnps: 62 },
  { chr: 8, length: 150000000, nSnps: 62 },
];

export function generateBenchmarkResults(params = {}, uploadSummary = null) {
  const model = params.model || 'MLM';
  const trait = params.trait || (uploadSummary?.fenotipe?.sifat_tersedia?.[0]) || 'bobot_umbi_g';
  const alpha = Number(params.alpha) || 0.05;

  const totalSnps = 500;
  const snpList = [];

  // Seeded deterministic generation for reproducible plots
  let seed = 44;
  function pseudoRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  // Puncak sinyal asosiasi genomik biologis (Significant Peaks)
  const topHits = [
    {
      id: 'snp_chr3_0041',
      chr: 3,
      pos: 21378377,
      pVal: 6.87e-7,
      beta: 3.15,
      se: 0.52,
      gene: 'AsWRKY71',
      geneName: 'WRKY transcription factor 71',
      distance: '1.8 kb upstream',
      consequence: 'regulatory_region_variant',
      desc: 'Regulasi faktor transkripsi respons pertumbuhan dan biosintesis organ cadangan.',
    },
    {
      id: 'snp_chr3_0042',
      chr: 3,
      pos: 21745450,
      pVal: 1.02e-9,
      beta: 4.92,
      se: 0.48,
      gene: 'AsPMT1',
      geneName: 'Phosphoethanolamine N-methyltransferase 1',
      distance: 'Intronik',
      consequence: 'missense_variant',
      desc: 'Biosintesis enzim metabolik dan akumulasi biomassa utama organ penyimpanan.',
    },
    {
      id: 'snp_chr3_0043',
      chr: 3,
      pos: 22583986,
      pVal: 1.14e-6,
      beta: 3.08,
      se: 0.54,
      gene: 'AsSUS2',
      geneName: 'Sucrose Synthase 2',
      distance: '2.5 kb downstream',
      consequence: 'synonymous_variant',
      desc: 'Katalisis sintesis sukrosa dan modulasi metabolisme karbohidrat umbi.',
    },
    {
      id: 'snp_chr5_0017',
      chr: 5,
      pos: 9479174,
      pVal: 9.14e-6,
      beta: 2.85,
      se: 0.55,
      gene: 'AsALMT9',
      geneName: 'Aluminum-activated malate transporter 9',
      distance: '3.1 kb upstream',
      consequence: 'regulatory_region_variant',
      desc: 'Modulasi akumulasi metabolit vakuolar dan osmoregulasi ekspansi seluler.',
    },
    {
      id: 'snp_chr5_0018',
      chr: 5,
      pos: 9910802,
      pVal: 9.14e-6,
      beta: 2.85,
      se: 0.55,
      gene: 'AsALMT9',
      geneName: 'Aluminum-activated malate transporter 9',
      distance: 'Exonic',
      consequence: 'missense_variant',
      desc: 'Transporter malat vakuolar pengatur ekspansi volume seluler umbi.',
    },
    {
      id: 'snp_chr5_0019',
      chr: 5,
      pos: 10366486,
      pVal: 9.14e-6,
      beta: 2.85,
      se: 0.55,
      gene: 'AsCYP71',
      geneName: 'Cytochrome P450 monooxygenase 71',
      distance: 'Intronik',
      consequence: 'splice_region_variant',
      desc: 'Oksigenasi prekursor fitohormon dan senyawa bioaktif organ vegetatif.',
    },
    {
      id: 'snp_chr7_0025',
      chr: 7,
      pos: 12041029,
      pVal: 6.78e-6,
      beta: 2.95,
      se: 0.56,
      gene: 'AsSUT1',
      geneName: 'Sucrose transporter 1',
      distance: '4.2 kb downstream',
      consequence: 'intergenic_variant',
      desc: 'Translokasi sukrosa fotosintetik dari organ daun (source) ke organ umbi (sink).',
    },
  ];

  const bonferroniThreshold = alpha / totalSnps; // 0.05 / 500 = 1.0e-4 -> -log10 = 4.00

  GARLIC_CHROMOSOMES.forEach(({ chr, length, nSnps }) => {
    let currentPos = 0;
    for (let k = 1; k <= nSnps; k++) {
      const snpId = `snp_chr${chr}_${String(k).padStart(4, '0')}`;
      currentPos += Math.floor(150000 + pseudoRandom() * 750000);
      const pos = currentPos;

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
        // Distribusi null hypothesis p-val terdistribusi wajar (0.001 - 0.999)
        const u = pseudoRandom();
        pVal = Math.max(0.0005, Math.min(0.999, Math.pow(u, 1.25)));
        beta = Number(((pseudoRandom() - 0.48) * 1.2).toFixed(3));
        se = Number((0.25 + pseudoRandom() * 0.40).toFixed(3));
      }

      const negLog10P = -Math.log10(pVal);
      const qVal = Math.min(1.0, (pVal * totalSnps) / k);

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
        maf: Number((0.18 + pseudoRandom() * 0.28).toFixed(3)),
        is_significant: pVal < bonferroniThreshold,
      });
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
    source: 'NCBI RefSeq / Ensembl Plants Annotation',
  }));

  // Hitung QQ Plot data:
  // Urutkan p-value teramati dari terkecil ke terbesar
  const sortedObsP = snpList.map((s) => s.p_value).sort((a, b) => a - b);
  const m = sortedObsP.length;
  const qqData = sortedObsP.map((obsP, idx) => {
    // Expected p-value rank dari 1..m
    const expectedP = (idx + 0.5) / m;
    return {
      expected: Number((-Math.log10(expectedP)).toFixed(4)),
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
      total_samples_analyzed: 40,
      significant_snps_count: significantSnps.length,
      bonferroni_threshold: Number(bonferroniThreshold.toExponential(4)),
      neg_log10_threshold: Number((-Math.log10(bonferroniThreshold)).toFixed(2)),
      lambda_gc: 1.031, // Kontrol inflasi genomik terverifikasi optimal (< 1.05)
      execution_time_sec: 14.8,
      organism: 'Genomic Reference Cohort',
      chromosome_count: 8,
    },
    qc_summary: {
      samples_before: 40,
      samples_after: 40,
      samples_filtered: 0,
      snps_before: 500,
      snps_after: 500,
      snps_filtered: 0,
      filters: {
        missingness_sample: { filtered: 0, threshold: params.mind || 0.10 },
        missingness_snp: { filtered: 0, threshold: params.geno || 0.10 },
        maf: { filtered: 0, threshold: params.maf || 0.05 },
        hwe: { filtered: 0, threshold: params.hwe || '1e-6' },
      },
    },
    association_results: snpList,
    significant_snps: significantSnps,
    candidate_genes: candidateGenes,
    qq_data: qqData,
  };
}
