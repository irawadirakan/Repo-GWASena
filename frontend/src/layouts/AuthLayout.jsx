import { Outlet } from 'react-router-dom';
import DnaBackdrop from '../components/common/DnaBackdrop.jsx';
import BrandLogo from '../components/common/BrandLogo.jsx';
import DnaThemeToggle from '../components/common/DnaThemeToggle.jsx';
import { useThemeStore } from '../store/useThemeStore.js';

/**
 * AuthLayout - Pembungkus Layar Publik
 * Acuan: frontend/screens/01 — Login.png & 02 — Register.png
 */
export default function AuthLayout() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <DnaBackdrop showDna={false}>
      {/* ── Public Topbar Sesuai Figma (Floating Liquid Glass) ── */}
      <header className="sticky top-0 z-40 flex items-center justify-between glass-navbar overflow-visible px-4 py-3 sm:px-8">
        <BrandLogo size="md" />

        <div className="flex items-center gap-3 overflow-visible">
          {/* Interactive DNA Helix Theme Toggle */}
          <DnaThemeToggle externalTheme={theme} onToggleTheme={toggleTheme} />
        </div>
      </header>

      {/* ── Main Auth Content ── */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>

      {/* ── Footer Institusi (Konsisten font-sans text-sm font-medium tracking-normal) ── */}
      <footer className="z-10 border-t border-slate-200/80 dark:border-white/5 bg-white/40 dark:bg-[#121634]/40 px-4 py-3 text-center font-sans text-sm font-medium tracking-normal text-slate-500 dark:text-slate-400 backdrop-blur-sm">
        Platform GWAS · Program Studi Bioinformatika IPB University
      </footer>
    </DnaBackdrop>
  );
}
