import { useState } from 'react';
import {
  Dna,
  Database,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Search,
  BookOpen,
} from 'lucide-react';
import { useAnalysisStore } from '../../store/useAnalysisStore.js';
import { generateBenchmarkResults } from '../../services/mockResults.js';

/**
 * Step5Annotation (Langkah 5): Anotasi Kandidat Gen (Figma Aligned)
 * Acuan: 08 — Anotasi Gen (Selesai).png & 08b — Anotasi Gen_ Tidak Tersedia.png
 *
 * Menampilkan pemetaan SNP signifikan ke kandidat gen
 * serta mekanisme non-blocking fallback jika layanan referensi offline.
 */
export default function Step5Annotation({ onNavigateStep }) {
  const { results, configParams, uploadSummary } = useAnalysisStore();

  const activeResults = results || generateBenchmarkResults(configParams, uploadSummary);
  const candidateGenes = activeResults.candidate_genes || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [isSimulateFallback, setIsSimulateFallback] = useState(false);

  const filteredGenes = candidateGenes.filter((gene) => {
    const q = searchQuery.toLowerCase();
    return (
      gene.snp_id.toLowerCase().includes(q) ||
      gene.gene_id.toLowerCase().includes(q) ||
      gene.gene_name.toLowerCase().includes(q) ||
      gene.consequence.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Sub-Navigasi Cepat Pasca-Komputasi (Figma Style) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl glass-subcard">
          <button
            type="button"
            onClick={() => onNavigateStep(4)}
            className="rounded-xl px-3.5 py-1.5 text-xs font-sans font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            &larr; Langkah 4: Hasil & Visualisasi
          </button>
          <button
            type="button"
            className="rounded-xl bg-blue-600 dark:bg-blue-500 px-3.5 py-1.5 text-xs font-sans font-semibold text-white shadow-sm"
          >
            Langkah 5: Anotasi Gen
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
            onClick={() => onNavigateStep(4)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#162142] px-3.5 py-2 text-xs font-sans font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1E2C58] hover:-translate-y-[1px] active:scale-[0.97] active:brightness-95 transition-all duration-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Plot</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateStep(6)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 px-4 py-2 text-xs font-sans font-semibold text-white shadow-sm hover:-translate-y-[1px] hover:shadow-md active:scale-[0.98] transition-all duration-100"
          >
            <span>Lanjut ke Ekspor</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Banner Status Referensi Genom ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl figma-card p-4 sm:p-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-[#5B4DFE]/20 text-indigo-600 dark:text-[#06B6D4]">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Basis Data Referensi Genom: Ensembl Genomes Reference Pipeline</span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-0.5 text-xs font-sans font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                Ensembl Plants REST API Terhubung
              </span>
            </h4>
            <p className="text-xs sm:text-[13px] font-sans text-slate-700 dark:text-slate-300 font-medium">
              Pemetaan posisi lokus penanda SNP ke struktur ekson, intron, dan daerah pengatur gen
              (annotation window: &plusmn;20 kb).
            </p>
          </div>
        </div>

        {/* Demo Switch Fallback */}
        <button
          type="button"
          onClick={() => setIsSimulateFallback(!isSimulateFallback)}
          className="rounded-full border border-slate-300 dark:border-white/10 bg-white/90 dark:bg-[#162142] px-4 py-1.5 text-xs font-sans font-bold text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E2C58] hover:-translate-y-[1px] active:scale-[0.97] transition-all duration-100 self-start sm:self-auto shadow-sm"
          title="Uji ketahanan sistem jika server referensi luar offline"
        >
          {isSimulateFallback ? 'Pulihkan Status Normal' : 'Simulasi Layanan Luar Offline'}
        </button>
      </div>

      {/* ── State Non-Blocking Fallback ── */}
      {isSimulateFallback ? (
        <div className="rounded-3xl figma-card border-amber-300/80 dark:border-amber-500/40 bg-amber-50/80 dark:bg-amber-500/10 p-5 sm:p-6 space-y-3 animate-fade-in backdrop-blur-md">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-sans font-bold text-amber-950 dark:text-white">
                Layanan Referensi Anotasi Gen Sedang Tidak Tersedia
              </h4>
              <p className="text-xs font-serif leading-relaxed text-amber-900 dark:text-slate-300">
                Server API Ensembl Plants eksternal sedang mengalami latensi tinggi atau tidak dapat
                dihubungi. Sesuai prinsip ketahanan sistem GWASena 2.0, kegagalan anotasi gen bersifat{' '}
                <strong>non-fatal</strong>. Hasil statistik asosiasi Anda pada Langkah 4 dan fitur
                unduh CSV pada Langkah 6 tetap dapat digunakan sepenuhnya tanpa hambatan.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => onNavigateStep(6)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 px-4 py-2 text-xs font-sans font-semibold text-white shadow-sm hover:-translate-y-[1px] hover:shadow-md active:scale-[0.98] transition-all duration-100"
            >
              <span>Lanjut ke Pengunduhan Data (Langkah 6) &rarr;</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── State Normal: Tabel Kandidat Gen ── */
        <div className="rounded-3xl figma-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3.5">
            <div>
              <h4 className="text-sm sm:text-base font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Dna className="h-4 w-4 text-[#06B6D4]" />
                <span>Tabel Pemetaan Kandidat Gen</span>
              </h4>
              <p className="text-xs sm:text-[13px] font-sans text-slate-700 dark:text-slate-300 font-medium">
                Ditemukan {candidateGenes.length} kandidat gen fungsional yang berdekatan dengan SNP
                signifikan.
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari gen / SNP..."
                className="w-48 sm:w-64 figma-input pl-8 pr-3 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 uppercase font-sans font-bold bg-slate-100/95 dark:bg-[#0B132C]/90">
                <tr>
                  <th className="py-3 px-3.5">SNP ID</th>
                  <th className="py-3 px-3.5">Kromosom & Posisi</th>
                  <th className="py-3 px-3.5">Kandidat Gen</th>
                  <th className="py-3 px-3.5">Jarak / Posisi Relatif</th>
                  <th className="py-3 px-3.5">Konsekuensi Fungsional</th>
                  <th className="py-3 px-3.5">Deskripsi Biologis & Agronomi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredGenes.map((gene) => (
                  <tr key={gene.snp_id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3.5 font-mono font-bold text-[#0284C7] dark:text-[#06B6D4]">{gene.snp_id}</td>
                    <td className="py-3 px-3.5 font-mono text-slate-900 dark:text-white tabular-nums font-semibold">
                      Chr {gene.chromosome} : {Number(gene.position).toLocaleString('id-ID')} bp
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="space-y-0.5">
                        <span className="font-mono font-bold text-slate-900 dark:text-white block">
                          {gene.gene_id}
                        </span>
                        <span className="text-xs font-serif text-slate-600 dark:text-slate-300 italic block font-semibold">
                          {gene.gene_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-slate-800 dark:text-slate-200 font-medium">{gene.distance}</td>
                    <td className="py-3 px-3.5">
                      <span className="inline-block rounded-xl border border-indigo-200 dark:border-[#5B4DFE]/30 bg-indigo-50 dark:bg-[#5B4DFE]/15 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-700 dark:text-[#A5B4FC]">
                        {gene.consequence}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 max-w-sm font-serif text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-relaxed">
                      {gene.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass-subcard p-3.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2.5 font-medium">
            <BookOpen className="h-4 w-4 text-[#0284C7] dark:text-[#06B6D4] shrink-0 mt-0.5" />
            <p className="font-sans leading-relaxed">
              Anotasi gen biologis memetakan lokus kuantitatif (QTL) asosiasi dengan gen penentu sifat fungsional,
              regulasi ekspresi genetik, dan jalur biosintesis spesifik populasi.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
