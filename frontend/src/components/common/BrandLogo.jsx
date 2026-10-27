import { useState } from 'react';

export default function BrandLogo({ size = 'md', showTagline = true, className = '' }) {
  const [imgError, setImgError] = useState(false);

  const heights = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-11',
    lg: 'h-14 sm:h-16',
    xl: 'h-20 sm:h-24',
  };

  if (!imgError) {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <img
          src="/assets/figma/logo-official.png"
          alt="GWASena - From Genotype to Discovery"
          className={`${heights[size] || heights.md} w-auto object-contain select-none transition-all drop-shadow-[0_2px_10px_rgba(6,182,212,0.15)]`}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback SVG murni jika file gambar belum termuat
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-[#0A2472] to-[#0096FF] shadow-sm">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5 text-white"
        >
          <path d="M2 15c6.667-6 13.333 0 20-6" />
          <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
          <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
          <path d="m17 6 5-5m0 0h-4m4 0v4" />
        </svg>
      </div>
      <div className="flex flex-col">
        <div className="flex items-baseline tracking-tight font-bold text-lg leading-tight">
          <span className="text-[#0A2472] dark:text-[#38BDF8]">GWA</span>
          <span className="text-[#0096FF]">Sena.</span>
        </div>
        {showTagline && (
          <span className="text-[10px] text-text-muted font-medium tracking-wide">
            From Genotype to Discovery
          </span>
        )}
      </div>
    </div>
  );
}
