import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import DnaBackdrop from '../components/common/DnaBackdrop.jsx';
import BrandLogo from '../components/common/BrandLogo.jsx';
import FigmaThemeToggle from '../components/common/FigmaThemeToggle.jsx';

/**
 * AuthLayout - Pembungkus Layar Publik (S-00, S-01, S-02)
 * Acuan: frontend/screens/01 — Login.png & 02 — Register.png
 */
export default function AuthLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const isIntroPage = location.pathname === '/welcome' || location.pathname === '/';

  const handleSkipIntro = () => {
    localStorage.setItem('gwasena_intro_completed', 'true');
    navigate('/login');
  };

  return (
    <DnaBackdrop showDna={true}>
      {/* ── Public Topbar Sesuai Figma (Floating Liquid Glass) ── */}
      <header className="sticky top-0 z-40 flex items-center justify-between glass-navbar px-4 py-3 sm:px-8">
        <BrandLogo size="md" />

        <div className="flex items-center gap-3">
          {/* Tombol Lewati Pengenalan (khusus saat di S-00) */}
          {isIntroPage && (
            <button
              type="button"
              onClick={handleSkipIntro}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white/95 dark:bg-[#162142]/80 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-[#1E2C58] active:scale-95 transition-all shadow-sm"
            >
              <span>Lewati ke Masuk</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Theme Toggle Pill Sesuai Figma */}
          <FigmaThemeToggle />
        </div>
      </header>

      {/* ── Main Auth Content ── */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>

      {/* ── Footer Institusi ── */}
      <footer className="z-10 border-t border-slate-200/80 dark:border-white/5 bg-white/40 dark:bg-[#121634]/40 px-4 py-3 text-center text-xs font-serif italic text-slate-600 dark:text-slate-400 backdrop-blur-sm">
        Platform GWAS · Program Studi Bioinformatika IPB University
      </footer>
    </DnaBackdrop>
  );
}
