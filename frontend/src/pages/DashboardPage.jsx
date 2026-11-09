import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dna,
  PlusCircle,
  History,
  ArrowRight,
  Sprout,
  Loader2,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore.js';
import { useAnalysisStore } from '../store/useAnalysisStore.js';
import { analysisService } from '../services/analysisService.js';
import ErrorMessageArea from '../components/common/ErrorMessageArea.jsx';

const DEFAULT_SESSION_NAMES = [
  'Analisis Bobot Umbi Bawang Putih 2026',
  'GWAS Penanda Sifat Kuantitatif Agronomi',
  'Eksplorasi Varian Genomik Allium sativum',
];

/**
 * DashboardPage (Layar Utama Peneliti - Figma Aligned with Micro-Interactions)
 * Acuan: 03 — Dashboard (Pengguna Analisis).png & 03 — Dashboard (Pengguna Analisis) (Light).png
 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [meta, setMeta] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // ── State Autocomplete Riwayat Nama Sesi ──
  const [sessionHistory, setSessionHistory] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('gwasena_session_names_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const dropdownRef = useRef(null);
  const inputContainerRef = useRef(null);

  const openNewSessionModal = () => {
    setSessionName('');
    setError(null);
    setIsDropdownOpen(false);
    setIsFocused(false);
    setIsModalOpen(true);
  };

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        inputContainerRef.current &&
        !inputContainerRef.current.contains(event.target)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleDeleteHistoryItem = (e, itemToDelete) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = sessionHistory.filter((item) => item !== itemToDelete);
    setSessionHistory(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gwasena_session_names_history', JSON.stringify(updated));
    }
  };

  const handleSelectHistoryItem = (item) => {
    setSessionName(item);
    setIsDropdownOpen(false);
  };

  useEffect(() => {
    let isMounted = true;
    async function loadDashboardData() {
      try {
        const metaData = await analysisService.getMeta();
        if (isMounted && metaData) {
          setMeta(metaData);
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
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = (sessionName || '').trim();
    // Penanganan Nama Default & ID Sesi yang Aman
    const finalSessionName = trimmed || 'Analisis Tanpa Judul';

    if (trimmed) {
      const updatedHistory = [
        trimmed,
        ...sessionHistory.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, 10);
      setSessionHistory(updatedHistory);
      if (typeof window !== 'undefined') {
        localStorage.setItem('gwasena_session_names_history', JSON.stringify(updatedHistory));
      }
    }

    setIsSubmitting(true);
    setError(null);

    const fallbackId = Date.now().toString();

    try {
      let createdSession = null;
      try {
        createdSession = await analysisService.createAnalysis(finalSessionName);
      } catch (apiErr) {
        console.warn('API backend createAnalysis gagal atau offline, menggunakan inisiasi sesi lokal:', apiErr);
        createdSession = {
          analysis_id: fallbackId,
          id: fallbackId,
          analysis_name: finalSessionName,
          status: 'draft',
          organism: 'Allium sativum (Bawang Putih)',
          created_at: new Date().toISOString(),
          is_local_fallback: true,
        };
      }

      const targetId = createdSession?.analysis_id || createdSession?.id || fallbackId;

      // Inisialisasi sesi di useAnalysisStore
      const { setCurrentAnalysis, setActiveStep } = useAnalysisStore.getState();
      setCurrentAnalysis({
        analysis_id: targetId,
        id: targetId,
        analysis_name: finalSessionName,
        status: 'draft',
        organism: createdSession?.organism || 'Allium sativum (Bawang Putih)',
      });
      setActiveStep(1);

      // Simpan flag jika nama sesi perlu dinamai otomatis saat berkas diunggah
      if (!trimmed && typeof window !== 'undefined') {
        localStorage.setItem(`gwasena_auto_name_${targetId}`, 'true');
      }

      setIsModalOpen(false);
      navigate(`/analyses/${targetId}`);
    } catch (err) {
      console.error('Fatal error saat inisiasi sesi:', err);
      navigate(`/analyses/${fallbackId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const org = meta?.organisme;

  // Filter riwayat yang sesuai dengan ketikan input (hanya jika ada riwayat valid)
  const filteredHistory = sessionHistory.filter((item) =>
    item && item.toLowerCase().includes((sessionName || '').toLowerCase().trim())
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* ── Banner Sambutan Peneliti & Organisme (3-Layer High Separation Glass) ── */}
      <div className="relative overflow-hidden figma-card p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300 dark:border-[#06B6D4]/30 bg-cyan-50 dark:bg-[#06B6D4]/10 px-3 py-1 text-xs font-semibold text-cyan-900 dark:text-[#06B6D4]">
              <Sprout className="h-3.5 w-3.5 text-cyan-700 dark:text-[#06B6D4]" />
              <span>Alur Kerja Analisis Asosiasi Genomik GWASena</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-sans">
              Selamat datang kembali,{' '}
              <span className="text-[#5B4DFE] dark:text-[#06B6D4]">{user?.username || 'Peneliti'}</span>!
            </h1>

            <p className="max-w-2xl font-serif text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              Mulai sesi analisis asosiasi genomik baru atau lanjutkan evaluasi hasil riset terdahulu
              dengan alur kerja terstandarisasi.
            </p>
          </div>

          {/* Ringkasan Aktivitas Riset (Evaluasi Tester Poin 8) */}
          <div className="shrink-0 glass-subcard p-4 text-xs sm:text-sm space-y-2 min-w-[240px] border border-cyan-400/40 dark:border-cyan-500/20 bg-white/80 dark:bg-[#121B38]/80 shadow-sm rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] font-sans flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-[#06B6D4]" />
                <span>Ringkasan Aktivitas Riset</span>
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Ruang Kerja Siap" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Sesi Tersimpan:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {sessionHistory.length} Sesi Terdaftar
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Ruang Kerja:</span>
                <span className="font-sans font-semibold text-emerald-600 dark:text-emerald-400">
                  Siap untuk Analisis
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Model Referensi:</span>
                <span className="font-serif italic font-bold text-[#0284C7] dark:text-[#06B6D4]">
                  {org?.nama_ilmiah || 'Allium sativum L.'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-[#06B6D4]/10 blur-3xl" />
      </div>

      {/* ── Dua Kartu Aksi Utama (High-Separation Glass dengan Micro-Interactions) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kartu 1: Analisis Baru (Primary CTA Card) */}
        <div
          onClick={openNewSessionModal}
          className="flex flex-col justify-between figma-card p-6 sm:p-8 hover:-translate-y-1 hover:border-[#5B4DFE]/40 active:scale-[0.985] group cursor-pointer transition-all duration-200"
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
              Unggah berkas VCF/PLINK & fenotipe CSV, jalankan penyaringan QC dan PCA otomatis, uji model GLM/MLM, hingga eksplorasi Manhattan Plot interaktif.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openNewSessionModal();
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 py-3 px-4 text-sm font-semibold text-white shadow-sm hover:-translate-y-[1px] hover:shadow-md active:scale-[0.98] transition-all duration-100 font-sans"
            >
              <PlusCircle className="h-4 w-4" />
              <span>+ Inisiasi Sesi Analisis Baru</span>
            </button>
          </div>
        </div>

        {/* Kartu 2: Riwayat Analisis */}
        <div
          onClick={() => navigate('/history')}
          className="flex flex-col justify-between figma-card p-6 sm:p-8 hover:-translate-y-1 hover:border-[#0284C7]/40 active:scale-[0.985] group cursor-pointer transition-all duration-200"
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
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 py-3 px-4 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 hover:shadow-sm active:scale-[0.98] transition-all duration-100 font-sans"
            >
              <span>Buka Daftar Riwayat Analisis</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── ALUR KERJA ANALISIS ASOSIASI GENOMIK GWASENA (Micro-Interactions Halus & Responsif) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#06B6D4]" />
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 font-sans">
              ALUR KERJA ANALISIS ASOSIASI GENOMIK GWASENA
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-sans hidden sm:inline">
            Standar Pipeline Bioinformatika IPB University
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Kartu 1: 1. Unggah & Validasi */}
          <div
            onClick={openNewSessionModal}
            className="group relative figma-card p-6 flex flex-col justify-between cursor-pointer border border-transparent hover:border-[#06B6D4]/60 dark:hover:border-[#06B6D4]/50 transition-all duration-200 ease-out hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-[0_16px_36px_-10px_rgba(6,182,212,0.30)] active:scale-[0.99]"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-100 dark:bg-[#06B6D4]/15 text-[#0284C7] dark:text-[#06B6D4] font-mono text-base font-black border border-cyan-300 dark:border-[#06B6D4]/30 shadow-sm transition-all duration-200 group-hover:scale-110 group-hover:bg-[#06B6D4] group-hover:text-white group-hover:shadow-[0_0_16px_rgba(6,182,212,0.6)]">
                  1
                </span>
                <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-cyan-800 dark:text-[#06B6D4] bg-cyan-50 dark:bg-[#06B6D4]/10 px-2.5 py-0.5 rounded-full border border-cyan-200 dark:border-[#06B6D4]/20">
                  Tahap 1
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold font-sans tracking-tight text-slate-900 dark:text-white group-hover:text-[#0284C7] dark:group-hover:text-[#06B6D4] transition-colors">
                1. Unggah & Validasi
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                Unggah dataset genotipe (VCF / PLINK BED) dan matriks fenotipe CSV. Sistem memverifikasi format bialelik dan mencocokkan Sample ID secara otomatis sebelum komputasi.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs font-semibold text-[#0284C7] dark:text-[#06B6D4]">
              <span>Mulai Unggah Dataset</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </div>

          {/* Kartu 2: 2. Penyaringan QC & Model */}
          <div
            onClick={openNewSessionModal}
            className="group relative figma-card p-6 flex flex-col justify-between cursor-pointer border border-transparent hover:border-[#5B4DFE]/60 dark:hover:border-[#5B4DFE]/50 transition-all duration-200 ease-out hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-[0_16px_36px_-10px_rgba(91,77,254,0.30)] active:scale-[0.99]"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-[#5B4DFE]/15 text-[#5B4DFE] dark:text-[#818CF8] font-mono text-base font-black border border-indigo-200 dark:border-[#5B4DFE]/30 shadow-sm transition-all duration-200 group-hover:scale-110 group-hover:bg-[#5B4DFE] group-hover:text-white group-hover:shadow-[0_0_16px_rgba(91,77,254,0.6)]">
                  2
                </span>
                <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-indigo-800 dark:text-[#A5B4FC] bg-indigo-50 dark:bg-[#5B4DFE]/10 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-[#5B4DFE]/20">
                  Tahap 2 & 3
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold font-sans tracking-tight text-slate-900 dark:text-white group-hover:text-[#5B4DFE] dark:group-hover:text-[#A5B4FC] transition-colors">
                2. Penyaringan QC & Model
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                Konfigurasi parameter MAF, Missingness, HWE, dan Kinship terpandu EDU-HINT, lakukan evaluasi kovariat PCA otomatis, serta pilih model statistik GLM atau MLM.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs font-semibold text-[#5B4DFE] dark:text-[#A5B4FC]">
              <span>Panduan Ilmiah [EDU-HINT]</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </div>

          {/* Kartu 3: 3. Visualisasi & Laporan */}
          <div
            onClick={() => navigate('/history')}
            className="group relative figma-card p-6 flex flex-col justify-between cursor-pointer border border-transparent hover:border-emerald-500/60 dark:hover:border-emerald-400/50 transition-all duration-200 ease-out hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-[0_16px_36px_-10px_rgba(16,185,129,0.30)] active:scale-[0.99]"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono text-base font-black border border-emerald-200 dark:border-emerald-500/30 shadow-sm transition-all duration-200 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-[0_0_16px_rgba(16,185,129,0.6)]">
                  3
                </span>
                <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                  Tahap 4–6
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold font-sans tracking-tight text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                3. Visualisasi & Laporan
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                Analisis Manhattan Plot & QQ Plot interaktif beresolusi tinggi, periksa daftar SNP signifikan, petakan kandidat gen fungsional, dan ekspor dokumen laporan ilmiah A4 PDF.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span>Buka Hasil & Ekspor</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </div>


      {/* ── Modal Dialog Inisiasi Analisis Baru (Dengan Custom Autocomplete & Penghapusan Riwayat) ── */}
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
              {/* Field Nama Sesi */}
              <div ref={inputContainerRef} className="relative">
                <label
                  htmlFor="sessionName"
                  className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-1.5 font-sans"
                >
                  Nama Sesi Analisis
                </label>
                <div className="relative">
                  <input
                    id="sessionName"
                    type="text"
                    autoComplete="off"
                    value={sessionName}
                    onFocus={() => {
                      setIsFocused(true);
                      setIsDropdownOpen(true);
                    }}
                    onBlur={() => {
                      setTimeout(() => setIsFocused(false), 200);
                    }}
                    onChange={(e) => {
                      setSessionName(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    placeholder="Contoh: Analisis Asosiasi Genomik 2026"
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2.5 pl-3.5 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] font-medium transition-all"
                  />
                  {sessionName.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSessionName('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      title="Hapus isian nama sesi"
                      aria-label="Kosongkan nama sesi"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300 font-medium font-sans">
                  Opsional: Kosongkan untuk penamaan otomatis mengikuti berkas/sifat fenotipe di Langkah 1.
                </span>

                {/* Custom Autocomplete Dropdown Riwayat Nama Sesi (Hanya tampil jika isFocused dan filteredHistory.length > 0) */}
                {isDropdownOpen && isFocused && filteredHistory.length > 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0F172E]/95 backdrop-blur-xl shadow-xl overflow-hidden animate-dropdown-in max-h-56 overflow-y-auto"
                  >
                    <div className="px-3.5 py-2 border-b border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <History className="h-3 w-3 text-[#06B6D4]" />
                        <span>Riwayat Nama Sesi</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(false)}
                        className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                        title="Tutup riwayat"
                      >
                        Tutup
                      </button>
                    </div>

                    <div className="py-1">
                      {filteredHistory.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectHistoryItem(item)}
                          className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors group text-xs text-slate-800 dark:text-slate-200"
                        >
                          <span className="truncate pr-2 font-medium group-hover:text-blue-600 dark:group-hover:text-[#06B6D4] transition-colors">
                            {item}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteHistoryItem(e, item)}
                            title="Hapus item riwayat ini"
                            aria-label={`Hapus ${item} dari riwayat`}
                            className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all opacity-80 group-hover:opacity-100 shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-transparent px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5 active:scale-[0.98] transition-all font-sans"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:-translate-y-[1px] hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:transform-none transition-all duration-100 font-sans"
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
