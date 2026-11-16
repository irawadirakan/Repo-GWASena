import { useEffect, useRef, useState, useCallback } from 'react';
import { useThemeStore } from '../../store/useThemeStore.js';

/**
 * InteractiveLogoParticles - Pure HTML5 Canvas 2D Particle Logo
 * Menampilkan Logo Resmi GWASena dalam bentuk ribuan partikel genomik interaktif
 * dengan fisika repulsion kursor, efek ripple klik, ambient SNP constellation,
 * dan adaptasi tema otomatis (Dark vs Light Mode).
 */
export default function InteractiveLogoParticles({
  className = '',
  width = 460,
  height = 200,
  logoSrc = '/assets/figma/logo-official.png',
  fallbackSrc = '/assets/logo-gwasena.png',
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';

  const [hasError, setHasError] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // References for animation loop state
  const animFrameIdRef = useRef(null);
  const isVisibleRef = useRef(true);
  const mouseRef = useRef({ x: -9999, y: -9999, radius: 95 });
  const ripplesRef = useRef([]);
  const particlesRef = useRef([]);
  const ambientDotsRef = useRef([]);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);

    const handler = (e) => setReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Main Canvas & Particle Simulation Effect
  useEffect(() => {
    if (reducedMotion || hasError) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let isDisposed = false;

    // Responsive Canvas Resizing with Device Pixel Ratio (Retina sharpness)
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let displayWidth = canvas.clientWidth || width;
    let displayHeight = canvas.clientHeight || height;

    canvas.width = Math.floor(displayWidth * dpr);
    canvas.height = Math.floor(displayHeight * dpr);
    ctx.scale(dpr, dpr);

    // Color conversion helper for theme-aware particles
    const enhanceColor = (r, g, b, dark) => {
      if (dark) {
        // Dark Mode: Bioluminescent Cyan (#06B6D4) & Electric Indigo (#818CF8)
        // Boost cyan/blue/indigo spectrum while preserving logo identity
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        if (brightness > 0.8) {
          return { r: 56, g: 189, b: 248, a: 0.95 }; // Sky cyan
        } else if (r > g && r > b) {
          // Warm red/orange accents from IPB logo or flame
          return { r: Math.min(255, r + 40), g: Math.min(255, g + 20), b: Math.min(255, b + 20), a: 0.95 };
        } else if (b >= r) {
          // Blue / Cyan tones
          return { r: 6, g: 182, b: 212, a: 0.95 };
        }
        return { r: Math.min(255, r + 30), g: Math.min(255, g + 40), b: Math.min(255, b + 50), a: 0.92 };
      } else {
        // Light Mode: Deep Clinical Sapphire (#0284C7 / #1E3A8A) & Vibrant Indigo (#4F46E5)
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        if (brightness > 0.85) {
          // Very bright whites become deep clinical blue-grey for contrast
          return { r: 2, g: 132, b: 199, a: 0.95 };
        } else if (r > g && r > b) {
          // Warm red/gold tones deepened
          return { r: 185, g: 28, b: 28, a: 0.95 };
        }
        // Deep vibrant sapphire & indigo
        return { r: 30, g: 58, b: 138, a: 0.95 };
      }
    };

    // Load logo and sample pixel data
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const handleImageLoad = () => {
      if (isDisposed) return;

      const offCanvas = document.createElement('canvas');
      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) return;

      // Target bounds for logo within interactive canvas
      const maxW = displayWidth * 0.78;
      const maxH = displayHeight * 0.76;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const targetW = Math.round(img.width * scale);
      const targetH = Math.round(img.height * scale);

      offCanvas.width = targetW;
      offCanvas.height = targetH;
      offCtx.drawImage(img, 0, 0, targetW, targetH);

      let imgData;
      try {
        imgData = offCtx.getImageData(0, 0, targetW, targetH).data;
      } catch (err) {
        console.warn('InteractiveLogoParticles: getImageData CORS fallback to static logo', err);
        setHasError(true);
        return;
      }

      const offsetX = (displayWidth - targetW) / 2;
      const offsetY = (displayHeight - targetH) / 2;

      // Calculate sample step gap to achieve optimal 1,300 - 2,100 particles
      const rawPixels = (targetW * targetH) / 16;
      const gap = rawPixels > 2500 ? 4 : 3;

      const newParticles = [];

      for (let y = 0; y < targetH; y += gap) {
        for (let x = 0; x < targetW; x += gap) {
          const index = (y * targetW + x) * 4;
          const a = imgData[index + 3];

          // Sample pixels with meaningful opacity
          if (a > 110) {
            const r = imgData[index];
            const g = imgData[index + 1];
            const b = imgData[index + 2];

            const originX = offsetX + x;
            const originY = offsetY + y;

            // Initial cinematic scatter: particles start dispersed, then spring together
            const scatterDist = Math.random() * 80 + 30;
            const scatterAngle = Math.random() * Math.PI * 2;
            const initialX = originX + Math.cos(scatterAngle) * scatterDist;
            const initialY = originY + Math.sin(scatterAngle) * scatterDist;

            newParticles.push({
              originX,
              originY,
              x: initialX,
              y: initialY,
              vx: (Math.random() - 0.5) * 1.5,
              vy: (Math.random() - 0.5) * 1.5,
              rawColor: { r, g, b },
              color: enhanceColor(r, g, b, isDark),
              size: (Math.random() * 0.8 + 1.4), // 1.4px - 2.2px
              ease: Math.random() * 0.03 + 0.065, // Spring return speed
              friction: 0.84, // Velocity damping
            });
          }
        }
      }

      particlesRef.current = newParticles;

      // Initialize ~45 ambient genomic SNP variant floating dots
      const ambientCount = 42;
      const newAmbient = [];
      for (let i = 0; i < ambientCount; i++) {
        newAmbient.push({
          x: Math.random() * displayWidth,
          y: Math.random() * displayHeight,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          radius: Math.random() * 0.8 + 0.9,
          pulse: Math.random() * Math.PI * 2,
        });
      }
      ambientDotsRef.current = newAmbient;

      // Start animation loop
      startAnimationLoop();
    };

    const handleImageError = () => {
      if (img.src.includes('logo-official.png')) {
        img.src = fallbackSrc;
      } else {
        setHasError(true);
      }
    };

    img.onload = handleImageLoad;
    img.onerror = handleImageError;
    img.src = logoSrc;

    // Animation Render Loop
    const renderFrame = () => {
      if (isDisposed) return;

      if (!isVisibleRef.current) {
        animFrameIdRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      ctx.clearRect(0, 0, displayWidth, displayHeight);

      const mouse = mouseRef.current;
      const mouseActive = mouse.x > -500;
      const mouseRadius = mouse.radius;
      const mouseRadiusSq = mouseRadius * mouseRadius;

      // ── 1. Draw Subtle Background Constellation Lines & Ambient SNP Dots ──
      const ambient = ambientDotsRef.current;
      const ambientLen = ambient.length;
      const maxConnectDist = 65;
      const maxConnectDistSq = maxConnectDist * maxConnectDist;

      // Ambient connecting constellation lines
      ctx.lineWidth = 0.65;
      for (let i = 0; i < ambientLen; i++) {
        const dotA = ambient[i];
        for (let j = i + 1; j < ambientLen; j++) {
          const dotB = ambient[j];
          const ddx = dotB.x - dotA.x;
          const ddy = dotB.y - dotA.y;
          const distSq = ddx * ddx + ddy * ddy;
          if (distSq < maxConnectDistSq) {
            const alpha = (1 - Math.sqrt(distSq) / maxConnectDist) * (isDark ? 0.18 : 0.12);
            ctx.strokeStyle = isDark
              ? `rgba(6, 182, 212, ${alpha})`
              : `rgba(2, 132, 199, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(dotA.x, dotA.y);
            ctx.lineTo(dotB.x, dotB.y);
            ctx.stroke();
          }
        }
      }

      // Draw ambient floating dots
      for (let i = 0; i < ambientLen; i++) {
        const dot = ambient[i];
        dot.x += dot.vx;
        dot.y += dot.vy;
        dot.pulse += 0.03;

        // Wrap around canvas edges
        if (dot.x < 0) dot.x = displayWidth;
        if (dot.x > displayWidth) dot.x = 0;
        if (dot.y < 0) dot.y = displayHeight;
        if (dot.y > displayHeight) dot.y = 0;

        const pulseAlpha = Math.sin(dot.pulse) * 0.15 + (isDark ? 0.45 : 0.35);
        ctx.fillStyle = isDark
          ? `rgba(56, 189, 248, ${pulseAlpha})`
          : `rgba(14, 165, 233, ${pulseAlpha})`;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── 2. Process Ripples (Click Shockwave Impulses) ──
      const ripples = ripplesRef.current;
      for (let rIdx = ripples.length - 1; rIdx >= 0; rIdx--) {
        const rip = ripples[rIdx];
        rip.radius += rip.speed;
        rip.alpha *= 0.91;

        if (rip.alpha < 0.03 || rip.radius > rip.maxRadius) {
          ripples.splice(rIdx, 1);
          continue;
        }

        // Draw expanding ripple ring
        ctx.strokeStyle = isDark
          ? `rgba(6, 182, 212, ${rip.alpha * 0.6})`
          : `rgba(2, 132, 199, ${rip.alpha * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── 3. Physics Update & Render for Logo Particles ──
      const particles = particlesRef.current;
      const partLen = particles.length;

      for (let i = 0; i < partLen; i++) {
        const p = particles[i];

        // A. Repulsion from Mouse Cursor
        if (mouseActive) {
          const mdx = mouse.x - p.x;
          const mdy = mouse.y - p.y;
          const mDistSq = mdx * mdx + mdy * mdy;

          if (mDistSq < mouseRadiusSq && mDistSq > 0.01) {
            const mDist = Math.sqrt(mDistSq);
            const mForce = (1 - mDist / mouseRadius) * 4.8;
            p.vx -= (mdx / mDist) * mForce;
            p.vy -= (mdy / mDist) * mForce;
          }
        }

        // B. Impulses from Click Shockwave Ripples
        for (let rIdx = 0; rIdx < ripples.length; rIdx++) {
          const rip = ripples[rIdx];
          const rdx = p.x - rip.x;
          const rdy = p.y - rip.y;
          const rDist = Math.hypot(rdx, rdy);
          const diff = Math.abs(rDist - rip.radius);

          if (diff < 22 && rDist > 0.1) {
            const impulse = (1 - diff / 22) * rip.strength * rip.alpha;
            p.vx += (rdx / rDist) * impulse;
            p.vy += (rdy / rDist) * impulse;
          }
        }

        // C. Elastic Return to Origin Coordinates (Spring Easing)
        const homeDx = p.originX - p.x;
        const homeDy = p.originY - p.y;
        p.vx += homeDx * p.ease;
        p.vy += homeDy * p.ease;

        // D. Apply Friction / Damping
        p.vx *= p.friction;
        p.vy *= p.friction;

        p.x += p.vx;
        p.y += p.vy;

        // E. Render Particle Dot
        const col = p.color;
        ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${col.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animFrameIdRef.current = requestAnimationFrame(renderFrame);
    };

    const startAnimationLoop = () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = requestAnimationFrame(renderFrame);
    };

    // Update particle colors when theme changes
    particlesRef.current.forEach((p) => {
      p.color = enhanceColor(p.rawColor.r, p.rawColor.g, p.rawColor.b, isDark);
    });

    // ── Mouse & Touch Handlers ──
    const getCanvasCoordinates = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    const handleMouseMove = (e) => {
      const coords = getCanvasCoordinates(e.clientX, e.clientY);
      mouseRef.current.x = coords.x;
      mouseRef.current.y = coords.y;
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
      setIsHovered(false);
    };

    const handleClick = (e) => {
      const coords = getCanvasCoordinates(e.clientX, e.clientY);
      // Trigger radial shockwave ripple
      ripplesRef.current.push({
        x: coords.x,
        y: coords.y,
        radius: 4,
        maxRadius: 150,
        speed: 6.5,
        strength: 5.2,
        alpha: 0.9,
      });
    };

    const handleTouchMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];
      const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
      mouseRef.current.x = coords.x;
      mouseRef.current.y = coords.y;
      setIsHovered(true);
    };

    const handleTouchEnd = () => {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
      setIsHovered(false);
    };

    canvas.addEventListener('mousemove', handleMouseMove, { passive: true });
    canvas.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true });

    // ── Resize Observer for High-DPI Responsiveness ──
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && (Math.abs(w - displayWidth) > 5 || Math.abs(h - displayHeight) > 5)) {
          displayWidth = w;
          displayHeight = h;
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
          ctx.scale(dpr, dpr);
          // Re-sample / center particles on significant resize
          handleImageLoad();
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // ── Visibility & Intersection Observer (0% CPU when not visible) ──
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isVisibleRef.current = entry.isIntersecting && document.visibilityState === 'visible';
      },
      { threshold: 0.05 }
    );
    intersectionObserver.observe(canvas);

    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup Everything on Unmount
    return () => {
      isDisposed = true;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [reducedMotion, hasError, isDark, logoSrc, fallbackSrc, width, height]);

  // Graceful Static Fallback for reduced motion or image load failure
  if (reducedMotion || hasError) {
    return (
      <div className={`relative flex flex-col items-center justify-center ${className}`}>
        <div className="relative group cursor-pointer transition-transform duration-300 hover:scale-105">
          {/* Subtle Ambient Glow Ring */}
          <div
            aria-hidden="true"
            className="absolute -inset-2 rounded-full opacity-30 blur-xl transition-opacity duration-500 group-hover:opacity-50"
            style={{
              background: isDark
                ? 'radial-gradient(circle, rgba(6,182,212,0.4) 0%, rgba(99,102,241,0.2) 70%, transparent 100%)'
                : 'radial-gradient(circle, rgba(2,132,199,0.3) 0%, rgba(79,70,229,0.15) 70%, transparent 100%)',
            }}
          />
          <img
            src={logoSrc}
            alt="GWASena Official Logo"
            className="relative h-20 sm:h-24 w-auto object-contain drop-shadow-md select-none pointer-events-none"
            onError={() => setHasError(true)}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center justify-center w-full max-w-[460px] mx-auto select-none ${className}`}
    >
      {/* ── Soft Ambient Backing Glow (Cosmic Bioluminescence Aura) ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-3 rounded-full opacity-35 dark:opacity-40 blur-2xl transition-opacity duration-700"
        style={{
          background: isDark
            ? 'radial-gradient(circle at center, rgba(6, 182, 212, 0.28) 0%, rgba(99, 102, 241, 0.15) 55%, transparent 80%)'
            : 'radial-gradient(circle at center, rgba(2, 132, 199, 0.22) 0%, rgba(79, 70, 229, 0.12) 60%, transparent 80%)',
        }}
      />

      {/* ── Interactive Particle Canvas ── */}
      <canvas
        ref={canvasRef}
        className="relative z-10 w-full h-[180px] sm:h-[210px] cursor-grab active:cursor-grabbing touch-none transition-transform duration-300"
        style={{ display: 'block' }}
        title="Partikel Genomik Logo GWASena — Gerakkan kursor atau klik kanvas"
        aria-label="Simulasi partikel genomik interaktif membentuk logo resmi GWASena"
      />
    </div>
  );
}
