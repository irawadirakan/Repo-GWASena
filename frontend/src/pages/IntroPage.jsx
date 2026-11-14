import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck2,
  ShieldCheck,
  BarChart3,
  ArrowRight,
  Sparkles,
  Layers,
  CheckCircle2,
  SlidersHorizontal,
  Cpu,
  FileText,
  Dna,
  Activity,
  Check,
  HelpCircle,
} from 'lucide-react';
import InteractiveLogoParticles from '../components/common/InteractiveLogoParticles.jsx';

/**
 * IntroPage (Interactive Onboarding - Figma Aligned)
 * Menampilkan Hybrid Scrollytelling & Interactive Feature Showcase
 * dengan Interactive Canvas 2D Genomic Particle Logo GWASena.
 */
export default function IntroPage() {
  const navigate = useNavigate();

  // State untuk Tab Babak 2 (3 Kapabilitas Inti)
  const [activeCapability, setActiveCapability] = useState(0);

  // State untuk Hybrid Scrollytelling Showcase (4 Langkah Alur)
  const [activeStep, setActiveStep] = useState(1);

  // State untuk Simulasi Langkah 2 (Konfigurasi Parameter)
  const [maf, setMaf] = useState(0.05);
  const [model, setModel] = useState('MLM');

  // State untuk Simulasi Langkah 4 (Manhattan Plot Interaktif)
  const [hoveredSnp, setHoveredSnp] = useState({
    id: 'rs10429',
    chr: 3,
    pos: 'Chr 3: 42.105.820 bp',
    pVal: '8.2',
  });

  // Dual-Interaction Sticky Scrollytelling Setup (Virtual Scroll Track & Spy)
  const flowSectionRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!flowSectionRef.current) return;
      const rect = flowSectionRef.current.getBoundingClientRect();
      const totalScrollable = rect.height - window.innerHeight;
      if (totalScrollable <= 0) return;

      // Hitung progress scroll dari 0 sampai 1
      const progress = Math.max(0, Math.min(1, -rect.top / totalScrollable));

      // Bagi menjadi 4 zona langkah (0, 1, 2, 3)
      const stepIndex = Math.min(3, Math.floor(progress * 4));

      // Update step aktif jika masih berada di dalam area seksi
      if (rect.top <= window.innerHeight * 0.4 && rect.bottom >= window.innerHeight * 0.4) {
        setActiveStep(stepIndex + 1);
        setScrollProgress(progress);
      } else if (rect.top > window.innerHeight * 0.4) {
        setScrollProgress(0);
      } else if (rect.bottom < window.innerHeight * 0.4) {
        setScrollProgress(1);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleStepClick = (index) => {
    setActiveStep(index + 1);
    setScrollProgress((index + 0.5) / 4);
    if (!flowSectionRef.current) return;
    const rect = flowSectionRef.current.getBoundingClientRect();
    const sectionTop = window.scrollY + rect.top;
    const totalScrollable = rect.height - window.innerHeight;
    // Scroll mulus ke posisi persentase langkah tersebut
    const targetY = sectionTop + totalScrollable * ((index + 0.5) / 4);
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  };

  const completeIntroAndNavigate = (targetPath) => {
    localStorage.setItem('gwasena_intro_completed', 'true');
    localStorage.setItem('gwasena_has_logged_in', 'true');
    navigate(targetPath);
  };

  const capabilities = [
    {
      id: 0,
      badge: 'Validasi',
      title: 'Validasi Genotipe & Fenotipe Otomatis',
      desc: 'Unggah berkas VCF/VCF.gz dan metadata CSV fenotipe. Sistem memverifikasi format bialelik dan mencocokkan 100% Sample ID seketika sebelum pipeline berjalan.',
      icon: FileCheck2,
      accent: 'text-[#06B6D4] border-[#06B6D4]/30 bg-[#06B6D4]/10',
    },
    {
      id: 1,
      badge: 'Quality Control',
      title: 'QC Transparan & PCA Otomatis',
      desc: 'Bebaskan riset dari masalah black box. Konfigurasi parameter MAF, HWE, Missingness, dan Kinship dilengkapi panduan ilmiah [EDU-HINT] serta kovariat PCA otomatis.',
      icon: ShieldCheck,
      accent: 'text-[#5B4DFE] border-[#5B4DFE]/30 bg-[#5B4DFE]/10',
    },
    {
      id: 2,
      badge: 'Discovery',
      title: 'Model GLM/MLM, Manhattan Plot & Anotasi',
      desc: 'Jalankan uji asosiasi genomik, telusuri lokus signifikan pada Manhattan & QQ Plot interaktif beresolusi tinggi, lalu petakan kandidat gen ke referensi genom.',
      icon: BarChart3,
      accent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    },
  ];

  const workflowSteps = [
    {
      num: '01',
      step: 1,
      title: 'Unggah dataset',
      desc: 'Genotipe VCF dan fenotipe CSV, divalidasi otomatis.',
    },
    {
      num: '02',
      step: 2,
      title: 'Atur parameter',
      desc: 'Bantuan kontekstual EDU-HINT di setiap pengaturan.',
    },
    {
      num: '03',
      step: 3,
      title: 'Jalankan komputasi',
      desc: 'Proses berjalan terpisah, dengan tips edukatif selama menunggu.',
    },
    {
      num: '04',
      step: 4,
      title: 'Lihat hasil dan laporan',
      desc: 'Manhattan plot, anotasi, dan ekspor PDF.',
    },
  ];

  // Procedural scatter points untuk simulasi Manhattan Plot mini (5 Kromosom)
  const manhattanPoints = useMemo(() => {
    const pts = [];
    const chrs = [
      { id: 1, xMin: 25, xMax: 110, count: 42, color: '#06B6D4' },
      { id: 2, xMin: 120, xMax: 205, count: 40, color: '#6366F1' },
      { id: 3, xMin: 215, xMax: 300, count: 45, color: '#06B6D4' },
      { id: 4, xMin: 310, xMax: 395, count: 38, color: '#6366F1' },
      { id: 5, xMin: 405, xMax: 485, count: 36, color: '#06B6D4' },
    ];

    chrs.forEach((chr) => {
      for (let i = 0; i < chr.count; i++) {
        const x = chr.xMin + Math.random() * (chr.xMax - chr.xMin);
        // Base random y-distribution between 110 and 195 (bawah garis threshold)
        const y = 110 + Math.random() * 85;
        pts.push({
          x,
          y,
          r: 2.2,
          color: chr.color,
          chr: chr.id,
          isPeak: false,
        });
      }
    });

    // Peak Significant SNPs (melewati garis ambang signifikansi y = 65)
    // 1. Peak Utama pada Chr 3: -log10(p) = 8.2 (y = 35)
    pts.push({
      x: 258,
      y: 35,
      r: 4.8,
      color: '#06B6D4',
      chr: 3,
      id: 'rs10429',
      pos: 'Chr 3: 42.105.820 bp',
      pVal: '8.2',
      isPeak: true,
    });
    // 2. Sub-peak pada Chr 3: -log10(p) = 6.8 (y = 50)
    pts.push({
      x: 265,
      y: 50,
      r: 3.8,
      color: '#06B6D4',
      chr: 3,
      id: 'rs10430',
      pos: 'Chr 3: 42.188.110 bp',
      pVal: '6.8',
      isPeak: true,
    });
    // 3. Peak Sekunder pada Chr 5: -log10(p) = 6.4 (y = 54)
    pts.push({
      x: 445,
      y: 54,
      r: 4.2,
      color: '#06B6D4',
      chr: 5,
      id: 'rs88219',
      pos: 'Chr 5: 18.940.220 bp',
      pVal: '6.4',
      isPeak: true,
    });

    return pts;
  }, []);

  return (
    <div className="w-full max-w-5xl py-6 px-4 animate-fade-in flex flex-col items-center text-center">
      {/* ── Babak 1: Hero Section (Seamless Dark/Light Mode) ── */}
      <div className="relative w-full max-w-4xl mx-auto rounded-3xl p-6 sm:p-10 flex flex-col items-center">
        {/* Lapisan Dark Radial Gradient Vignette: HANYA aktif di Dark Mode */}
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

        {/* Interactive Genomic Particle Logo (Pure HTML5 Canvas 2D) */}
        <div className="w-full max-w-[460px] mx-auto mb-2 bg-transparent p-0 border-0 shadow-none">
          <InteractiveLogoParticles />
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

        {/* Narasi Pacing Deskripsi Hero */}
        <p className="mt-4 max-w-2xl font-serif text-base sm:text-lg text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
          Eksplorasi potensi genetik melalui platform GWAS yang mengintegrasikan pemrosesan data, analisis statistik, dan interpretasi hasil.
        </p>
      </div>

      {/* ── Babak 2: Interactive Capability Pills (Conditional Glass: Dark Mode Only) ── */}
      <div className="mt-10 w-full max-w-3xl flex flex-col items-center">
        {/* Kapsul Tab Hero: Bersih di Light Mode, Kaca Frosted di Dark Mode */}
        <div className="inline-flex items-center gap-1.5 bg-transparent border-transparent shadow-none backdrop-blur-none p-0 dark:bg-slate-950/70 dark:backdrop-blur-xl dark:border dark:border-cyan-500/20 dark:shadow-lg dark:p-1.5 dark:rounded-2xl overflow-x-auto max-w-full">
          {capabilities.map((cap, idx) => {
            const Icon = cap.icon;
            const isActive = activeCapability === idx;
            return (
              <button
                key={cap.id}
                type="button"
                onClick={() => setActiveCapability(idx)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 shrink-0 ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-700 border border-sky-400/40 font-semibold shadow-sm dark:bg-cyan-500/25 dark:border-cyan-400/50 dark:text-cyan-200 dark:shadow-inner'
                    : 'bg-transparent border border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 dark:bg-slate-900/50 dark:border-white/10 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-sky-600 dark:text-cyan-300' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{cap.badge}</span>
              </button>
            );
          })}
        </div>

        {/* Capability Card Showcase (Theme-Aware Contrast) */}
        <div className="mt-4 w-full p-6 sm:p-8 text-left rounded-3xl bg-white/80 border border-slate-200/80 shadow-md backdrop-blur-md dark:bg-slate-950/75 dark:backdrop-blur-2xl dark:border dark:border-cyan-500/25 dark:shadow-2xl">
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
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                {capabilities[activeCapability].desc}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Babak 3: Hybrid Scrollytelling & Interactive Feature Showcase ── */}
      <div
        id="flow"
        ref={flowSectionRef}
        className="relative h-[320vh] w-full mt-16 text-left"
      >
        <div className="sticky top-20 min-h-[calc(100vh-5rem)] flex items-center py-8">
          {/* Two-Column Sticky Showcase Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start w-full">
            {/* Kolom Kiri: Stepper Container (5 Cols) */}
            <div className="lg:col-span-5 z-20 flex flex-col gap-4">
              {/* Bagian Atas Kolom Kiri: Kartu Kaca Kompak Mandiri untuk Judul Pipeline */}
              <div className="bg-transparent border-0 shadow-none p-0 dark:bg-slate-950/75 dark:backdrop-blur-2xl dark:border dark:border-cyan-500/25 dark:shadow-xl dark:p-6 dark:rounded-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 dark:border-cyan-500/30 bg-sky-500/10 dark:bg-cyan-500/10 px-3.5 py-1 text-xs font-mono font-bold tracking-wider text-sky-700 dark:text-[#06B6D4] uppercase mb-3">
                  <Layers className="h-3.5 w-3.5" />
                  <span>PIPELINE</span>
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-sans leading-tight">
                  Empat tahap dari data mentah sampai laporan
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                  Eksplorasi alur komputasi genomik interaktif di bawah ini sebelum memulai riset Anda.
                </p>
              </div>

              {/* Bagian Stepper (01 s.d. 04): Masing-masing langkah memiliki kartu kaca mandiri */}
              <div className="relative pl-4 space-y-3 bg-transparent border-0 shadow-none p-0">
                {/* Background Rail Track */}
                <div className="absolute left-1 top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-white/10 rounded-full" />
                {/* Dynamic Glowing Cyan Active Rail */}
                <div
                  className="absolute left-1 top-4 w-0.5 bg-gradient-to-b from-[#0284C7] via-[#06B6D4] to-cyan-400 rounded-full shadow-[0_0_8px_#06B6D4] transition-all duration-200 ease-out"
                  style={{ height: `${Math.max(4, Math.min(100, scrollProgress * 100))}%` }}
                />

                {workflowSteps.map((ws, idx) => {
                  const isActive = activeStep === ws.step;
                  return (
                    <button
                      key={ws.step}
                      type="button"
                      onClick={() => handleStepClick(idx)}
                      className={`w-full text-left rounded-2xl p-4 transition-all duration-300 ease-out group relative block ${
                        isActive
                          ? 'bg-sky-500/10 border border-sky-400/50 text-sky-950 shadow-sm dark:bg-cyan-950/60 dark:backdrop-blur-xl dark:border-cyan-500/50 dark:text-white dark:shadow-lg'
                          : 'bg-white/70 border border-slate-200/80 hover:bg-slate-100/80 text-slate-700 shadow-sm dark:bg-slate-950/70 dark:backdrop-blur-xl dark:border-cyan-500/20 dark:text-slate-200 dark:hover:bg-slate-900/80 dark:shadow-md'
                      }`}
                    >
                      {/* Rail Marker Dot */}
                      <span
                        className={`absolute -left-[16px] top-5 h-2.5 w-2.5 rounded-full border-2 transition-all duration-300 ${
                          isActive
                            ? 'bg-[#06B6D4] border-white dark:border-[#080D24] shadow-[0_0_8px_#06B6D4] scale-125'
                            : scrollProgress >= (idx / 4)
                            ? 'bg-sky-500 dark:bg-cyan-500 border-white dark:border-slate-900'
                            : 'bg-slate-300 dark:bg-slate-600 border-white dark:border-slate-900'
                        }`}
                      />

                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-colors ${
                            isActive
                              ? 'bg-gradient-to-r from-[#0284C7] to-[#06B6D4] text-white shadow-sm'
                              : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'
                          }`}
                        >
                          {ws.num}
                        </span>
                        <div className="flex-1">
                          <h4 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white transition-colors">
                            {ws.title}
                          </h4>
                          <p className="mt-1 text-sm font-normal text-slate-600 dark:text-slate-300 leading-relaxed">
                            {ws.desc}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kolom Kanan: Glass Interactive Stage (7 Cols) */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-sky-200/70 dark:border-cyan-500/25 p-6 sm:p-8 backdrop-blur-2xl min-h-[470px] flex flex-col justify-between relative overflow-hidden bg-white/80 dark:bg-slate-950/75 shadow-xl dark:shadow-2xl transition-all duration-300 ease-out">
                {/* Subtle Stage Background Ambient Gradient */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 dark:bg-cyan-500/15 blur-3xl"
                />

                {/* Content Area for Stages 1 - 4 */}
                <div className="flex-1 flex flex-col justify-center">
                  {/* ── PANEL 1: SIMULASI UNGGAH & VALIDASI ── */}
                  {activeStep === 1 && (
                    <div className="space-y-5 animate-fade-in">
                      <div>
                        <div className="inline-flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-sky-700 dark:text-[#06B6D4] mb-1">
                          <FileCheck2 className="h-4 w-4" />
                          <span>Tahap 01 · Ingestion & Validation</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                          Validasi genotipe dan fenotipe otomatis
                        </h3>
                        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                          Sistem memverifikasi format berkas dan mencocokkan Sample ID sebelum pipeline dijalankan.
                        </p>
                      </div>

                      {/* 3 Baris Verifikasi Berkas Realistis */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/5">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-[#06B6D4]">
                              <Dna className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                genotipe.vcf.gz
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Format VCF v4.2 bialelik · 9.286 SNP terdeteksi
                              </div>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                            <Check className="h-3 w-3 stroke-[3]" />
                            <span>Format valid</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/5">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-[#818CF8]">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                fenotipe.csv
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Metadata Sampel · 2 Sifat kuantitatif (CD8, MCH)
                              </div>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                            <Check className="h-3 w-3 stroke-[3]" />
                            <span>Format valid</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-50/70 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                Sample ID VCF dan CSV
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                                1.940 dari 1.940 sampel berpasangan sempurna
                              </div>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                            <Check className="h-3 w-3 stroke-[3]" />
                            <span>Cocok 100%</span>
                          </span>
                        </div>
                      </div>

                      {/* Summary Callout */}
                      <div className="p-3.5 rounded-xl border border-sky-200/80 bg-sky-50/70 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[#06B6D4] shrink-0" />
                        <span>
                          <strong className="font-semibold text-slate-900 dark:text-white">Status:</strong> Dataset siap dianalisis. Tidak ditemukan diskrepansi nama sampel.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ── PANEL 2: SIMULASI KONFIGURASI PARAMETER ── */}
                  {activeStep === 2 && (
                    <div className="space-y-5 animate-fade-in">
                      <div>
                        <div className="inline-flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-indigo-600 dark:text-[#818CF8] mb-1">
                          <SlidersHorizontal className="h-4 w-4" />
                          <span>Tahap 02 · QC & Association Model</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                          Atur parameter, dengan penjelasan kontekstual
                        </h3>
                        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                          Setiap ambang batas kontrol kualitas dilengkapi penjelasan ilmiah terpadu.
                        </p>
                      </div>

                      <div className="space-y-4 p-4 rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/5">
                        {/* Interactive MAF Slider */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <label htmlFor="maf-slider" className="text-slate-700 dark:text-slate-200">
                              Ambang MAF (Minor Allele Frequency)
                            </label>
                            <span className="font-mono text-sky-700 dark:text-[#06B6D4] bg-sky-500/10 dark:bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-sky-400/30 dark:border-cyan-500/20">
                              Ambang MAF: {maf.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                          <input
                            id="maf-slider"
                            type="range"
                            min="0.01"
                            max="0.10"
                            step="0.01"
                            value={maf}
                            onChange={(e) => setMaf(parseFloat(e.target.value))}
                            className="w-full accent-sky-600 dark:accent-[#06B6D4] cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            <span>0,01 (Sensitif)</span>
                            <span>0,05 (Standar)</span>
                            <span>0,10 (Ketat)</span>
                          </div>
                        </div>

                        {/* Model Switcher */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-200/80 dark:border-white/10">
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            Model Asosiasi Statistik
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setModel('GLM')}
                              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center border ${
                                model === 'GLM'
                                  ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 shadow-sm dark:shadow-inner'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                              }`}
                            >
                              GLM (General Linear Model)
                            </button>
                            <button
                              type="button"
                              onClick={() => setModel('MLM')}
                              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center border ${
                                model === 'MLM'
                                  ? 'border-sky-400/60 bg-sky-500/15 text-sky-800 dark:text-cyan-200 shadow-sm dark:shadow-inner'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                              }`}
                            >
                              MLM (Mixed Linear Model)
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Dynamic EDU-HINT Box */}
                      <div className="p-3.5 rounded-2xl border border-indigo-200/80 bg-indigo-50/80 text-xs text-slate-800 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-slate-200 flex items-start gap-2.5">
                        <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-[#818CF8] shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                          <strong className="text-indigo-900 dark:text-indigo-300 font-semibold font-mono text-[11px] block mb-0.5">
                            EDU-HINT KONTEKSTUAL:
                          </strong>
                          Varian dengan frekuensi alel minor di bawah{' '}
                          <span className="font-mono font-bold text-sky-700 dark:text-[#06B6D4]">
                            {maf.toFixed(2).replace('.', ',')}
                          </span>{' '}
                          disaring agar tidak bias statistik.{' '}
                          <span className="text-slate-600 dark:text-slate-300">
                            [Model {model}:{' '}
                            {model === 'GLM'
                              ? 'cepat dan cocok untuk eksplorasi awal dengan kontrol kovariat PCA.'
                              : 'memperhitungkan kekerabatan antar-sampel (kinship matrix) untuk mencegah temuan palsu akibat struktur populasi.'}
                            ]
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── PANEL 3: SIMULASI KOMPUTASI ASINKRON (SEGAR & TEMBUS PANDANG DI LIGHT MODE) ── */}
                  {activeStep === 3 && (
                    <div className="space-y-4 animate-fade-in">
                      <div>
                        <div className="inline-flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-sky-700 dark:text-[#06B6D4] mb-1">
                          <Cpu className="h-4 w-4" />
                          <span>Tahap 03 · Asynchronous Execution</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                          Komputasi berjalan di latar belakang
                        </h3>
                        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                          Server mengeksekusi pipeline komputasi terisolasi dengan tips edukatif yang dapat dibaca.
                        </p>
                      </div>

                      {/* Multi-stop Progress Bar */}
                      <div className="space-y-2 p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/70 dark:border-white/10 shadow-sm">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Activity className="h-3.5 w-3.5 text-sky-600 dark:text-[#06B6D4]" />
                            Status Pipeline GWAS
                          </span>
                          <span className="font-mono text-sky-700 dark:text-[#06B6D4] font-bold">
                            78% · Tahap 3 / 4 Selesai
                          </span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#0284C7] via-[#06B6D4] to-[#6366F1] transition-all duration-700"
                            style={{ width: '78%' }}
                          />
                        </div>
                      </div>

                      {/* System Status Logs (Kontras Tinggi & Tembus Pandang) */}
                      <div className="space-y-2 font-mono text-xs">
                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/60 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/70 dark:border-cyan-500/20 text-slate-800 dark:text-emerald-300 shadow-sm">
                          <Check className="h-4 w-4 stroke-[3] shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>Kontrol kualitas varian selesai (QC Filtered: 8.412 SNP lolos)</span>
                        </div>
                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/60 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/70 dark:border-cyan-500/20 text-slate-800 dark:text-emerald-300 shadow-sm">
                          <Check className="h-4 w-4 stroke-[3] shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>Matriks kekerabatan Kinship & PCA kovariat selesai dihitung</span>
                        </div>
                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/60 dark:bg-cyan-500/10 backdrop-blur-md border border-slate-200/70 dark:border-cyan-500/20 text-slate-800 dark:text-cyan-200 shadow-sm">
                          <Activity className="h-4 w-4 shrink-0 text-sky-600 dark:text-cyan-400" />
                          <span>Uji asosiasi statistik sedang dihitung... (Estimasi sisa ~12 dtk)</span>
                        </div>
                      </div>

                      {/* Tips Edukatif Box */}
                      <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-amber-950/30 backdrop-blur-md border border-slate-200/70 dark:border-amber-500/30 text-slate-800 dark:text-amber-200 shadow-sm flex items-start gap-2.5">
                        <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                          <strong className="text-amber-700 dark:text-amber-300 font-bold block mb-0.5">
                            TIPS EDUKATIF RISET:
                          </strong>
                          Ribuan marker genetik diuji serentak, sehingga nilai p dikoreksi secara otomatis (Bonferroni / FDR) untuk mencegah temuan positif palsu.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── PANEL 4: SIMULASI MANHATTAN PLOT INTERAKTIF (STATIK) ── */}
                  {activeStep === 4 && (
                    <div className="space-y-4 animate-fade-in">
                      <div>
                        <div className="inline-flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-sky-700 dark:text-[#06B6D4] mb-1">
                          <BarChart3 className="h-4 w-4" />
                          <span>Tahap 04 · Discovery & Visualization</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                          Manhattan Plot & Signifikansi Genomik
                        </h3>
                        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                          Visualisasi sebaran nilai -log10(p) statis dan ilmiah antar seluruh kromosom.
                        </p>
                      </div>

                      {/* Mini Manhattan Plot SVG (Clean, Static & Scientific) */}
                      <div className="relative p-3 rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/5">
                        <svg
                          viewBox="0 0 500 210"
                          className="w-full h-auto select-none"
                          style={{ maxHeight: '200px' }}
                        >
                          {/* Grid background lines */}
                          <line x1="20" y1="195" x2="490" y2="195" stroke="currentColor" className="text-slate-300 dark:text-white/15" strokeWidth="1" />
                          <line x1="20" y1="130" x2="490" y2="130" stroke="currentColor" className="text-slate-200 dark:text-white/5" strokeWidth="0.8" strokeDasharray="3 3" />
                          <line x1="20" y1="65" x2="490" y2="65" stroke="#F43F5E" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.85" />

                          {/* Threshold Label */}
                          <text x="485" y="60" textAnchor="end" fill="#F43F5E" fontSize="9" fontWeight="bold" fontFamily="monospace">
                            Threshold -log10(p) = 5.0
                          </text>

                          {/* Chromosome Separators & Labels */}
                          <text x="67" y="206" textAnchor="middle" fill="currentColor" className="text-slate-500 dark:text-slate-400" fontSize="9" fontFamily="monospace">Chr 1</text>
                          <text x="162" y="206" textAnchor="middle" fill="currentColor" className="text-slate-500 dark:text-slate-400" fontSize="9" fontFamily="monospace">Chr 2</text>
                          <text x="257" y="206" textAnchor="middle" fill="currentColor" className="text-slate-500 dark:text-slate-400" fontSize="9" fontFamily="monospace">Chr 3</text>
                          <text x="352" y="206" textAnchor="middle" fill="currentColor" className="text-slate-500 dark:text-slate-400" fontSize="9" fontFamily="monospace">Chr 4</text>
                          <text x="445" y="206" textAnchor="middle" fill="currentColor" className="text-slate-500 dark:text-slate-400" fontSize="9" fontFamily="monospace">Chr 5</text>

                          {/* Regular & Peak SNP Points (Statis Tanpa Gerak/Bounce) */}
                          {manhattanPoints.map((pt, idx) => {
                            const isSelected = hoveredSnp?.id && pt.id === hoveredSnp.id;
                            return (
                              <g key={idx}>
                                {pt.isPeak && isSelected && (
                                  <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={pt.r + 4}
                                    fill="none"
                                    stroke="#06B6D4"
                                    strokeWidth="1.5"
                                    opacity="0.85"
                                  />
                                )}
                                <circle
                                  cx={pt.x}
                                  cy={pt.y}
                                  r={pt.r}
                                  fill={pt.isPeak ? '#06B6D4' : pt.color}
                                  opacity={pt.isPeak ? 0.95 : 0.65}
                                  cursor={pt.isPeak ? 'pointer' : 'default'}
                                  onMouseEnter={() => {
                                    if (pt.isPeak) {
                                      setHoveredSnp({
                                        id: pt.id,
                                        chr: pt.chr,
                                        pos: pt.pos,
                                        pVal: pt.pVal,
                                      });
                                    }
                                  }}
                                />
                              </g>
                            );
                          })}
                        </svg>
                      </div>

                      {/* Association Signal Callout */}
                      <div className="p-3 rounded-2xl border border-sky-300/60 bg-sky-50/80 text-xs text-slate-800 shadow-sm dark:border-cyan-500/30 dark:bg-cyan-950/40 dark:text-slate-200 flex items-center gap-2.5">
                        <Sparkles className="h-4 w-4 text-sky-600 dark:text-[#06B6D4] shrink-0" />
                        <div className="leading-relaxed">
                          <strong className="text-sky-800 dark:text-cyan-300 font-bold">
                            Sinyal asosiasi terdeteksi:
                          </strong>{' '}
                          SNP pada <span className="font-mono font-bold text-slate-900 dark:text-white">{hoveredSnp.pos}</span> dengan{' '}
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                            -log10(p) = {hoveredSnp.pVal}
                          </span>{' '}
                          (melewati garis ambang batas signifikansi genomik).
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sisi Kanan: Blok CTA Sejajar dengan Tahap 03 & 04 (Clean in Light Mode, Glass in Dark Mode) */}
                {(activeStep === 3 || activeStep === 4) && (
                  <div className="border-t border-slate-200/80 dark:border-white/10 pt-4 mt-4 animate-fade-in">
                    <div className="bg-transparent border-0 shadow-none p-0 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-left">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                          Siap memulai eksplorasi dan penemuan asosiasi genomik?
                        </h4>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => completeIntroAndNavigate('/login')}
                          className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400 shadow-md hover:shadow-cyan-500/20 active:scale-95 transition-all text-xs sm:text-sm flex items-center justify-center gap-1.5"
                        >
                          <span>Mulai Sekarang!</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => completeIntroAndNavigate('/register')}
                          className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100/80 dark:bg-white/5 hover:bg-slate-200/80 dark:hover:bg-white/10 border border-slate-300/70 dark:border-white/15 text-xs sm:text-sm transition-all text-center"
                        >
                          <span>Buat Akun Baru</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
