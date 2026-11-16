import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, Info, X, GripHorizontal } from 'lucide-react';
import { EDU_HINTS } from '../../constants/eduHints.js';

/**
 * EduHintTooltip - Floating & Draggable Panel Penjelasan Ilmiah [EDU-HINT]
 * Menggunakan React Portal & Viewport Boundary Clamping agar tidak terpotong
 * dan dapat digeser bebas oleh pengguna saat mengatur parameter QC.
 */
export default function EduHintTooltip({ hintKey, title, content, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const hintData = hintKey ? EDU_HINTS[hintKey] : null;
  const displayTitle = title || hintData?.label || 'Penjelasan Ilmiah';
  const displayContent = content || hintData?.hint || '';

  // Buka panel dan hitung posisi awal yang ideal serta aman dalam viewport
  const handleOpen = useCallback((e) => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    const panelWidth = 340;
    const panelHeight = 220;
    const padding = 20;

    let initialX = window.innerWidth - panelWidth - padding;
    let initialY = 120;

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Posisikan dekat tombol jika memungkinkan, clamp ke dalam batas viewport
      initialX = Math.min(
        Math.max(padding, rect.right + 12),
        window.innerWidth - panelWidth - padding
      );
      initialY = Math.min(
        Math.max(padding, rect.top - 20),
        window.innerHeight - panelHeight - padding
      );
    }

    setPosition({ x: initialX, y: initialY });
    setIsOpen(true);
  }, [isOpen]);

  // Handler Drag: Mouse & Touch
  const handleStartDrag = (clientX, clientY) => {
    setIsDragging(true);
    dragOffsetRef.current = {
      x: clientX - position.x,
      y: clientY - position.y,
    };
  };

  const handleMouseDownHeader = (e) => {
    e.preventDefault();
    handleStartDrag(e.clientX, e.clientY);
  };

  const handleTouchStartHeader = (e) => {
    if (e.touches.length > 0) {
      handleStartDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Event listener drag & boundary clamping
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const panelWidth = panelRef.current?.offsetWidth || 340;
      const panelHeight = panelRef.current?.offsetHeight || 220;
      const padding = 12;

      let newX = e.clientX - dragOffsetRef.current.x;
      let newY = e.clientY - dragOffsetRef.current.y;

      const maxX = window.innerWidth - panelWidth - padding;
      const maxY = window.innerHeight - panelHeight - padding;

      newX = Math.max(padding, Math.min(newX, maxX));
      newY = Math.max(padding, Math.min(newY, maxY));

      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        handleMouseMove(e.touches[0]);
      }
    };

    const handleStopDrag = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleStopDrag);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleStopDrag);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleStopDrag);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleStopDrag);
    };
  }, [isDragging]);

  // Handle ESC key untuk menutup
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Handle resize viewport
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      const panelWidth = panelRef.current?.offsetWidth || 340;
      const panelHeight = panelRef.current?.offsetHeight || 220;
      const padding = 12;
      setPosition((prev) => ({
        x: Math.max(padding, Math.min(prev.x, window.innerWidth - panelWidth - padding)),
        y: Math.max(padding, Math.min(prev.y, window.innerHeight - panelHeight - padding)),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  if (!displayContent) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center justify-center rounded-full p-1 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/10 hover:text-[#06B6D4] active:scale-90 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/40 transition-all duration-100 ${className}`}
        aria-label={`Buka panduan ilmiah ${displayTitle}`}
        aria-expanded={isOpen}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {/* Floating & Draggable Portal Panel */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-labelledby="eduhint-title"
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
              touchAction: 'none',
            }}
            className="fixed z-[9999] w-80 sm:w-96 rounded-2xl figma-card p-4 sm:p-5 shadow-2xl border border-cyan-400/40 dark:border-[#06B6D4]/40 bg-white/95 dark:bg-[#0A1024]/95 backdrop-blur-2xl animate-pop-in select-none text-left"
          >
            {/* Draggable Header */}
            <div
              onMouseDown={handleMouseDownHeader}
              onTouchStart={handleTouchStartHeader}
              className={`flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2.5 mb-2.5 ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              title="Klik dan geser untuk memindahkan panel ini di layar"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-100 dark:bg-[#06B6D4]/20 text-[#0284C7] dark:text-[#06B6D4]">
                  <Info className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-bold text-[#0284C7] dark:text-[#06B6D4] tracking-wider uppercase font-sans">
                  EDU-HINT
                </span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  (Dapat Digeser)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5">
                  <GripHorizontal className="h-4 w-4" />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
                  aria-label="Tutup panel panduan"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Title & Body */}
            <div className="space-y-1.5 select-text cursor-auto">
              <h4 id="eduhint-title" className="text-sm font-bold font-sans text-slate-900 dark:text-white tracking-tight">
                {displayTitle}
              </h4>
              <p className="font-serif text-xs sm:text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
                {displayContent}
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
