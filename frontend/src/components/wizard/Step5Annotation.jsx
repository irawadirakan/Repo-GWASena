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
 * S-08 (Langkah 5): Anotasi Kandidat Gen (Figma Aligned)
 * Acuan: 08 — Anotasi Gen (Selesai).png & 08b — Anotasi Gen_ Tidak Tersedia.png
 *
 * Menampilkan pemetaan SNP signifikan ke kandidat gen Allium sativum
 * serta mekanisme non-blocking fallback jika layanan referensi offline (AC-07.2).
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
            className="rounded-xl bg-[#5B4DFE] px-3.5 py-1.5 text-xs font-sans font-bold text-white shadow-sm"
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#5B4DFE] px-4 py-2 text-xs font-sans font-bold text-white shadow-lg shadow-[#5B4DFE]/30 hover:bg-[#4F46E5] hover:-translate-y-[1px] hover:shadow-xl active:scale-[0.97] active:brightness-95 transition-all duration-100"
          >
            <span>Lanjut ke Ekspor</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Banner Status Referensi Genom Bawang Putih ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl figma-card p-4 sm:p-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-[#5B4DFE]/20 text-indigo-600 dark:text-[#06B6D4]">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Basis Data Referensi: <em className="font-serif italic font-normal">Allium sativum</em> L. ASM12345v1</span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-sans font-semibold text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                Ensembl Plants REST API Terhubung
              </span>
            </h4>
            <p className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
              Pemetaan posisi lokus penanda SNP ke struktur ekson, intron, dan daerah pengatur gen
              (annotation window: &plusmn;20 kb).
            </p>
          </div>
        </div>

        {/* Demo Switch Fallback AC-07.2 */}
        <button
          type="button"
          onClick={() => setIsSimulateFallback(!isSimulateFallback)}
          className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#162142] px-3 py-1.5 text-[11px] font-sans font-semibold text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1E2C58] hover:-translate-y-[1px] active:scale-[0.97] active:brightness-95 transition-all duration-100 self-start sm:self-auto"
          title="Uji ketahanan sistem jika server referensi luar offline"
        >
          {isSimulateFallback ? 'Pulihkan Status Normal' : 'Simulasi Offline (AC-07.2)'}
        </button>
      </div>

      {/* ── State Non-Blocking Fallback (AC-07.2 - Figma 08b) ── */}
      {isSimulateFallback ? (
        <div className="rounded-3xl figma-card border-amber-300/80 dark:border-amber-500/40 bg-amber-50/80 dark:bg-amber-500/10 p-5 sm:p-6 space-y-3 animate-fade-in backdrop-blur-md">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-sans font-bold text-amber-950 dark:text-white">
                Layanan Referensi Anotasi Gen Sedang Tidak Tersedia (Non-Blocking AC-07.2)
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
              className="inline-flex items-center gap-2 rounded-xl bg-[#5B4DFE] px-4 py-2 text-xs font-sans font-bold text-white shadow-lg shadow-[#5B4DFE]/30 hover:bg-[#4F46E5] hover:-translate-y-[1px] hover:shadow-xl active:scale-[0.97] active:brightness-95 transition-all duration-100"
            >
              <span>Lanjut ke Pengunduhan Data (Langkah 6) &rarr;</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── State Normal: Tabel Kandidat Gen (AC-07.1 - Figma 08) ── */
        <div className="rounded-3xl figma-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3.5">
            <div>
              <h4 className="text-sm font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Dna className="h-4 w-4 text-[#06B6D4]" />
                <span>Tabel Pemetaan Kandidat Gen (AC-07.1)</span>
              </h4>
              <p className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
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
                className="w-48 sm:w-64 figma-input pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-white/10 text-[11px] text-slate-600 dark:text-slate-400 uppercase font-sans font-semibold bg-slate-100/90 dark:bg-[#0B132C]/90">
                <tr>
                  <th className="py-2.5 px-3">SNP ID</th>
                  <th className="py-2.5 px-3">Kromosom & Posisi</th>
                  <th className="py-2.5 px-3">Kandidat Gen</th>
                  <th className="py-2.5 px-3">Jarak / Posisi Relatif</th>
                  <th className="py-2.5 px-3">Konsekuensi Fungsional</th>
                  <th className="py-2.5 px-3">Deskripsi Biologis & Agronomi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredGenes.map((gene) => (
                  <tr key={gene.snp_id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-cyan-700 dark:text-[#06B6D4]">{gene.snp_id}</td>
                    <td className="py-3 px-3 font-mono text-slate-900 dark:text-white tabular-nums">
                      Chr {gene.chromosome} : {Number(gene.position).toLocaleString('id-ID')} bp
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <span className="font-mono font-bold text-slate-900 dark:text-white block">
                          {gene.gene_id}
                        </span>
                        <span className="text-[11px] font-serif text-slate-500 dark:text-slate-400 italic block">
                          {gene.gene_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">{gene.distance}</td>
                    <td className="py-3 px-3">
                      <span className="inline-block rounded-xl border border-indigo-200 dark:border-[#5B4DFE]/30 bg-indigo-50 dark:bg-[#5B4DFE]/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-700 dark:text-[#A5B4FC]">
                        {gene.consequence}
                      </span>
                    </td>
                    <td className="py-3 px-3 max-w-sm font-serif text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                      {gene.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass-subcard p-3.5 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
            <BookOpen className="h-4 w-4 text-[#06B6D4] shrink-0 mt-0.5" />
            <p className="font-sans leading-relaxed">
              Anotasi gen biologis memetakan lokus kuantitatif (QTL) asosiasi dengan metabolisme
              organosulfur (alliin) dan regulasi pembesaran umbi bawang putih <em className="font-serif italic font-normal">Allium sativum</em> L.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
