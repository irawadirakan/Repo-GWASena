import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore.js';

/**
 * FigmaThemeToggle - Switch Tema Sun/Moon Bergaya Pill Sesuai Desain Figma
 * Dengan kurva spring mulus dan rotasi ikon micro-interaction
 */
export default function FigmaThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#162142]/80 p-1 backdrop-blur-md hover:border-white/20 active:scale-95 transition-all duration-100 light:border-slate-300 light:bg-slate-200/80 shadow-inner ${className}`}
      aria-label={`Ganti ke tema ${isDark ? 'Terang' : 'Gelap'}`}
      title={`Beralih ke mode ${isDark ? 'Terang' : 'Gelap'}`}
    >
      {/* Sun Indicator */}
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200 ease-out ${
          !isDark
            ? 'bg-white text-amber-500 shadow-md scale-100'
            : 'text-slate-400 hover:text-slate-200 scale-95'
        }`}
      >
        <Sun className={`h-3.5 w-3.5 transition-transform duration-300 ${!isDark ? 'rotate-0' : '-rotate-45 opacity-70'}`} />
      </span>

      {/* Moon Indicator */}
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200 ease-out ${
          isDark
            ? 'bg-[#5B4DFE] text-white shadow-[0_0_12px_rgba(91,77,254,0.5)] scale-100'
            : 'text-slate-500 hover:text-slate-700 scale-95'
        }`}
      >
        <Moon className={`h-3.5 w-3.5 transition-transform duration-300 ${isDark ? 'rotate-0' : 'rotate-45 opacity-70'}`} />
      </span>
    </button>
  );
}
