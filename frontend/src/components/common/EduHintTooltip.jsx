import { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info, X } from 'lucide-react';
import { EDU_HINTS } from '../../constants/eduHints.js';

/**
 * EduHintTooltip - Popover Penjelasan Ilmiah [EDU-HINT]
 * Acuan: docs/gwasena-v2/DESIGN.md Bagian 8A
 */
export default function EduHintTooltip({ hintKey, title, content, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const hintData = hintKey ? EDU_HINTS[hintKey] : null;
  const displayTitle = title || hintData?.label || 'Penjelasan Ilmiah';
  const displayContent = content || hintData?.hint || '';

  // Tutup tooltip saat klik di luar
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!displayContent) return null;

  return (
    <div ref={containerRef} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center rounded-full p-1 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/10 hover:text-[#06B6D4] active:scale-90 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/40 transition-all duration-100"
        aria-label={`Informasi edukatif tentang ${displayTitle}`}
        aria-expanded={isOpen}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute left-1/2 bottom-full z-50 mb-2 w-72 sm:w-80 -translate-x-1/2 figma-card p-4 shadow-2xl origin-bottom animate-pop-in"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-100 dark:bg-[#06B6D4]/15 text-cyan-800 dark:text-[#06B6D4] text-xs">
                <Info className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-bold text-cyan-800 dark:text-[#06B6D4] tracking-wide uppercase font-sans">
                EDU-HINT
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Title & Body (Nature/Science editorial typography) */}
          <div className="mt-2.5">
            <p className="text-xs font-bold font-sans text-slate-900 dark:text-white tracking-tight">{displayTitle}</p>
            <p className="mt-1.5 font-serif text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
              {displayContent}
            </p>
          </div>

          {/* Arrow */}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-[#121B38]" />
        </div>
      )}
    </div>
  );
}
