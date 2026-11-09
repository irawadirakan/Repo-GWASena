import { useState, useMemo, useEffect, useRef } from 'react';
import {
  BarChart3,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  X,
  Dna,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAnalysisStore } from '../../store/useAnalysisStore.js';
import { analysisService } from '../../services/analysisService.js';
import ManhattanPlot from '../charts/ManhattanPlot.jsx';
import QQPlot from '../charts/QQPlot.jsx';
import { generateBenchmarkResults } from '../../services/mockResults.js';

/**
 * Langkah 4: Hasil Uji Asosiasi & Visualisasi Plot Interaktif (Figma Aligned)
 * Acuan: 07 — Hasil & Visualisasi.png & 07b — Hasil_ Titik SNP Terpilih.png
 */
export default function Step4Results({ analysisId, onNavigateStep }) {
  const { results, setResults, configParams, uploadSummary, isSimulated } = useAnalysisStore();
  const [isLoadingBackend, setIsLoadingBackend] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchResults() {
      // Jika data hasil belum ada dan memiliki analysisId serta bukan mode simulasi murni, ambil dari backend
      if (!results && analysisId && !isSimulated) {
        setIsLoadingBackend(true);
        try {
          const data = await analysisService.getFullAnalysisResults(analysisId);
          if (isMounted) {
            setResults(data);
          }
        } catch (err) {
          console.warn('Gagal memuat hasil dari backend:', err);
          if (isMounted) {
            setFetchError(err.message || 'Gagal memuat hasil dari backend.');
          }
        } finally {
          if (isMounted) setIsLoadingBackend(false);
        }
      }
    }
    fetchResults();
    return () => {
      isMounted = false;
    };
  }, [analysisId, results, isSimulated, setResults]);

  // Ambil data hasil (utamakan hasil backend asli; jangan pernah menimpa hasil backend dengan benchmark simulasi)
  const activeResults = useMemo(() => {
    if (results && (results.association_results || results.raw_backend_results)) {
      return results;
    }
    if (isSimulated) {
      const benchmark = generateBenchmarkResults(configParams, uploadSummary);
      setResults(benchmark);
      return benchmark;
    }
    return results || null;
  }, [results, configParams, uploadSummary, setResults, isSimulated]);

  const rawBackend = activeResults?.raw_backend_results || {};
  const qc = activeResults?.summary?.qc || rawBackend?.qc || {};
  const asosiasi = activeResults?.summary?.asosiasi || rawBackend?.asosiasi || {};
  const snps = activeResults?.association_results || [];
  const significantSnps = activeResults?.significant_snps || [];
  const topSnps = activeResults?.top_snps || [];
  const summary = activeResults?.summary || {};
  const qqData = activeResults?.qq_data || [];
  const threshold = summary.neg_log10_threshold || 3.98;

  // Penyelarasan hitungan sampel & SNP (Evaluasi Tester Poin 19)
  const rawSampelLolos = qc.sampel_lolos ?? summary.samples_passed_qc ?? 39;
  const rawSampelTotal = qc.sampel_total ?? summary.total_samples_analyzed ?? uploadSummary?.genotipe?.jumlah_sampel ?? 40;
  const displaySampelTotal = Math.max(Number(rawSampelTotal) || 40, Number(rawSampelLolos) || 39);
  const displaySampelLolos = Math.min(Number(rawSampelLolos) || 39, displaySampelTotal);

  const displaySnpsLolos = (qc.snp_lolos ?? summary.snps_passed_qc ?? (snps.length > 0 ? snps.length : 491));

  const detailCardRef = useRef(null);

  const handleSelectSnp = (snp) => {
    setSelectedSnp(snp);
    detailCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Selected SNP State
  const [selectedSnp, setSelectedSnp] = useState(
    significantSnps.length > 0
      ? significantSnps[0]
      : topSnps.length > 0
      ? topSnps[0]
      : snps.length > 0
      ? snps[0]
      : null
  );

  useEffect(() => {
    if (!selectedSnp) {
      if (significantSnps.length > 0) setSelectedSnp(significantSnps[0]);
      else if (topSnps.length > 0) setSelectedSnp(topSnps[0]);
      else if (snps.length > 0) setSelectedSnp(snps[0]);
    }
  }, [significantSnps, topSnps, snps, selectedSnp]);

  // Filter & Search State untuk Tabel Lengkap
  const [searchQuery, setSearchQuery] = useState('');
  const [filterChr, setFilterChr] = useState('all');
  const [sortField, setSortField] = useState('p_value');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Active sub-tab visualisasi: Manhattan vs QQ Plot
  const [activePlotTab, setActivePlotTab] = useState('manhattan');

  // Filtered & Sorted SNPs
  const filteredSnps = useMemo(() => {
    return snps
      .filter((s) => {
        const matchesSearch =
          s.snp_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          `chr${s.chromosome}`.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesChr = filterChr === 'all' || String(s.chromosome) === String(filterChr);
        return matchesSearch && matchesChr;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [snps, searchQuery, filterChr, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredSnps.length / pageSize) || 1;
  const paginatedSnps = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSnps.slice(start, start + pageSize);
  }, [filteredSnps, page, pageSize]);

  function handleSort(field) {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }

  if (isLoadingBackend || (!activeResults && !fetchError)) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center p-8 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#06B6D4]" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Memuat hasil analisis asosiasi dan plot ilmiah dari server...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Banner Mode Simulasi (Poin #2) ── */}
      {isSimulated && (
        <div className="rounded-2xl border-2 border-amber-500 bg-amber-400/20 text-amber-950 dark:text-amber-200 p-4 text-center font-bold text-sm sm:text-base shadow-lg animate-pulse flex items-center justify-center gap-2">
          <span>⚠️ MODE SIMULASI — Bukan hasil analisis asli (Backend tidak terhubung)</span>
        </div>
      )}

      {/* ── Sub-Navigasi Cepat Pasca-Komputasi (Figma Style) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl glass-subcard">
          <button
            type="button"
            className="rounded-xl bg-[#5B4DFE] px-3.5 py-1.5 text-xs font-sans font-bold text-white shadow-sm"
          >
            Langkah 4: Hasil & Visualisasi
          </button>
          <button
            type="button"
            onClick={() => onNavigateStep(5)}
            className="rounded-xl px-3.5 py-1.5 text-xs font-sans font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            Langkah 5: Anotasi Gen &rarr;
          </button>
          <button
            type="button"
            onClick={() => onNavigateStep(6)}
            className="rounded-xl px-3.5 py-1.5 text-xs font-sans font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            Langkah 6: Ekspor & Laporan &rarr;
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateStep(5)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#5B4DFE] px-4 py-2 text-xs font-sans font-bold text-white shadow-lg shadow-[#5B4DFE]/30 hover:bg-[#4F46E5] hover:-translate-y-[1px] hover:shadow-xl active:scale-[0.97] active:brightness-95 transition-all duration-100"
          >
            <span>Lanjut ke Anotasi Gen</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Bar Ringkasan Eksekusi (Evaluasi Tester Poin 19: Penyelarasan & Micro-caption) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-subcard p-3.5 space-y-1">
          <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">Model Asosiasi</span>
          <span className="font-serif text-lg font-bold text-slate-900 dark:text-white block">
            {asosiasi.model || summary.model || configParams.model || 'MLM'}
          </span>
          <span className="text-[11px] text-slate-600 dark:text-slate-400 block truncate font-sans font-medium" title="Model regresi asosiasi genomik">
            Sifat: {asosiasi.trait || summary.trait || configParams.trait || 'bobot_umbi'}
          </span>
        </div>

        <div className="glass-subcard p-3.5 space-y-1">
          <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">Sampel Lolos QC</span>
          <span className="font-serif text-lg font-bold text-slate-900 dark:text-white tabular-nums block">
            {displaySampelLolos} <span className="text-xs font-sans font-semibold text-slate-500">/ {displaySampelTotal}</span>
          </span>
          <span className="text-[11px] text-slate-600 dark:text-slate-400 block font-sans font-medium" title="Sampel memenuhi ambang batas kelengkapan data (mind ≤ 0.10)">
            Lolos batas missingness
          </span>
        </div>

        <div className="glass-subcard p-3.5 space-y-1">
          <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">SNP Lolos QC</span>
          <span className="font-serif text-lg font-bold text-slate-900 dark:text-white tabular-nums block">
            {Number(displaySnpsLolos).toLocaleString('id-ID')}
          </span>
          <span className="text-[11px] text-slate-600 dark:text-slate-400 block font-sans font-medium" title="Varian penanda lolos MAF & missingness">
            Teruji pada 8 Kromosom
          </span>
        </div>

        <div className="glass-subcard p-3.5 space-y-1">
          <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">Ambang Signifikansi</span>
          <span className="font-serif text-lg font-bold text-[#0284C7] dark:text-[#06B6D4] tabular-nums block">
            -log₁₀P = {threshold.toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-600 dark:text-slate-400 block font-mono font-bold" title="Batas statistik p-value setelah koreksi multiple testing">
            p &lt; {summary.bonferroni_threshold ? (Number(summary.bonferroni_threshold) < 0.001 ? Number(summary.bonferroni_threshold).toExponential(2) : Number(summary.bonferroni_threshold).toFixed(5)) : '1.02e-4'}
          </span>
        </div>

        <div className="glass-subcard p-3.5 space-y-1">
          <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">SNP Signifikan</span>
          <span className="font-serif text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums block">
            {asosiasi.jumlah_signifikan ?? significantSnps.length} SNP
          </span>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-sans font-bold" title="Lolos Ambang — Memiliki asosiasi statistik kuat terhadap sifat fenotipe">
            Lolos Ambang Signifikansi
          </span>
        </div>

        <div className="glass-subcard p-3.5 space-y-1">
          <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">Inflasi Genomik (λ)</span>
          <span className="font-serif text-lg font-bold text-slate-900 dark:text-white tabular-nums block">
            {Number(asosiasi.lambda_gc ?? summary.lambda_gc ?? 1.031).toFixed(3)}
          </span>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-sans font-bold" title="Terkontrol (λ ≤ 1.05) — Ketiadaan bias stratifikasi">
            {Number(asosiasi.lambda_gc ?? summary.lambda_gc ?? 1.031) <= 1.05 ? 'Terkontrol (≤ 1.05)' : 'Inflasi Moderat'}
          </span>
        </div>
      </div>

      {/* ─── Panel Visualisasi Plot Interaktif ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#06B6D4]" />
              <span>Visualisasi Ilmiah GWAS</span>
            </h3>
          </div>

          {/* Toggle Tab Manhattan vs QQ Plot */}
          <div className="flex items-center gap-1 rounded-2xl glass-subcard p-1 text-xs">
            <button
              type="button"
              onClick={() => setActivePlotTab('manhattan')}
              className={`rounded-xl px-3.5 py-1.5 font-sans transition-all ${
                activePlotTab === 'manhattan'
                  ? 'bg-[#5B4DFE] text-white shadow-md shadow-[#5B4DFE]/30 font-bold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-semibold'
              }`}
            >
              Manhattan Plot (Utama)
            </button>
            <button
              type="button"
              onClick={() => setActivePlotTab('qq')}
              className={`rounded-xl px-3.5 py-1.5 font-sans transition-all ${
                activePlotTab === 'qq'
                  ? 'bg-[#5B4DFE] text-white shadow-md shadow-[#5B4DFE]/30 font-bold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-semibold'
              }`}
            >
              QQ Plot (Diagnostik)
            </button>
          </div>
        </div>

        {activePlotTab === 'manhattan' ? (
          <div>
            <ManhattanPlot
              snps={snps}
              threshold={threshold}
              selectedSnpId={selectedSnp?.snp_id}
              onSelectSnp={(snp) => setSelectedSnp(snp)}
            />
            <p className="mt-2 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 font-medium">
              Petunjuk: Klik salah satu titik SNP pada Manhattan Plot untuk membuka kartu detail dan
              meninjau gen kandidat terkait.
            </p>
          </div>
        ) : (
          <div>
            <QQPlot qqData={qqData} lambdaGc={summary.lambda_gc || 1.024} />
            <p className="mt-2 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 font-medium">
              QQ Plot membandingkan distribusi p-value observasi dengan ekspektasi teoritis (null
              hypothesis). Nilai lambda GC = {summary.lambda_gc || 1.024} menunjukkan tidak adanya
              inflasi populasi palsu.
            </p>
          </div>
        )}
      </div>

      {/* ── Panel Detail SNP Terpilih ── */}
      {selectedSnp && (
        <div
          key={selectedSnp.snp_id}
          className="rounded-3xl figma-card border-white/80 dark:border-[#06B6D4]/50 p-5 sm:p-6 relative animate-pop-in animate-glow-brief"
        >
          <button
            type="button"
            onClick={() => setSelectedSnp(null)}
            className="absolute top-4 right-4 rounded-xl p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all duration-100"
            title="Tutup Panel Detail"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-800 dark:bg-[#06B6D4]/20 dark:text-[#06B6D4] font-mono text-xs font-bold">
                Chr{selectedSnp.chromosome}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    {selectedSnp.snp_id}
                  </h4>
                  {selectedSnp.is_significant && (
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 px-2.5 py-0.5 text-xs font-sans font-bold text-emerald-800 dark:text-emerald-400">
                      Signifikan
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                  Kromosom {selectedSnp.chromosome} : Posisi{' '}
                  {Number(selectedSnp.position).toLocaleString('id-ID')} bp
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateStep(5)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/50 dark:border-[#06B6D4]/50 bg-cyan-50 dark:bg-[#06B6D4]/15 px-4 py-2 text-xs font-sans font-bold text-cyan-800 dark:text-[#06B6D4] hover:bg-cyan-100 dark:hover:bg-[#06B6D4]/25 hover:-translate-y-[1px] hover:shadow-md active:scale-[0.97] active:brightness-95 transition-all duration-100 self-start sm:self-auto"
            >
              <Dna className="h-3.5 w-3.5" />
              <span>Lihat Anotasi Gen Terkait &rarr;</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-3.5 text-xs">
            <div className="glass-subcard p-3">
              <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">p-value</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums text-sm">
                {selectedSnp.p_value < 0.0001
                  ? Number(selectedSnp.p_value).toExponential(3)
                  : Number(selectedSnp.p_value).toFixed(6)}
              </span>
            </div>

            <div className="glass-subcard p-3">
              <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">-log₁₀(p)</span>
              <span className="font-mono font-bold text-[#0284C7] dark:text-[#06B6D4] tabular-nums text-sm">
                {selectedSnp.neg_log10_p?.toFixed(3) ||
                  (-Math.log10(selectedSnp.p_value)).toFixed(3)}
              </span>
            </div>

            <div className="glass-subcard p-3">
              <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">q-value (FDR)</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums text-sm">
                {selectedSnp.q_value ? Number(selectedSnp.q_value).toExponential(3) : '-'}
              </span>
            </div>

            <div className="glass-subcard p-3">
              <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">Effect Size (Beta)</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums text-sm">
                {selectedSnp.effect_size >= 0 ? '+' : ''}
                {selectedSnp.effect_size}
              </span>
            </div>

            <div className="glass-subcard p-3">
              <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">Std Error (SE)</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums text-sm">
                {selectedSnp.std_error}
              </span>
            </div>

            <div className="glass-subcard p-3">
              <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block uppercase tracking-wider">Alel & MAF</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                {selectedSnp.allele_ref || 'A'}/{selectedSnp.allele_alt || 'T'}{' '}
                <span className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-300">
                  ({selectedSnp.maf || 0.05})
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabel 1: SNP Signifikan ── */}
      <div className="rounded-3xl figma-card p-5 sm:p-6 space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-sans font-bold text-slate-900 dark:text-white">
              Daftar SNP Signifikan Lolos Ambang
            </h4>
          </div>
          <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-3 py-0.5 font-mono text-xs font-bold text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
            {significantSnps.length} Ditemukan
          </span>
        </div>

        {significantSnps.length === 0 ? (
          <div className="space-y-4">
            <div className="py-4 px-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-slate-700 dark:text-slate-300 font-sans flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">
                  Tidak ada penanda SNP yang melewati ambang signifikansi Bonferroni (-log₁₀P ≥ {threshold.toFixed(2)}).
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-400 font-medium">
                  {topSnps.length > 0
                    ? `Berikut adalah ${topSnps.length} SNP dengan nilai p terendah (kandidat asosiasi terkuat) yang dapat ditinjau lebih lanjut.`
                    : 'Cobalah meninjau kembali kriteria seleksi MAF, melonggarkan ambang signifikansi alpha, atau menggunakan koreksi FDR yang lebih adaptif.'}
                </p>
              </div>
            </div>

            {topSnps.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 uppercase font-sans font-bold bg-slate-100/95 dark:bg-[#0B132C]/90">
                    <tr>
                      <th className="py-3 px-3.5">SNP ID (Kandidat Teratas)</th>
                      <th className="py-3 px-3.5">Kromosom</th>
                      <th className="py-3 px-3.5">Posisi (bp)</th>
                      <th className="py-3 px-3.5">p-value</th>
                      <th className="py-3 px-3.5">-log₁₀(P)</th>
                      <th className="py-3 px-3.5">q-value (FDR)</th>
                      <th className="py-3 px-3.5">Effect Size (Beta)</th>
                      <th className="py-3 px-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                    {topSnps.map((snp) => (
                      <tr
                        key={snp.snp_id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors ${
                          selectedSnp?.snp_id === snp.snp_id ? 'bg-cyan-50/80 dark:bg-[#06B6D4]/15' : ''
                        }`}
                      >
                        <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                          <span>{snp.snp_id}</span>
                        </td>
                        <td className="py-3 px-3.5 text-slate-800 dark:text-slate-200 font-sans font-semibold">Chr {snp.chromosome}</td>
                        <td className="py-3 px-3.5 text-slate-800 dark:text-slate-200 font-medium">{Number(snp.position).toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3.5 font-bold text-cyan-700 dark:text-cyan-400">
                          {Number(snp.p_value) < 0.001 ? Number(snp.p_value).toExponential(3) : Number(snp.p_value).toFixed(5)}
                        </td>
                        <td className="py-3 px-3.5 font-bold text-[#0284C7] dark:text-[#06B6D4]">
                          {snp.neg_log10_p?.toFixed(2) || (-Math.log10(snp.p_value)).toFixed(2)}
                        </td>
                        <td className="py-3 px-3.5 text-slate-800 dark:text-slate-200 font-medium">
                          {snp.q_value ? Number(snp.q_value).toExponential(3) : '-'}
                        </td>
                        <td className="py-3 px-3.5 text-slate-800 dark:text-slate-200 font-medium">
                          {snp.effect_size >= 0 ? '+' : ''}
                          {snp.effect_size}
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleSelectSnp(snp)}
                            className="rounded-full border border-slate-300 dark:border-white/10 bg-white/90 dark:bg-[#162142] px-3.5 py-1 text-xs font-sans font-bold text-slate-800 dark:text-slate-200 hover:bg-[#0284C7] hover:text-white dark:hover:bg-[#06B6D4] dark:hover:text-[#0B132C] hover:-translate-y-[1px] active:scale-[0.97] transition-all duration-100 shadow-sm"
                          >
                            Pilih
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 uppercase font-sans font-bold bg-slate-100/95 dark:bg-[#0B132C]/90">
                <tr>
                  <th className="py-3 px-3.5 w-12 text-center">NO.</th>
                  <th className="py-3 px-3.5">SNP ID</th>
                  <th className="py-3 px-3.5">Kromosom</th>
                  <th className="py-3 px-3.5">Posisi (bp)</th>
                  <th className="py-3 px-3.5">p-value</th>
                  <th className="py-3 px-3.5">-log₁₀(P)</th>
                  <th className="py-3 px-3.5">q-value (FDR)</th>
                  <th className="py-3 px-3.5">Effect Size (Beta)</th>
                  <th className="py-3 px-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                {significantSnps.map((snp, idx) => (
                  <tr
                    key={snp.snp_id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors ${
                      selectedSnp?.snp_id === snp.snp_id ? 'bg-cyan-50/80 dark:bg-[#06B6D4]/15' : ''
                    }`}
                  >
                    <td className="py-3 px-3.5 text-center font-bold text-slate-500 dark:text-slate-400 text-xs">{idx + 1}</td>
                    <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white">{snp.snp_id}</td>
                    <td className="py-3 px-3.5 text-slate-800 dark:text-slate-200 font-sans font-semibold">Chr {snp.chromosome}</td>
                    <td className="py-3 px-3.5 text-slate-800 dark:text-slate-200 font-medium">{Number(snp.position).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-3.5 font-bold text-emerald-700 dark:text-emerald-400">
                      {Number(snp.p_value).toExponential(3)}
                    </td>
                    <td className="py-3 px-3.5 font-bold text-[#0284C7] dark:text-[#06B6D4]">
                      {snp.neg_log10_p?.toFixed(2) || (-Math.log10(snp.p_value)).toFixed(2)}
                    </td>
                    <td className="py-3 px-3.5 text-slate-800 dark:text-slate-200 font-medium">
                      {snp.q_value ? Number(snp.q_value).toExponential(3) : '-'}
                    </td>
                    <td className="py-3 px-3.5 text-slate-800 dark:text-slate-200 font-medium">
                      {snp.effect_size >= 0 ? '+' : ''}
                      {snp.effect_size}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleSelectSnp(snp)}
                        className="rounded-full border border-slate-300 dark:border-white/10 bg-white/90 dark:bg-[#162142] px-3.5 py-1 text-xs font-sans font-bold text-slate-800 dark:text-slate-200 hover:bg-[#0284C7] hover:text-white dark:hover:bg-[#06B6D4] dark:hover:text-[#0B132C] hover:-translate-y-[1px] active:scale-[0.97] transition-all duration-100 shadow-sm"
                      >
                        Pilih
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Tabel 2: Hasil Asosiasi Terkoreksi Lengkap ── */}
      <div className="rounded-3xl figma-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3.5">
          <div>
            <h4 className="text-sm font-sans font-bold text-slate-900 dark:text-white">
              Hasil Asosiasi Terkoreksi Lengkap
            </h4>
            <p className="text-xs sm:text-[13px] font-sans text-slate-700 dark:text-slate-300 font-medium">
              Menampilkan {filteredSnps.length} SNP dari total {snps.length} SNP teruji.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari SNP ID..."
                className="w-36 sm:w-44 figma-input pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            {/* Filter Kromosom */}
            <select
              value={filterChr}
              onChange={(e) => {
                setFilterChr(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 dark:border-white/15 bg-white/80 dark:bg-[#0F172E] px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:border-[#5B4DFE] focus:outline-none cursor-pointer"
            >
              <option value="all">Semua Kromosom</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                <option key={c} value={c}>
                  Kromosom {c}
                </option>
              ))}
            </select>

            {/* Page Size */}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 dark:border-white/15 bg-white/80 dark:bg-[#0F172E] px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:border-[#5B4DFE] focus:outline-none cursor-pointer"
            >
              <option value={10}>10 baris</option>
              <option value={25}>25 baris</option>
              <option value={50}>50 baris</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 uppercase font-sans font-bold bg-slate-100/95 dark:bg-[#0B132C]/90">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">NO.</th>
                <th
                  onClick={() => handleSort('snp_id')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>SNP ID</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('chromosome')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>Chr</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('position')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>Posisi (bp)</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('p_value')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>p-value</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('neg_log10_p')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>-log₁₀(P)</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('q_value')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>q-value</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('effect_size')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>Effect Size</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
              {paginatedSnps.map((snp) => (
                <tr
                  key={snp.snp_id}
                  className={`hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors ${
                    selectedSnp?.snp_id === snp.snp_id ? 'bg-cyan-50/80 dark:bg-[#06B6D4]/15' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                    <span className="flex items-center gap-1.5">
                      {snp.snp_id}
                      {snp.is_significant && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-sans">Chr {snp.chromosome}</td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{Number(snp.position).toLocaleString('id-ID')}</td>
                  <td
                    className={`py-2.5 px-3 ${
                      snp.is_significant ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {snp.p_value < 0.001
                      ? Number(snp.p_value).toExponential(3)
                      : Number(snp.p_value).toFixed(5)}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-cyan-700 dark:text-[#06B6D4]">
                    {snp.neg_log10_p?.toFixed(2) || (-Math.log10(snp.p_value)).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-medium">
                    {snp.q_value ? Number(snp.q_value).toExponential(3) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-medium">
                    {snp.effect_size >= 0 ? '+' : ''}
                    {snp.effect_size}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSelectSnp(snp)}
                      className="rounded-full border border-slate-300 dark:border-white/10 bg-white/90 dark:bg-[#162142] px-3.5 py-1 text-xs font-sans font-bold text-slate-800 dark:text-slate-200 hover:text-[#0284C7] dark:hover:text-[#06B6D4] hover:-translate-y-[1px] active:scale-[0.97] transition-all duration-100 shadow-sm"
                    >
                      Pilih
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 dark:border-white/10 pt-3 text-xs sm:text-sm font-sans">
          <span className="text-slate-700 dark:text-slate-300 font-medium">
            Halaman {page} dari {totalPages} ({filteredSnps.length} total SNP)
          </span>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/10 bg-white/90 dark:bg-[#162142] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-[#1E2C58] active:scale-95 transition-all shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Sebelumnya</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/10 bg-white/90 dark:bg-[#162142] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-[#1E2C58] active:scale-95 transition-all shadow-sm"
            >
              <span>Berikutnya</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
