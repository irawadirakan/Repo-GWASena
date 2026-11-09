import { Outlet } from 'react-router-dom';
import DnaBackdrop from '../components/common/DnaBackdrop.jsx';
import BrandLogo from '../components/common/BrandLogo.jsx';
import FigmaThemeToggle from '../components/common/FigmaThemeToggle.jsx';

/**
 * AuthLayout - Pembungkus Layar Publik
 * Acuan: frontend/screens/01 — Login.png & 02 — Register.png
 */
export default function AuthLayout() {
  return (
    <DnaBackdrop showDna={false}>
      {/* ── Public Topbar Sesuai Figma (Floating Liquid Glass) ── */}
      <header className="sticky top-0 z-40 flex items-center justify-between glass-navbar px-4 py-3 sm:px-8">
        <BrandLogo size="md" />

        <div className="flex items-center gap-3">
          {/* Theme Toggle Pill Sesuai Figma (Area kanan atas hanya berisi toggle tema) */}
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
