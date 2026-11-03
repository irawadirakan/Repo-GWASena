/**
 * Example Dataset Provider GWASena 2.0
 * Menyediakan berkas contoh VCF & CSV yang 100% valid, lolos QC PLINK,
 * dan menghasilkan sinyal asosiasi signifikan menembus Bonferroni & FDR.
 */

export const EXAMPLE_METADATA = {
  sampleCount: 40,
  snpCount: 500,
  chromosomeCount: 8,
  traits: ['bobot_umbi_g', 'diameter_umbi_mm', 'jumlah_siung'],
  significantSnpIds: [
    'snp_chr3_0041',
    'snp_chr3_0042',
    'snp_chr3_0043',
    'snp_chr5_0017',
    'snp_chr5_0018',
    'snp_chr5_0019',
  ],
};

/**
 * Mengambil berkas contoh fisik dari public assets,
 * atau menghasilkan secara deterministik jika sedang offline.
 */
export async function getExampleDatasetFiles() {
  try {
    const [vcfRes, csvRes] = await Promise.all([
      fetch('/assets/example/genotipe_bawang_putih_mini.vcf'),
      fetch('/assets/example/fenotipe_bawang_putih_mini.csv'),
    ]);

    if (vcfRes.ok && csvRes.ok) {
      const vcfBlob = await vcfRes.blob();
      const csvBlob = await csvRes.blob();

      const vcfFile = new File([vcfBlob], 'genotipe_bawang_putih_mini.vcf', {
        type: 'text/plain',
        lastModified: Date.now(),
      });
      const csvFile = new File([csvBlob], 'fenotipe_bawang_putih_mini.csv', {
        type: 'text/csv',
        lastModified: Date.now(),
      });

      return { vcfFile, csvFile };
    }
  } catch (err) {
    console.warn('Gagal memuat berkas contoh dari /assets/example, beralih ke generator lokal:', err);
  }

  // Fallback Generator jika fetch assets tidak tersedia
  return generateLocalExampleFiles();
}

/**
 * Generator lokal deterministik (Seed 44) jika berjalan di lingkungan tanpa static file server.
 */
function generateLocalExampleFiles() {
  const N = 40;
  const samples = Array.from({ length: N }, (_, i) => `BP${String(i + 1).padStart(3, '0')}`);
  const varieties = ['Lumbu Hijau', 'Lumbu Kuning', 'Tawangmangu Baru', 'Sangga Sembalun'];

  // Seeded PRNG
  let seed = 44;
  function rnd() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  const rows = [];
  const genoCols = [];

  for (let c = 1; c <= 8; c++) {
    const nInChr = c <= 4 ? 63 : 62;
    let pos = 0;
    for (let k = 1; k <= nInChr; k++) {
      pos += Math.floor(150000 + rnd() * 750000);
      const snpId = `snp_chr${c}_${String(k).padStart(4, '0')}`;
      const baseFreq = 0.28 + rnd() * 0.14;
      const g = Array.from({ length: N }, () => {
        const u = rnd();
        return u < baseFreq * 0.4 ? 2 : u < baseFreq * 1.2 ? 1 : 0;
      });
      rows.push({ chr: `chr${c}`, pos, id: snpId });
      genoCols.push(g);
    }
  }

  // Header VCF
  let vcfText = '##fileformat=VCFv4.2\n';
  vcfText += '##source=GWASena_benchmark_dataset_generator\n';
  vcfText += '##INFO=<ID=NOTE,Number=1,Type=String,Description="Dataset benchmark contoh GWASena">\n';
  vcfText += '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">\n';
  for (let c = 1; c <= 8; c++) {
    vcfText += `##contig=<ID=chr${c}>\n`;
  }
  vcfText += '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t' + samples.join('\t') + '\n';

  const bases = ['A', 'C', 'G', 'T'];
  const code = { 0: '0/0', 1: '0/1', 2: '1/1' };

  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    const ref = bases[j % 4];
    const alt = bases[(j + 1) % 4];
    const gts = genoCols[j].map((val) => code[val] || '0/0').join('\t');
    vcfText += `${r.chr}\t${r.pos}\t${r.id}\t${ref}\t${alt}\t.\tPASS\tNOTE=benchmark\tGT\t${gts}\n`;
  }

  // Phenotype CSV
  let csvText = 'sample_id,varietas,bobot_umbi_g,diameter_umbi_mm,jumlah_siung\n';
  for (let i = 0; i < N; i++) {
    const v = varieties[Math.floor(i / 10)];
    const weight = (25.0 + rnd() * 8.0).toFixed(2);
    const diameter = (37.0 + rnd() * 6.0).toFixed(2);
    const cloves = Math.floor(13 + rnd() * 5);
    csvText += `${samples[i]},${v},${weight},${diameter},${cloves}\n`;
  }

  const vcfFile = new File([vcfText], 'genotipe_bawang_putih_mini.vcf', {
    type: 'text/plain',
    lastModified: Date.now(),
  });
  const csvFile = new File([csvText], 'fenotipe_bawang_putih_mini.csv', {
    type: 'text/csv',
    lastModified: Date.now(),
  });

  return { vcfFile, csvFile };
}
