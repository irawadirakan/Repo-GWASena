import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck2,
  ShieldCheck,
  BarChart3,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import BrandLogo from '../components/common/BrandLogo.jsx';

/**
 * IntroPage (Interactive Onboarding - Figma Aligned)
 * Terinspirasi dari pacing dan storytelling Microsoft Copilot Tasks.
 * Acuan: Panduan Onboarding GWASena
 */
export default function IntroPage() {
  const navigate = useNavigate();
  const [activeCapability, setActiveCapability] = useState(0);

  const completeIntroAndNavigate = (targetPath) => {
    localStorage.setItem('gwasena_intro_completed', 'true');
    localStorage.setItem('gwasena_has_logged_in', 'true');
    navigate(targetPath);
  };

  const capabilities = [
    {
      id: 0,
      badge: 'Langkah 1: Validasi',
      title: 'Validasi Genotipe & Fenotipe Otomatis',
      desc: 'Unggah berkas VCF/VCF.gz dan metadata CSV fenotipe. Sistem memverifikasi format bialelik dan mencocokkan 100% Sample ID seketika sebelum pipeline berjalan.',
      icon: FileCheck2,
      accent: 'text-[#06B6D4] border-[#06B6D4]/30 bg-[#06B6D4]/10',
    },
    {
      id: 1,
      badge: 'Langkah 2: Quality Control',
      title: 'QC Transparan & PCA Otomatis',
      desc: 'Bebaskan riset dari masalah black box. Konfigurasi parameter MAF, HWE, Missingness, dan Kinship dilengkapi panduan ilmiah [EDU-HINT] serta kovariat PCA otomatis.',
      icon: ShieldCheck,
      accent: 'text-[#5B4DFE] border-[#5B4DFE]/30 bg-[#5B4DFE]/10',
    },
    {
      id: 2,
      badge: 'Langkah 3 & 4: Discovery',
      title: 'Model GLM/MLM, Manhattan Plot & Anotasi',
      desc: 'Jalankan uji asosiasi genomik, telusuri lokus signifikan pada Manhattan & QQ Plot interaktif beresolusi tinggi, lalu petakan kandidat gen ke referensi genom.',
      icon: BarChart3,
      accent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    },
  ];

  const workflowSteps = [
    { num: '01', title: 'Unggah Dataset', desc: 'Genotipe VCF & Fenotipe CSV' },
    { num: '02', title: 'Konfigurasi Parameter', desc: 'Bantuan kontekstual EDU-HINT' },
    { num: '03', title: 'Komputasi Asinkron', desc: 'Orkestrasi terisolasi & Tips Edukatif' },
    { num: '04', title: 'Eksplorasi & Laporan', desc: 'Manhattan Plot, Anotasi & PDF' },
  ];

  return (
    <div className="w-full max-w-5xl py-6 px-4 animate-fade-in flex flex-col items-center text-center">
      {/* ── Babak 1: Hero Section (Shape gelap HANYA di Dark Mode, dihilangkan penuh di Light Mode) ── */}
      <div className="relative w-full max-w-4xl mx-auto rounded-3xl p-6 sm:p-10 flex flex-col items-center">
        {/* Lapisan Dark Radial Gradient Vignette: HANYA aktif di Dark Mode, dihilangkan di Light Mode */}
        <div
          aria-hidden="true"
          className="hidden dark:block absolute inset-0 -z-10 rounded-3xl bg-slate-950/70 backdrop-blur-[6px] border border-white/5 shadow-2xl pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at center, rgba(8, 13, 36, 0.70) 0%, rgba(8, 13, 36, 0.90) 85%, rgba(8, 13, 36, 0.98) 100%)',
          }}
        />

        {/* Badge Identitas Terupdate */}
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 dark:border-[#06B6D4]/40 bg-cyan-100/80 dark:bg-[#06B6D4]/15 px-4 py-1.5 text-xs font-bold text-cyan-950 dark:text-[#06B6D4] backdrop-blur-md mb-4 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-cyan-700 dark:text-[#06B6D4] animate-pulse" />
          <span>GWASena · Integrated GWAS Platform</span>
        </div>

        {/* Brand Display (Logo Transparan Bersih Tanpa Kotak Card Putih) */}
        <div className="mb-2 bg-transparent p-0 border-0 shadow-none">
          <BrandLogo size="xl" showTagline={false} className="bg-transparent" />
        </div>

        {/* Editorial Subtitle / Tagline in Neuton Serif */}
        <p className="font-serif italic text-lg sm:text-xl font-bold text-[#5B4DFE] dark:text-[#38BDF8] tracking-wide mb-3">
          From Genotype to Discovery
        </p>

        {/* Headline Ilmiah (Font Plus Jakarta Sans / Heading) */}
        <h1 className="max-w-3xl text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.18] dark:drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
          Eksplorasi Asosiasi Genomik Tanpa Batas{' '}
          <span className="bg-gradient-to-r from-[#06B6D4] via-[#5B4DFE] to-indigo-500 bg-clip-text text-transparent">
            dalam Satu Alur Terpadu.
          </span>
        </h1>

        {/* Narasi Pacing Deskripsi Hero Terupdate */}
        <p className="mt-4 max-w-2xl font-serif text-base sm:text-lg text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
          Eksplorasi potensi genetik melalui platform GWAS yang mengintegrasikan pemrosesan data, analisis statistik, dan interpretasi hasil.
        </p>
      </div>

      {/* ── Babak 2: Interactive Capability Pills (Copilot-Inspired) ── */}
      <div className="mt-12 w-full max-w-3xl">
        <div className="flex items-center justify-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3 overflow-x-auto">
          {capabilities.map((cap, idx) => {
            const Icon = cap.icon;
            const isActive = activeCapability === idx;
            return (
              <button
                key={cap.id}
                type="button"
                onClick={() => setActiveCapability(idx)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-100 active:scale-95 shrink-0 ${
                  isActive
                    ? 'border border-[#5B4DFE] dark:border-[#5B4DFE]/40 bg-white dark:bg-[#5B4DFE]/15 text-[#5B4DFE] dark:text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-[#5B4DFE] dark:text-[#06B6D4]' : ''}`} />
                <span>{cap.badge}</span>
              </button>
            );
          })}
        </div>

        {/* Capability Card Showcase (3-Layer High Separation Glass) */}
        <div className="mt-4 figma-card p-6 sm:p-8 text-left">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${capabilities[activeCapability].accent}`}>
              {(() => {
                const ActiveIcon = capabilities[activeCapability].icon;
                return <ActiveIcon className="h-6 w-6" />;
              })()}
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {capabilities[activeCapability].title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {capabilities[activeCapability].desc}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Babak 3: How GWASena Works (Sequential Steps - Tanpa Badge Terverifikasi) ── */}
      <div className="mt-12 w-full max-w-4xl">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Layers className="h-4 w-4 text-[#06B6D4]" />
          <h2 className="text-xs sm:text-sm uppercase tracking-widest font-bold text-slate-800 dark:text-slate-200">
            4 Tahapan Analisis Terstruktur
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-left">
          {workflowSteps.map((ws, i) => (
            <div
              key={i}
              className="flex flex-col justify-between glass-subcard p-4 hover:border-[#0284C7]/40 hover:-translate-y-1 shadow-sm transition-all"
            >
              <div>
                <span className="font-mono text-xs font-bold text-[#0284C7] dark:text-[#06B6D4]">{ws.num}</span>
                <h4 className="mt-1.5 text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">{ws.title}</h4>
                <p className="mt-1 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{ws.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Babak 4: High-Contrast Action Dock (CTA) (3-Layer Glass) ── */}
      <div className="mt-12 w-full max-w-md figma-card p-6 text-center">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3.5">
          Siap memulai eksplorasi dan penemuan asosiasi genomik?
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => completeIntroAndNavigate('/login')}
            className="flex-1 figma-btn-primary"
          >
            <span>Mulai Sekarang!</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => completeIntroAndNavigate('/register')}
            className="flex-1 figma-btn-secondary"
          >
            <span>Buat Akun Baru</span>
          </button>
        </div>
      </div>
    </div>
  );
}
