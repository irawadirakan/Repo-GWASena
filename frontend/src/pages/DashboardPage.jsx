import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dna,
  PlusCircle,
  History,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sprout,
  Loader2,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore.js';
import { analysisService } from '../services/analysisService.js';
import ErrorMessageArea from '../components/common/ErrorMessageArea.jsx';

/**
 * S-03: DashboardPage (Layar Utama Peneliti - Figma Aligned with Micro-Interactions)
 * Acuan: 03 — Dashboard (Pengguna Analisis).png & 03 — Dashboard (Pengguna Analisis) (Light).png
 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [meta, setMeta] = useState(null);
  const [health, setHealth] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [analysisName, setAnalysisName] = useState('Analisis Bobot Umbi Bawang Putih');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboardData() {
      try {
        const [metaData, healthData] = await Promise.allSettled([
          analysisService.getMeta(),
          analysisService.checkHealth(),
        ]);
        if (isMounted) {
          if (metaData.status === 'fulfilled') setMeta(metaData.value);
          if (healthData.status === 'fulfilled') setHealth(healthData.value);
        }
      } catch (err) {
        console.error('Gagal memuat data dashboard:', err);
      }
    }
    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateAnalysis = async (e) => {
    e.preventDefault();
    if (!analysisName.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await analysisService.createAnalysis(analysisName.trim());
      setIsModalOpen(false);
      navigate(`/analyses/${res.analysis_id}`);
    } catch (err) {
      setError(err);
      setIsSubmitting(false);
    }
  };

  const org = meta?.organisme;
  const isHealthy = health?.status === 'ok';

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* ── Banner Sambutan Peneliti & Organisme (3-Layer High Separation Glass) ── */}
      <div className="relative overflow-hidden figma-card p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300 dark:border-[#06B6D4]/30 bg-cyan-50 dark:bg-[#06B6D4]/10 px-3 py-1 text-xs font-semibold text-cyan-900 dark:text-[#06B6D4]">
              <Sprout className="h-3.5 w-3.5 text-cyan-700 dark:text-[#06B6D4]" />
              <span>Studi Kasus Agronomi: Bawang Putih (<span className="font-serif italic font-bold">Allium sativum</span> L.)</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-sans">
              Selamat datang kembali,{' '}
              <span className="text-[#5B4DFE] dark:text-[#06B6D4]">{user?.username || 'Peneliti'}</span>!
            </h1>

            <p className="max-w-2xl font-serif text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              Mulai sesi analisis asosiasi genomik baru atau lanjutkan evaluasi hasil riset terdahulu
              pada genom 8 kromosom bawang putih.
            </p>
          </div>

          {/* Quick Species Badge */}
          {org && (
            <div className="shrink-0 glass-subcard p-4 text-xs space-y-1.5 min-w-[220px]">
              <span className="font-semibold text-slate-800 dark:text-white block font-sans">Spesimen Aktif:</span>
              <div className="font-serif text-[#5B4DFE] dark:text-[#06B6D4] font-bold italic text-base">
                {org.nama_ilmiah}
              </div>
              <div className="text-slate-600 dark:text-slate-400 font-sans">
                {org.ploidi} · {org.jumlah_kromosom} Pasang Kromosom
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                Ukuran Genom: {org.ukuran_genom_perkiraan}
              </div>
            </div>
          )}
        </div>

        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-[#06B6D4]/10 blur-3xl" />
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
                Alur Wizard 6 Langkah
              </span>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-[#5B4DFE] dark:group-hover:text-[#06B6D4] transition-colors font-sans">
              Mulai Analisis GWAS Baru
            </h2>

            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
              Jalankan siklus terpadu: unggah VCF & fenotipe CSV, penyaringan Quality Control, kovariat
              PCA otomatis, model GLM/MLM, hingga visualisasi Manhattan Plot interaktif.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsModalOpen(true);
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#5B4DFE] py-3 px-4 text-sm font-bold text-white shadow-lg shadow-[#5B4DFE]/30 hover:bg-[#4F46E5] hover:shadow-xl active:scale-[0.97] active:brightness-95 transition-all duration-100 font-sans"
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
                Riwayat Tersimpan (FR-12)
              </span>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-[#5B4DFE] dark:group-hover:text-[#06B6D4] transition-colors font-sans">
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
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#162142] py-3 px-4 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1E2C58] hover:shadow-md active:scale-[0.97] active:brightness-95 transition-all duration-100 font-sans"
            >
              <span>Buka Daftar Riwayat Analisis</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Panel Status Infrastruktur Ringkas (High Separation Glass) ── */}
      <div className="figma-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#06B6D4]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400 font-sans">
              Kesiapan Infrastruktur Komputasi
            </h3>
          </div>
          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-sans">
            Status: {isHealthy ? 'Optimal' : 'Memeriksa...'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* API Backend */}
          <div className="flex items-center gap-3 glass-subcard p-3 text-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block font-sans">FastAPI Engine</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">REST API v0.1.1 Siap</span>
            </div>
          </div>

          {/* Database PostgreSQL */}
          <div className="flex items-center gap-3 glass-subcard p-3 text-xs">
            {health?.components?.database?.ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block font-sans">PostgreSQL 16</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                {health?.components?.database?.tables?.length || 12} Tabel Terindeks
              </span>
            </div>
          </div>

          {/* Celery & Redis */}
          <div className="flex items-center gap-3 glass-subcard p-3 text-xs">
            {health?.components?.redis?.ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block font-sans">Celery & Redis</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">Antrean Tugas Asinkron</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Dialog Inisiasi Analisis Baru (Dengan Modal Scale-in & Backdrop Fade) ── */}
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
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 font-sans"
                >
                  Nama Sesi Analisis
                </label>
                <input
                  id="analysisName"
                  type="text"
                  required
                  value={analysisName}
                  onChange={(e) => setAnalysisName(e.target.value)}
                  placeholder="Contoh: GWAS Bobot Umbi Bawang Putih 2026"
                  className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2.5 px-3.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] font-medium"
                />
                <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                  Beri nama deskriptif sesuai sifat agronomi atau aksesi kultivar yang diuji.
                </span>
              </div>

              <div className="glass-subcard p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <div className="font-semibold text-slate-800 dark:text-white font-sans">Tahap Berikutnya:</div>
                <p className="font-sans">
                  Setelah sesi dibuat, Anda akan diarahkan ke <strong>Langkah 1 (Unggah Data)</strong> untuk memilih berkas genotipe (.vcf / .vcf.gz) dan fenotipe (.csv).
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-transparent px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5 active:scale-[0.97] transition-all font-sans"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !analysisName.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#5B4DFE] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#5B4DFE]/30 hover:bg-[#4F46E5] hover:-translate-y-[1px] hover:shadow-xl active:scale-[0.97] active:brightness-95 disabled:opacity-60 disabled:transform-none transition-all duration-100 font-sans"
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
