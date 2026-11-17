import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Award,
  Sparkles,
  Calendar,
  Search,
  Layout,
  Code2,
  FlaskConical,
  Rocket,
  Zap,
  ExternalLink,
} from 'lucide-react';
import BrandLogo from '../components/common/BrandLogo.jsx';
import DnaThemeToggle from '../components/common/DnaThemeToggle.jsx';
import { useThemeStore } from '../store/useThemeStore.js';
import { useAuthStore } from '../store/useAuthStore.js';

/**
 * Data Anggota Kelompok 4
 * Urutan Resmi: (1) Rakan (PM), (2) Akna (SA), (3) Moreno (FE), (4) Isnaini (BE), (5) Fannikha (QA)
 */
const TEAM_MEMBERS = [
  {
    id: 'rakan',
    name: 'Rakan Fawwaz Irawadi',
    nim: 'G0401241032',
    role: 'Project Manager (PM)',
    roleCode: 'PM',
    email: 'irawadirakan@apps.ipb.ac.id',
    photo: '/assets/team/foto-rakan.jpg',
    fallbackAvatar: 'https://ui-avatars.com/api/?name=Rakan+Fawwaz&background=0284c7&color=fff',
    fallbackInitials: 'RF',
    badgeColor: 'from-amber-500 to-orange-600',
    accentText: 'text-amber-600 dark:text-amber-400',
    responsibilities: [
      'Menyusun timeline dan pembagian tugas',
      'Memimpin rapat dan presentasi',
      'Mengelola risiko proyek',
    ],
    techStack: ['GitHub'],
  },
  {
    id: 'akna',
    name: 'Akna Mafaiz Firjatullah',
    nim: 'G0401241027',
    role: 'System Analyst (SA)',
    roleCode: 'SA',
    email: 'faisakna@apps.ipb.ac.id',
    photo: '/assets/team/foto-akna.png',
    fallbackAvatar: 'https://ui-avatars.com/api/?name=Akna+Mafaiz&background=06b6d4&color=fff',
    fallbackInitials: 'AM',
    badgeColor: 'from-cyan-500 to-teal-600',
    accentText: 'text-cyan-600 dark:text-cyan-400',
    responsibilities: [
      'Menggali dan memetakan kebutuhan',
      'Merancang use case dan ERD',
    ],
    techStack: ['Draw.io', 'UML', 'Figma'],
  },
  {
    id: 'moreno',
    name: 'Moreno Ardiansyah',
    nim: 'G0401241024',
    role: 'Frontend Developer (FE)',
    roleCode: 'FE',
    email: 'refall22ardiansyah@apps.ipb.ac.id',
    photo: '/assets/team/foto-moreno.jpeg',
    fallbackAvatar: 'https://ui-avatars.com/api/?name=Moreno+Ardiansyah&background=3b82f6&color=fff',
    fallbackInitials: 'MA',
    badgeColor: 'from-blue-500 to-indigo-600',
    accentText: 'text-blue-600 dark:text-indigo-400',
    responsibilities: [
      'Merancang dan membangun antarmuka utama GWASena dari desain hingga implementasi',
      'Mengembangkan halaman dan komponen yang responsif serta mudah digunakan',
      'Mengintegrasikan frontend dengan API dan layanan backend',
      'Menghubungkan berbagai fitur analisis ke dalam alur penggunaan yang terstruktur',
      'Mengoptimalkan performa, navigasi, dan konsistensi tampilan seluruh platform',
    ],
    techStack: ['HTML/CSS', 'JavaScript', 'figma', 'React'],
  },
  {
    id: 'isnaini',
    name: 'Isnaini Tiana Hayu',
    nim: 'G0401241021',
    role: 'Backend Developer (BE)',
    roleCode: 'BE',
    email: 'isnainitiana@apps.ipb.ac.id',
    photo: '/assets/team/foto-isnaini.png',
    fallbackAvatar: 'https://ui-avatars.com/api/?name=Isnaini+Tiana&background=10b981&color=fff',
    fallbackInitials: 'IT',
    badgeColor: 'from-emerald-500 to-teal-600',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    responsibilities: [
      'Merancang dan mengembangkan API untuk mendukung komunikasi antar komponen sistem',
      'Membangun sistem autentikasi dan pengelolaan akun pengguna',
      'Mengembangkan dan menjalankan pipeline komputasi untuk setiap tahapan analisis GWAS',
      'Mengelola pemrosesan, penyimpanan, dan pengambilan data hasil analisis',
      'Memastikan performa, keamanan, dan keandalan layanan backend',
    ],
    techStack: ['Python', 'PLINK', 'PostgreSQL'],
  },
  {
    id: 'fannikha',
    name: 'Fannikha Haeny Dzikriany',
    nim: 'G0401241031',
    role: 'Tester (QA)',
    roleCode: 'QA',
    email: 'fannikhahaen_dzikriany@apps.ipb.ac.id',
    photo: '/assets/team/foto-fannikha.jpeg',
    fallbackAvatar: 'https://ui-avatars.com/api/?name=Fannikha+Haeny&background=f43f5e&color=fff',
    fallbackInitials: 'FH',
    badgeColor: 'from-rose-500 to-pink-600',
    accentText: 'text-rose-600 dark:text-rose-400',
    responsibilities: [
      'Menyusun test case dan skenario pengujian untuk setiap fitur GWASena',
      'Melakukan pengujian fungsionalitas dan memastikan fitur berjalan sesuai kebutuhan',
      'Mengidentifikasi, mencatat, dan memverifikasi bug atau kesalahan sistem',
      'Mengevaluasi hasil pengujian serta memberikan masukan untuk meningkatkan kualitas dan keandalan platform',
    ],
    techStack: ['Bug report', 'G-Docs'],
  },
];

/**
 * Alur SDLC Agile Scrum yang diterapkan pada GWASena (6 Tahap)
 */
const SDLC_STEPS = [
  {
    no: '01',
    name: 'PERENCANAAN',
    icon: Calendar,
    title: 'Perencanaan & Penentuan Kebutuhan',
    desc: 'Menentukan fitur utama, kebutuhan pengguna, ruang lingkup analisis GWAS, serta pembagian tugas setiap anggota tim.',
  },
  {
    no: '02',
    name: 'ANALISIS',
    icon: Search,
    title: 'Analisis Kebutuhan Sistem',
    desc: 'Mengidentifikasi kebutuhan data, alur analisis, metode perhitungan, dan teknologi yang digunakan dalam pengembangan GWASena.',
  },
  {
    no: '03',
    name: 'DESAIN UI/UX',
    icon: Layout,
    title: 'Perancangan Antarmuka & Pengalaman Pengguna',
    desc: 'Menyusun wireframe, desain halaman, komponen antarmuka, serta tampilan Light Mode dan Dark Mode.',
  },
  {
    no: '04',
    name: 'IMPLEMENTASI',
    icon: Code2,
    title: 'Pengembangan Frontend & Backend',
    desc: 'Membangun antarmuka web, mengembangkan layanan backend, serta mengintegrasikan fitur-fitur analisis GWAS ke dalam platform.',
  },
  {
    no: '05',
    name: 'PENGUJIAN',
    icon: FlaskConical,
    title: 'Pengujian & Evaluasi Sistem',
    desc: 'Menguji fungsi setiap fitur, memeriksa integrasi sistem, mengidentifikasi kesalahan, dan mengevaluasi hasil analisis.',
  },
  {
    no: '06',
    name: 'DEPLOYMENT',
    icon: Rocket,
    title: 'Penyelesaian & Publikasi Platform',
    desc: 'Menyiapkan platform agar dapat diakses pengguna, melakukan konfigurasi akhir, dan menyusun dokumentasi penggunaan.',
  },
];

/**
 * Ikon GitHub SVG Mandiri
 */
function GithubIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

/**
 * Komponen 3D Flip Card Tim Pengembang
 * Efek membalik dipicu secara murni oleh hover kursor (group-hover:rotate-y-180)
 * Foto terpusat presisi menggunakan object-cover object-center w-24 h-24 mx-auto rounded-full
 * Email tampil utuh tanpa elipsis/truncate dengan break-all font-mono
 */
function TeamFlipCard({ member, index }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      tabIndex={0}
      aria-label={`Kartu profil ${member.name}`}
      className="group perspective-1000 min-h-[440px] h-[440px] w-full focus:outline-none select-none"
      style={{ animationDelay: `${100 + index * 80}ms` }}
    >
      <div className="relative w-full h-full transform-style-3d transition-transform duration-700 ease-out group-hover:rotate-y-180 group-hover:[transform:rotateY(180deg)]">
        {/* ── BAGIAN DEPAN (Front Card) ── */}
        <div className="absolute inset-0 backface-hidden glass-subcard p-6 flex flex-col justify-between rounded-3xl overflow-hidden border border-white/90 dark:border-cyan-500/30 shadow-xl group-hover:shadow-2xl transition-all duration-300">
          {/* Ambient Glow Corner */}
          <div
            className={`absolute -top-16 -right-16 w-36 h-36 rounded-full bg-gradient-to-br ${member.badgeColor} opacity-15 blur-2xl pointer-events-none`}
            aria-hidden="true"
          />

          {/* Header Card: Role Badge & NIM */}
          <div className="flex items-center justify-between z-10">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider text-white bg-gradient-to-r ${member.badgeColor} shadow-md`}
            >
              <Award className="w-3.5 h-3.5" />
              {member.roleCode}
            </span>
            <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-cyan-400/80 bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-cyan-500/20">
              {member.nim}
            </span>
          </div>

          {/* Foto Wajah / Fallback Avatar — Presisi object-cover object-center w-24 h-24 mx-auto rounded-full */}
          <div className="my-auto text-center flex flex-col items-center z-10">
            <div className="relative group/avatar mb-4">
              <div
                className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 opacity-70 blur-md group-hover:opacity-100 transition duration-300"
                aria-hidden="true"
              />
              {!imgError ? (
                <img
                  src={member.photo}
                  alt={member.name}
                  onError={(e) => {
                    if (member.fallbackAvatar && e.currentTarget.src !== member.fallbackAvatar) {
                      e.currentTarget.src = member.fallbackAvatar;
                    } else {
                      setImgError(true);
                    }
                  }}
                  className="relative w-24 h-24 rounded-full object-cover object-center mx-auto border-2 border-white/60 dark:border-cyan-400/40 ring-4 ring-white dark:ring-slate-900 shadow-lg group-hover/avatar:scale-105 transition-transform duration-300"
                />
              ) : (
                <div
                  className={`relative flex items-center justify-center object-center w-24 h-24 mx-auto rounded-full ring-4 ring-white dark:ring-slate-900 shadow-2xl bg-gradient-to-br ${member.badgeColor} text-white font-heading font-extrabold text-2xl tracking-tight`}
                >
                  {member.fallbackInitials}
                </div>
              )}
            </div>

            {/* Nama & Role Murni */}
            <h3 className="text-lg font-bold font-heading text-slate-900 dark:text-white tracking-tight leading-snug">
              {member.name}
            </h3>
            <p className={`text-xs font-semibold mt-1 ${member.accentText}`}>
              {member.role}
            </p>

            {/* Email Utuh (Tanpa Elipsis / break-all font-mono) */}
            {member.email && (
              <a
                href={`mailto:${member.email}`}
                onClick={(e) => e.stopPropagation()}
                className="mt-3 inline-flex items-center gap-1.5 py-1 px-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
                <span className="break-all text-xs text-slate-600 dark:text-slate-300 font-mono">
                  {member.email}
                </span>
              </a>
            )}
          </div>

          {/* Spacer Bawah Bersih (Tanpa Teks Petunjuk) */}
          <div className="h-2" />
        </div>

        {/* ── BAGIAN BELAKANG (Back Card) ── */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 [transform:rotateY(180deg)] glass-subcard p-6 flex flex-col justify-between rounded-3xl overflow-hidden border border-white/90 dark:border-cyan-500/30 shadow-xl group-hover:shadow-2xl transition-all duration-300">
          {/* Header Belakang: Nama & Role */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {member.name}
              </h4>
              <p className={`text-[11px] font-semibold ${member.accentText}`}>
                {member.role}
              </p>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${member.badgeColor}`}
            >
              {member.roleCode}
            </span>
          </div>

          {/* Poin-Poin Tanggung Jawab */}
          <div className="my-auto py-2 space-y-2 overflow-y-auto max-h-[230px] pr-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tanggung Jawab:
            </p>
            {member.responsibilities.map((resp, i) => (
              <div key={i} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                <span className="text-cyan-600 dark:text-cyan-400 mt-0.5 flex-shrink-0 font-bold">•</span>
                <span>{resp}</span>
              </div>
            ))}
          </div>

          {/* Badges Keahlian / Stack (Liquid Glass Pill) */}
          <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Keahlian / Stack:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {member.techStack.map((tech) => (
                <span key={tech} className="liquid-glass-pill text-[11px]">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AboutPage — Halaman Utama "About Us / Di Balik GWASena"
 */
export default function AboutPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="relative z-10 min-h-screen text-slate-900 dark:text-white flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-white">
      {/* ── TOPBAR NAVIGASI KHUSUS ABOUT US (Floating Liquid Glass) ── */}
      <header className="sticky top-0 z-40 glass-navbar px-4 sm:px-6 lg:px-8 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate(isAuthenticated ? '/dashboard' : '/welcome');
                }
              }}
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold
                         bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-cyan-500/30
                         text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400
                         hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all duration-150"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>

            <Link
              to={isAuthenticated ? '/dashboard' : '/welcome'}
              className="transition-transform hover:scale-[1.02] focus:outline-none"
            >
              <BrandLogo size="md" />
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={isAuthenticated ? '/dashboard' : '/welcome'}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors mr-2"
            >
              {isAuthenticated ? 'Ke Dashboard' : 'Ke Beranda'}
            </Link>
            <DnaThemeToggle externalTheme={theme} onToggleTheme={toggleTheme} />
          </div>
        </div>
      </header>

      {/* ── KONTEN UTAMA ── */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-12 md:space-y-16">
        {/* ── 1. HERO SECTION (Header Sesuai Copywriting) ── */}
        <section
          aria-labelledby="about-hero-heading"
          className="animate-fade-up glass-card p-6 sm:p-10 md:p-12 relative overflow-hidden"
          style={{ animationDelay: '0ms' }}
        >
          {/* Subtle Ambient Refractive Blobs */}
          <div
            className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-cyan-400/20 dark:bg-cyan-500/15 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-indigo-500/20 dark:bg-indigo-600/15 blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
            {/* Badge Header Persis: Kelompok 4 · Program Studi Bioinformatika · IPB University */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="liquid-glass-pill text-xs">
                <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                Kelompok 4 · Program Studi Bioinformatika · IPB University
              </span>
            </div>

            {/* Headline Utama: HURUF KAPITAL SEMUA */}
            <h1
              id="about-hero-heading"
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold font-heading tracking-tight text-slate-900 dark:text-white leading-[1.15]"
            >
              SATU ANALISIS DALAM SATU PLATFORM.
            </h1>

            {/* Subjudul & Deskripsi Persis Sesuai Prompt */}
            <div className="space-y-3 text-base md:text-lg text-slate-700 dark:text-slate-200 leading-relaxed max-w-3xl mx-auto">
              <h2 className="text-xl md:text-2xl font-bold text-cyan-600 dark:text-cyan-400 font-heading">
                Mengapa GWASena kami bangun?
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Analisis GWAS sering melibatkan berbagai perangkat dan tahapan yang terpisah. Hal ini dapat
                menyulitkan proses pengolahan data hingga interpretasi hasil, terutama bagi pengguna yang baru
                mempelajarinya. Melalui GWASena, kami mengintegrasikan tahapan analisis GWAS mulai dari Quality Control,
                PCA, Association Analysis, hingga visualisasi dan anotasi hasil dalam satu platform web yang lebih
                praktis dan mudah digunakan.
              </p>
            </div>
          </div>
        </section>

        {/* ── 2. BAGIAN TIM ("Kenali Tim di Balik GWASena") ── */}
        <section aria-labelledby="team-section-heading" className="space-y-8 animate-fade-up" style={{ animationDelay: '150ms' }}>
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2
              id="team-section-heading"
              className="text-2xl sm:text-3xl md:text-4xl font-extrabold font-heading text-slate-900 dark:text-white"
            >
              Kenali Tim di Balik GWASena
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              GWASena dikembangkan melalui kolaborasi lima anggota tim dengan peran dan keahlian masing-masing. Mulai
              dari pengembangan sistem, pengolahan data, hingga pengujian platform.
            </p>
          </div>

          {/* Grid Responsif 3D Flip Cards (1 mobile, 2-3 desktop) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {TEAM_MEMBERS.map((member, idx) => (
              <TeamFlipCard key={member.id} member={member} index={idx} />
            ))}
          </div>
        </section>

        {/* ── 3. BAGIAN SDLC / CARA KERJA ("Dari Ide Menjadi Platform") ── */}
        <section aria-labelledby="sdlc-section-heading" className="space-y-8 animate-fade-up" style={{ animationDelay: '300ms' }}>
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2
              id="sdlc-section-heading"
              className="text-2xl sm:text-3xl md:text-4xl font-extrabold font-heading text-slate-900 dark:text-white"
            >
              Dari Ide Menjadi Platform
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              GWASena dikembangkan melalui pendekatan Agile Scrum dengan proses pengerjaan bertahap. Setiap anggota
              tim berkolaborasi sesuai perannya, mulai dari perencanaan, pengembangan fitur, hingga pengujian untuk
              memastikan platform berjalan sesuai kebutuhan.
            </p>
          </div>

          {/* Stepper Alur Agile Scrum (6 Tahap Bersih Tanpa Badge Status Bawah) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SDLC_STEPS.map((step) => {
              const IconComp = step.icon;
              return (
                <div
                  key={step.no}
                  className="glass-subcard p-6 rounded-2xl flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 border border-white/80 dark:border-cyan-500/20"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400 opacity-80">
                        {step.no}
                      </span>
                      <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-slate-800/80 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30">
                        <IconComp className="w-5 h-5" />
                      </div>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {step.name}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1 mb-2">
                      {step.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 4. BAGIAN STATISTIK ("GWASena dalam Angka") ── */}
        <section aria-labelledby="stats-section-heading" className="space-y-8 animate-fade-up" style={{ animationDelay: '450ms' }}>
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2
              id="stats-section-heading"
              className="text-2xl sm:text-3xl md:text-4xl font-extrabold font-heading text-slate-900 dark:text-white"
            >
              GWASena dalam Angka
            </h2>
            <p className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">
              Sekilas tentang platform yang kami kembangkan.
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              GWASena menggabungkan berbagai fitur dan tahapan analisis genomik dalam satu platform. Berikut gambaran
              singkat mengenai fitur, teknologi, dan pengembangan GWASena.
            </p>
          </div>

          {/* Kotak Statistik .glass-card-accent (3 Kolom Seimbang & Simetris) */}
          <div className="glass-card-accent p-6 sm:p-10 rounded-3xl shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-slate-300/40 dark:divide-cyan-500/20">
              {/* Stat 1: 6 Tahap Pipeline Terintegrasi */}
              <div className="flex flex-col items-center justify-center p-4">
                <span className="text-4xl sm:text-5xl md:text-6xl font-black font-heading tracking-tight bg-gradient-to-r from-cyan-600 to-indigo-600 dark:from-cyan-300 dark:to-indigo-300 bg-clip-text text-transparent">
                  6
                </span>
                <span className="mt-3 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                  Tahap Pipeline Terintegrasi
                </span>
              </div>

              {/* Stat 2: 2 Model Statistik: GLM & MLM */}
              <div className="flex flex-col items-center justify-center p-4">
                <span className="text-4xl sm:text-5xl md:text-6xl font-black font-heading tracking-tight bg-gradient-to-r from-cyan-600 to-indigo-600 dark:from-cyan-300 dark:to-indigo-300 bg-clip-text text-transparent">
                  2
                </span>
                <span className="mt-3 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                  Model Statistik: GLM & MLM
                </span>
              </div>

              {/* Stat 3: 3 Komponen PCA Otomatis (PC1–PC3) */}
              <div className="flex flex-col items-center justify-center p-4">
                <span className="text-4xl sm:text-5xl md:text-6xl font-black font-heading tracking-tight bg-gradient-to-r from-cyan-600 to-indigo-600 dark:from-cyan-300 dark:to-indigo-300 bg-clip-text text-transparent">
                  3
                </span>
                <span className="mt-3 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                  Komponen PCA Otomatis (PC1–PC3)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. BAGIAN TANTANGAN TEKNIS ── */}
        <section aria-labelledby="challenge-section-heading" className="animate-fade-up" style={{ animationDelay: '550ms' }}>
          <div className="glass-card p-6 sm:p-8 md:p-10 rounded-3xl relative overflow-hidden border border-white/90 dark:border-cyan-500/30">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="p-4 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex-shrink-0">
                <Zap className="w-8 h-8" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                    Tantangan Teknis • Pengembangan Sistem
                  </span>
                </div>
                <h3 id="challenge-section-heading" className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white leading-snug">
                  Tantangan dan Solusi di Balik GWASena
                </h3>
                <blockquote className="text-sm md:text-base text-slate-700 dark:text-slate-200 italic border-l-4 border-cyan-500 pl-4 py-1 leading-relaxed">
                  &ldquo;Mengembangkan GWASena bukan hanya tentang menyatukan berbagai fitur analisis, tetapi juga
                  memastikan setiap tahapan dapat berjalan dengan baik dan saling terhubung.&rdquo;
                </blockquote>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                  Kami mengembangkan GWASena dengan mengintegrasikan berbagai proses analisis genomik dalam satu platform.
                  Mulai dari pengelolaan data, pemrosesan analisis, hingga penyajian hasil dalam bentuk visualisasi yang
                  mudah dipahami.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. BAGIAN PENUTUP (REPOSITORI GITHUB) ── */}
        <section aria-labelledby="github-section-heading" className="animate-fade-up" style={{ animationDelay: '650ms' }}>
          <div className="flex justify-center my-10">
            <div className="glass-card max-w-md w-full p-6 text-center flex flex-col items-center justify-center gap-3">
              <span id="github-section-heading" className="text-xs uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400">
                Kode Sumber & Dokumentasi
              </span>
              <a
                href="https://github.com/irawadirakan/Repo-GWASena"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full font-medium text-sm transition-all duration-300 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-white/10 shadow-lg hover:shadow-cyan-500/10 hover:scale-105"
              >
                <GithubIcon className="w-5 h-5 text-slate-900 dark:text-white" />
                <span>Repositori GitHub</span>
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER RESMI (Bersih dari frasa dilarang) ── */}
      <footer className="mt-12 border-t border-slate-200/80 dark:border-white/5 bg-white/50 dark:bg-[#121634]/50 px-4 py-5 text-center text-xs text-slate-600 dark:text-slate-400 backdrop-blur-md">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-center gap-2">
          <p>
            Kelompok 4 · Program Studi Bioinformatika · IPB University
          </p>
        </div>
      </footer>
    </div>
  );
}
