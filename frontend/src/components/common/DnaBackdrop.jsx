import { memo } from 'react';

/**
 * DnaBackdrop - Latar Belakang Atmosferik Heliks DNA Sesuai Desain Figma
 * Menggunakan grafis vektor DNA ambient kiri & kanan serta gradasi kosmik halus.
 */
function DnaBackdrop({ children, showDna = true, showVignette = true, className = '' }) {
  return (
    <div
      className={`relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-[#E8EEFA] via-[#F1F5FD] to-[#E5EAFC] dark:from-[#080D24] dark:via-[#111A3E] dark:to-[#1B1240] ${className}`}
    >
      {/* ── Background Glow & DNA Graphics (Only shown when showDna is true) ── */}
      {showDna && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
        >
          {/* Ambient Glow Kiri Atas & Kanan Tengah (Depth-refracting blobs for High-Separation Glassmorphism) */}
          <div className="absolute -left-[10%] -top-[10%] h-[38rem] w-[38rem] rounded-full bg-[#38BDF8]/20 dark:bg-[#1E40AF]/30 blur-[140px]" />
          <div className="absolute -right-[12%] top-[18%] h-[42rem] w-[42rem] rounded-full bg-[#A78BFA]/20 dark:bg-[#4C1D95]/35 blur-[150px]" />
          <div className="absolute left-[35%] bottom-[5%] h-[28rem] w-[28rem] rounded-full bg-[#06B6D4]/15 dark:bg-[#06B6D4]/12 blur-[130px]" />

          {/* Vektor DNA Ambient Kiri (Figma Assets) */}
          <img
            src="/assets/figma/dna-ambient-left.png"
            alt=""
            className="absolute left-0 top-1/4 max-h-[75vh] w-auto object-contain opacity-25 dark:opacity-30 mix-blend-multiply dark:mix-blend-normal drop-shadow-[0_0_20px_rgba(6,182,212,0.15)] motion-reduce:hidden"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />

          {/* Vektor DNA Ambient Kanan (Figma Assets) */}
          <img
            src="/assets/figma/dna-ambient-right.png"
            alt=""
            className="absolute right-0 top-10 max-h-[75vh] w-auto object-contain opacity-25 dark:opacity-30 mix-blend-multiply dark:mix-blend-normal drop-shadow-[0_0_20px_rgba(99,102,241,0.15)] motion-reduce:hidden"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />

          {/* Lapisan Vignette Radial untuk Memastikan Keterbacaan Kontras (WCAG AAA) */}
          {showVignette && (
            <div
              className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-background/40 pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(circle at center, transparent 35%, var(--bg-background) 90%)',
              }}
            />
          )}
        </div>
      )}

      {/* Konten Halaman */}
      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

export default memo(DnaBackdrop);
