import { useEffect, useRef, useState, memo, useCallback } from 'react';
import { useThemeStore } from '../../store/useThemeStore.js';

/**
 * Crossfade window duration in seconds.
 * 2.0 seconds provides a buttery-smooth imperceptible cross-dissolve.
 */
const CROSSFADE_WINDOW_SEC = 2.0;

/**
 * DualVideoPlayer
 * Manages twin video elements (Buffer A & Buffer B) with stacked Z-index cross-dissolve:
 * - The active buffer stays solid (opacity: 1, z-index: 1) underneath.
 * - The incoming buffer is placed on top (z-index: 2) and fades from opacity 0 -> 1.
 * - Combined opacity is strictly 100% at all times (Zero Opacity Gap, Zero Blackout).
 */
function DualVideoPlayer({ src, isActive, filter }) {
  const videoRefA = useRef(null);
  const videoRefB = useRef(null);
  const activeBufferRef = useRef('A');
  const isCrossfadingRef = useRef(false);
  const rafIdRef = useRef(null);
  const switchTimeoutRef = useRef(null);

  const [layers, setLayers] = useState({
    a: { opacity: 1, zIndex: 1, transition: 'none' },
    b: { opacity: 0, zIndex: 2, transition: 'none' },
  });

  const [reducedMotion, setReducedMotion] = useState(false);

  // Explicitly ensure DOM muted property is true for Safari/iOS/Chrome autoplay guarantees
  useEffect(() => {
    if (videoRefA.current) videoRefA.current.muted = true;
    if (videoRefB.current) videoRefB.current.muted = true;
  }, []);

  // Monitor prefers-reduced-motion accessibility preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);

    const handler = (e) => {
      setReducedMotion(e.matches);
    };

    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Fail-safe completion if video fires 'ended' before timer finishes
  const handleEndedA = useCallback(() => {
    if (activeBufferRef.current === 'A') {
      const videoA = videoRefA.current;
      if (videoA) {
        videoA.pause();
        videoA.currentTime = 0;
      }
      activeBufferRef.current = 'B';
      isCrossfadingRef.current = false;
      setLayers({
        a: { opacity: 0, zIndex: 2, transition: 'none' },
        b: { opacity: 1, zIndex: 1, transition: 'none' },
      });
    }
  }, []);

  const handleEndedB = useCallback(() => {
    if (activeBufferRef.current === 'B') {
      const videoB = videoRefB.current;
      if (videoB) {
        videoB.pause();
        videoB.currentTime = 0;
      }
      activeBufferRef.current = 'A';
      isCrossfadingRef.current = false;
      setLayers({
        a: { opacity: 1, zIndex: 1, transition: 'none' },
        b: { opacity: 0, zIndex: 2, transition: 'none' },
      });
    }
  }, []);

  // Main playback & zero-gap crossfade loop
  useEffect(() => {
    const videoA = videoRefA.current;
    const videoB = videoRefB.current;
    if (!videoA || !videoB) return;

    if (reducedMotion) {
      videoA.pause();
      videoB.pause();
      videoA.currentTime = 0;
      videoB.currentTime = 0;
      return;
    }

    if (!isActive) {
      // Pause after theme crossfade completes (700ms) to save CPU/GPU
      const pauseTimer = setTimeout(() => {
        if (!isActive) {
          videoA.pause();
          videoB.pause();
        }
      }, 700);
      return () => clearTimeout(pauseTimer);
    }

    // Active theme: ensure active buffer is playing
    const currentVideo = activeBufferRef.current === 'A' ? videoA : videoB;
    const playPromise = currentVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay safe fallback
      });
    }

    const checkTime = () => {
      const activeVid = activeBufferRef.current === 'A' ? videoA : videoB;
      const nextVid = activeBufferRef.current === 'A' ? videoB : videoA;

      if (
        activeVid &&
        activeVid.duration &&
        !isNaN(activeVid.duration) &&
        activeVid.duration > CROSSFADE_WINDOW_SEC * 2
      ) {
        const timeLeft = activeVid.duration - activeVid.currentTime;

        // When active buffer approaches crossfade window, launch the twin buffer on top
        if (timeLeft <= CROSSFADE_WINDOW_SEC && !isCrossfadingRef.current) {
          isCrossfadingRef.current = true;

          // Start incoming video from beginning
          nextVid.currentTime = 0;
          const p = nextVid.play();
          if (p !== undefined) {
            p.catch(() => {});
          }

          if (activeBufferRef.current === 'A') {
            // Buffer B fades in on top (z-index 2) while Buffer A remains 100% solid underneath (z-index 1)
            setLayers({
              a: { opacity: 1, zIndex: 1, transition: 'none' },
              b: {
                opacity: 1,
                zIndex: 2,
                transition: `opacity ${CROSSFADE_WINDOW_SEC}s ease-in-out`,
              },
            });

            switchTimeoutRef.current = setTimeout(() => {
              if (videoA) {
                videoA.pause();
                videoA.currentTime = 0;
              }
              // Buffer B is now the solid base (z-index 1); Buffer A resets on top (z-index 2, opacity 0)
              setLayers({
                a: { opacity: 0, zIndex: 2, transition: 'none' },
                b: { opacity: 1, zIndex: 1, transition: 'none' },
              });
              activeBufferRef.current = 'B';
              isCrossfadingRef.current = false;
            }, CROSSFADE_WINDOW_SEC * 1000);
          } else {
            // Buffer A fades in on top (z-index 2) while Buffer B remains 100% solid underneath (z-index 1)
            setLayers({
              a: {
                opacity: 1,
                zIndex: 2,
                transition: `opacity ${CROSSFADE_WINDOW_SEC}s ease-in-out`,
              },
              b: { opacity: 1, zIndex: 1, transition: 'none' },
            });

            switchTimeoutRef.current = setTimeout(() => {
              if (videoB) {
                videoB.pause();
                videoB.currentTime = 0;
              }
              // Buffer A is now the solid base (z-index 1); Buffer B resets on top (z-index 2, opacity 0)
              setLayers({
                a: { opacity: 1, zIndex: 1, transition: 'none' },
                b: { opacity: 0, zIndex: 2, transition: 'none' },
              });
              activeBufferRef.current = 'A';
              isCrossfadingRef.current = false;
            }, CROSSFADE_WINDOW_SEC * 1000);
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(checkTime);
    };

    rafIdRef.current = requestAnimationFrame(checkTime);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (switchTimeoutRef.current) {
        clearTimeout(switchTimeoutRef.current);
      }
    };
  }, [isActive, reducedMotion]);

  // Handle tab visibility change (auto-resume when user returns to tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) return;
      if (!isActive || reducedMotion) return;
      const currentVideo = activeBufferRef.current === 'A' ? videoRefA.current : videoRefB.current;
      if (currentVideo && currentVideo.paused) {
        currentVideo.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isActive, reducedMotion]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
      {/* Buffer A */}
      <video
        ref={videoRefA}
        src={src}
        muted
        loop={false}
        playsInline
        preload="auto"
        onEnded={handleEndedA}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none will-change-[opacity]"
        style={{
          opacity: layers.a.opacity,
          zIndex: layers.a.zIndex,
          transition: layers.a.transition,
          filter: filter || undefined,
        }}
      />

      {/* Buffer B */}
      <video
        ref={videoRefB}
        src={src}
        muted
        loop={false}
        playsInline
        preload="auto"
        onEnded={handleEndedB}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none will-change-[opacity]"
        style={{
          opacity: layers.b.opacity,
          zIndex: layers.b.zIndex,
          transition: layers.b.transition,
          filter: filter || undefined,
        }}
      />
    </div>
  );
}

const MemoizedDualVideoPlayer = memo(DualVideoPlayer);

/**
 * SeamlessVideoBackground
 * Global component providing anti jump-cut live looping video background
 * with stacked dual-buffer cross-dissolve for Dark and Light modes, scientific ambient overlay,
 * and seamless 600ms theme crossfade.
 */
function SeamlessVideoBackground() {
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none select-none z-0"
    >
      {/* Fallback solid background color underneath videos to prevent any flash */}
      <div
        className={`absolute inset-0 transition-colors duration-700 ease-in-out ${
          isDark ? 'bg-[#080D24]' : 'bg-[#E0F2FE]'
        }`}
      />

      {/* ── Dark Mode Live Background Layer ── */}
      <div
        className="absolute inset-0 w-full h-full transition-opacity duration-600 ease-in-out will-change-[opacity]"
        style={{
          opacity: isDark ? 1 : 0,
        }}
      >
        <MemoizedDualVideoPlayer
          src="/assets/backgrounds/dna-dark.mp4"
          isActive={isDark}
        />
        {/* Dark Mode Ambient Overlay (Deep cosmic slate-indigo depth overlay for high-contrast glass cards) */}
        <div
          className="absolute inset-0 bg-[#080D24]/70 backdrop-blur-[3px] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at center, rgba(8, 13, 36, 0.65) 0%, rgba(8, 13, 36, 0.92) 95%)',
          }}
        />
      </div>

      {/* ── Light Mode Live Background Layer ── */}
      <div
        className="absolute inset-0 w-full h-full transition-opacity duration-600 ease-in-out will-change-[opacity]"
        style={{
          opacity: !isDark ? 1 : 0,
        }}
      >
        <MemoizedDualVideoPlayer
          src="/assets/backgrounds/dna-light.mp4"
          isActive={!isDark}
          filter="contrast(1.15) brightness(0.96) saturate(1.15)"
        />
        {/* Light Mode Ambient Overlay: Ultra-Clear Clinical Sky-Blue (0.22 alpha for vivid 3D DNA rotation) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'rgba(224, 242, 254, 0.22)',
          }}
        />
      </div>
    </div>
  );
}

export default memo(SeamlessVideoBackground);
