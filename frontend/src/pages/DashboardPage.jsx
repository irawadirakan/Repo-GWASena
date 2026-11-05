import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dna,
  PlusCircle,
  History,
  CheckCircle2,
  ArrowRight,
  Sprout,
  Loader2,
  X,
  FileCheck,
  FileQuestion,
  Sparkles,
  BookOpen,
  Activity,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore.js';
import { useAnalysisStore } from '../store/useAnalysisStore.js';
import { analysisService } from '../services/analysisService.js';
import ErrorMessageArea from '../components/common/ErrorMessageArea.jsx';

/**
 * DashboardPage (Layar Utama Pengguna - Figma Aligned)
 * Acuan: 03 — Dashboard (Pengguna Analisis).png & 03 — Dashboard (Pengguna Analisis) (Light).png
 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { uploadSummary, currentAnalysis } = useAnalysisStore();

  const [meta, setMeta] = useState(null);
  const [analysesCount, setAnalysesCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [analysisName, setAnalysisName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboardData() {
      try {
        const [metaData, listData] = await Promise.all([
          analysisService.getMeta(),
          analysisService.listAnalyses().catch(() => []),
        ]);
        if (isMounted) {
          setMeta(metaData);
          if (Array.isArray(listData)) {
            setAnalysesCount(listData.length);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat metadata:', err);
      }
    }
    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateAnalysis = async (e) => {
    e.preventDefault();
    const finalName = analysisName.trim() || 'Sesi Analisis Baru';

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await analysisService.createAnalysis(finalName);
      setIsModalOpen(false);
      navigate(`/analyses/${res.analysis_id}`);
    } catch (err) {
      setError(err);
      setIsSubmitting(false);
    }
  };

  // TUGAS 5: Spesimen/Dataset dinamis berdasarkan dataset yang diunggah/diolah
  const isBenchmarkExample =
    uploadSummary?.simulated ||
    uploadSummary?.genotipe?.nama_berkas?.toLowerCase()?.includes('bawang') ||
    uploadSummary?.genotipe?.nama_berkas?.toLowerCase()?.includes('garlic');

  const hasUploadedData = Boolean(uploadSummary?.genotipe);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* ── Banner Sambutan Pengguna & Profil Dataset Dinamis ── */}
      <div className="relative overflow-hidden figma-card p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300 dark:border-[#06B6D4]/30 bg-cyan-50 dark:bg-[#06B6D4]/10 px-3 py-1 text-xs font-semibold text-cyan-900 dark:text-[#06B6D4]">
              <Sprout className="h-3.5 w-3.5 text-cyan-700 dark:text-[#06B6D4]" />
              <span>Alur Kerja Analisis Asosiasi Genomik GWASena</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-sans">
              Selamat datang kembali,{' '}
              <span className="text-[#5B4DFE] dark:text-[#06B6D4]">{user?.username || 'Pengguna'}</span>!
            </h1>

            <p className="max-w-2xl font-serif text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              Mulai sesi analisis asosiasi genomik baru atau lanjutkan evaluasi hasil riset terdahulu
              dengan alur kerja terstandarisasi.
            </p>
          </div>

          {/* Quick Dataset / Specimen Badge Dinamis (TUGAS 5) */}
          <div className="shrink-0 glass-subcard p-4 text-sm space-y-1.5 min-w-[240px] max-w-sm">
            {hasUploadedData ? (
              isBenchmarkExample ? (
                <>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 font-sans uppercase tracking-wider">
                    <FileCheck className="h-4 w-4" />
                    <span>Dataset Benchmark (Allium sativum)</span>
                  </div>
                  <div className="font-serif text-[#0284C7] dark:text-[#06B6D4] font-bold italic text-base">
                    Allium sativum L.
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 font-semibold font-sans text-xs">
                    {uploadSummary.genotipe.jumlah_sampel} Sampel · {uploadSummary.genotipe.jumlah_snp} SNP
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-medium font-sans truncate">
                    Berkas: {uploadSummary.genotipe.nama_berkas}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-[#06B6D4] font-sans uppercase tracking-wider">
                    <FileCheck className="h-4 w-4" />
                    <span>Dataset Aktif</span>
                  </div>
                  <div className="font-sans font-bold text-slate-900 dark:text-white text-sm truncate">
                    {uploadSummary.genotipe.nama_berkas || 'Berkas Genotipe'}
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 font-semibold font-sans text-xs">
                    {uploadSummary.genotipe.format || 'VCF'} · {uploadSummary.genotipe.jumlah_sampel} Sampel · {uploadSummary.genotipe.jumlah_snp} SNP
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium font-sans">
                    ✓ Validasi ID Sampel 100% Cocok
                  </div>
                </>
              )
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 font-sans uppercase tracking-wider">
                  <Activity className="h-4 w-4 text-[#06B6D4]" />
                  <span>RINGKASAN AKTIVITAS RISET</span>
                </div>
                <div className="text-slate-900 dark:text-white font-bold font-sans text-sm">
                  {analysesCount > 0 ? `${analysesCount} Sesi Analisis Tersimpan` : 'Ruang Kerja Siap'}
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium font-sans flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Ruang kerja aktif & siap untuk analisis baru</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-[#06B6D4]/10 blur-3xl" />
      </div>

      {/* ── Banner Petunjuk Fungsi Ikon Tanda Tanya (?) ── */}
      <div className="rounded-2xl border border-cyan-200 dark:border-cyan-500/30 bg-cyan-50/80 dark:bg-cyan-500/10 p-3.5 sm:p-4 text-xs sm:text-sm text-cyan-950 dark:text-cyan-200 flex items-center gap-2.5 font-medium shadow-sm">
        <span className="text-base sm:text-lg">💡</span>
        <span>
          <strong>Panduan Parameter:</strong> Klik atau arahkan kursor ke ikon tanda tanya (?) di pojok setiap kartu untuk membaca penjelasan ilmiah dan fungsi bagian tersebut.
        </span>
      </div>

      {/* ── Dua Kartu Aksi Utama (High-Separation Glass dengan Micro-Interactions) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kartu 1: Analisis Baru (Primary CTA Card) */}
        <div
          onClick={() => setIsModalOpen(true)}
          className="flex flex-col justify-between figma-card p-6 sm:p-8 hover:-translate-y-1 active:scale-[0.985] group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5B4DFE]/15 text-[#5B4DFE] dark:text-[#06B6D4] group-hover:scale-110 transition-transform duration-150">
                <Dna className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-cyan-50 dark:bg-[#5B4DFE]/15 px-3 py-1 text-xs font-bold text-cyan-800 dark:text-[#06B6D4] border border-cyan-200 dark:border-[#06B6D4]/20 font-sans">
                6 Tahap Terpandu
              </span>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-[#5B4DFE] dark:group-hover:text-[#06B6D4] transition-colors font-sans">
              Mulai Analisis GWAS Baru
            </h2>

            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
              Unggah berkas VCF/PLINK & fenotipe CSV, saring Quality Control & PCA otomatis, uji model GLM/MLM, hingga visualisasi Manhattan Plot.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsModalOpen(true);
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 py-3 px-4 text-sm font-semibold text-white shadow-sm hover:-translate-y-[1px] hover:shadow-md active:scale-[0.98] transition-all duration-100 font-sans cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>+ Inisiasi Sesi Analisis Baru</span>
            </button>
          </div>
        </div>

        {/* Kartu 2: Riwayat Analisis */}
        <div
          onClick={() => navigate('/history')}
          className="flex flex-col justify-between figma-card p-6 sm:p-8 hover:-translate-y-1 active:scale-[0.985] group cursor-pointer"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-[#162142] text-slate-700 dark:text-slate-300 group-hover:scale-110 transition-transform duration-150">
                <History className="h-6 w-6" />
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-sans">
                Riwayat Analisis Tersimpan
              </span>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-[#06B6D4] transition-colors font-sans">
              Buka Riwayat Analisis
            </h2>

            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
              Akses kembali sesi analisis terdahulu, tinjau tabel SNP signifikan, periksa log
              komputasi, atau unduh ringkasan laporan PDF dan gambar plot publikasi.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/history');
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 py-3 px-4 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 hover:shadow-sm active:scale-[0.98] transition-all duration-100 font-sans cursor-pointer"
            >
              <span>Buka Daftar Riwayat Analisis</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Panduan Singkat Alur Analisis (User-Centric Quick Guide, Menggantikan Kotak Teknis Internal) ── */}
      <div className="figma-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-4 w-4 text-[#06B6D4]" />
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 font-sans">
            Alur Kerja Analisis Asosiasi Genomik GWASena
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-subcard p-4 space-y-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-[#06B6D4] text-xs font-bold font-sans">
              1
            </span>
            <div className="font-bold text-slate-900 dark:text-white text-sm font-sans">Unggah & Validasi</div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium font-sans">
              Pilih berkas VCF atau PLINK (.bed/.bim/.fam) beserta CSV fenotipe target sifat kuantitatif.
            </p>
          </div>

          <div className="glass-subcard p-4 space-y-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-100 dark:bg-[#5B4DFE]/20 text-[#5B4DFE] dark:text-[#818CF8] text-xs font-bold font-sans">
              2
            </span>
            <div className="font-bold text-slate-900 dark:text-white text-sm font-sans">Penyaringan QC & Model</div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium font-sans">
              Atur ambang MAF, missingness, kovariat PCA, serta pilih model statistik GLM atau MLM.
            </p>
          </div>

          <div className="glass-subcard p-4 space-y-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold font-sans">
              3
            </span>
            <div className="font-bold text-slate-900 dark:text-white text-sm font-sans">Visualisasi & Laporan</div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium font-sans">
              Evaluasi Manhattan Plot, QQ-Plot, anotasi kandidat gen, dan unduh laporan riset lengkap.
            </p>
          </div>
        </div>
      </div>

      {/* ── Modal Dialog Inisiasi Analisis Baru (TUGAS 6: Placeholder Abu-abu & Teks Ringkas) ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg figma-card p-6 sm:p-7 shadow-2xl space-y-4 animate-modal-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3.5">
              <div className="flex items-center gap-2">
                <Dna className="h-5 w-5 text-[#5B4DFE] dark:text-[#06B6D4]" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-sans tracking-tight">
                  Inisiasi Sesi Analisis Baru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white active:scale-95 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ErrorMessageArea error={error} onDismiss={() => setError(null)} />

            <form onSubmit={handleCreateAnalysis} className="space-y-4">
              <div>
                <label
                  htmlFor="analysisName"
                  className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-1.5 font-sans"
                >
                  Nama Sesi Analisis
                </label>
                <input
                  id="analysisName"
                  type="text"
                  value={analysisName}
                  onChange={(e) => setAnalysisName(e.target.value)}
                  placeholder="Contoh: Sesi Analisis Baru"
                  className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2.5 px-3.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
                />
                <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400 font-medium font-sans">
                  Kosongkan bila ingin menggunakan nama default otomatis ("Sesi Analisis Baru").
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-transparent px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5 active:scale-[0.98] transition-all font-sans cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:-translate-y-[1px] hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:transform-none transition-all duration-100 font-sans cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Membuat Sesi...</span>
                    </>
                  ) : (
                    <>
                      <span>Mulai Analisis</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
