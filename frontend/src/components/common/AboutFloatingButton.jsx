import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users } from 'lucide-react';

/**
 * AboutFloatingButton — Floating Action Button (FAB) Global "About Us"
 * Persisten di seluruh halaman (S-00 s.d. S-10).
 * Menggunakan prinsip Liquid Glass UI Kit dengan efek floating, hover scale,
 * dan tooltip "Tim di Balik GWASena".
 */
export default function AboutFloatingButton() {
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);

  // Sembunyikan FAB jika pengguna sudah berada di halaman /about
  if (location.pathname === '/about') {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] pointer-events-auto">
      <Link
        to="/about"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        aria-label="Tim di Balik GWASena"
        className="glass-btn group relative flex items-center justify-center rounded-full p-4
                   bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl
                   border border-white/80 dark:border-cyan-500/30 shadow-2xl
                   hover:bg-white/90 dark:hover:bg-slate-900/90
                   hover:border-cyan-400 dark:hover:border-cyan-400
                   hover:shadow-[0_10px_35px_rgba(6,182,212,0.35)]
                   transition-all duration-300 ease-out
                   hover:scale-110 active:scale-95 animate-float-slow select-none
                   focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
      >
        {/* Glow ambient ring on hover */}
        <span
          className="absolute inset-0 rounded-full bg-cyan-400/20 dark:bg-cyan-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          aria-hidden="true"
        />

        {/* Ikon Pengguna / Tim Elegan */}
        <Users className="h-6 w-6 text-indigo-600 dark:text-cyan-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors duration-200" />

        {/* Pulse beacon dot bernapas di pojok tombol */}
        <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
        </span>

        {/* Tooltip Kaca "Tim di Balik GWASena" */}
        <div
          role="tooltip"
          className={`absolute right-full mr-3 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold
                     transition-all duration-200 pointer-events-none
                     bg-slate-900/90 dark:bg-slate-950/95 text-white dark:text-cyan-100
                     border border-slate-700/60 dark:border-cyan-500/30 shadow-xl backdrop-blur-md
                     ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}`}
        >
          Tim di Balik GWASena
          {/* Panah tooltip */}
          <span
            className="absolute top-1/2 -right-1 -translate-y-1/2 border-4 border-transparent border-l-slate-900/90 dark:border-l-slate-950/95"
            aria-hidden="true"
          />
        </div>
      </Link>
    </div>
  );
}
