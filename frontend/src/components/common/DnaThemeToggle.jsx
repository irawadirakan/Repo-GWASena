import React, { useEffect, useRef, useState } from 'react';
import { useThemeStore } from '../../store/useThemeStore.js';

const THEME_KEY = 'gwasena_theme';

export default function DnaThemeToggle({
  externalTheme,
  onToggleTheme,
  theme,
  onToggle,
}) {
  const storeTheme = useThemeStore((s) => s.theme);

  const controlledTheme = externalTheme !== undefined ? externalTheme : theme;
  const controlledToggle = onToggleTheme || onToggle;

  const svgRef = useRef(null);
  const swingRef = useRef(null);
  const helixRef = useRef(null);
  const handleRef = useRef(null);
  const ballRef = useRef(null);
  const ringRef = useRef(null);
  const iconsRef = useRef(null);
  const stringRef = useRef(null);
  const spinBoostRef = useRef(0);

  const [isDark, setIsDark] = useState(() => {
    if (controlledTheme !== undefined) return controlledTheme === 'dark';
    try {
      const saved = localStorage.getItem(THEME_KEY) || localStorage.getItem('theme');
      if (saved) return saved === 'dark';
    } catch {
      // ignore storage access errors
    }
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (root.getAttribute('data-theme')) {
        return root.getAttribute('data-theme') === 'dark';
      }
      if (root.classList.contains('dark')) return true;
      if (root.classList.contains('light')) return false;
    }
    if (storeTheme) return storeTheme === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
  });

  // Sinkronisasi tema ke DOM (`data-theme` + `.dark`/`.light`) & `localStorage`
  const applyThemeToDom = (dark) => {
    if (typeof document === 'undefined') return;
    const mode = dark ? 'dark' : 'light';
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.classList.toggle('dark', dark);
    root.classList.toggle('light', !dark);
    try {
      localStorage.setItem(THEME_KEY, mode);
      localStorage.setItem('theme', mode);
    } catch {
      // ignore storage access errors
    }
  };

  useEffect(() => {
    if (controlledTheme !== undefined) {
      const dark = controlledTheme === 'dark';
      setIsDark(dark);
      applyThemeToDom(dark);
    } else {
      applyThemeToDom(isDark);
      const mode = isDark ? 'dark' : 'light';
      if (useThemeStore.getState().theme !== mode) {
        useThemeStore.setState({ theme: mode });
      }
    }
  }, [controlledTheme, isDark]);

  const triggerToggle = () => {
    spinBoostRef.current = 0.45;
    if (controlledToggle) {
      controlledToggle();
    } else {
      setIsDark((prev) => !prev);
    }
  };

  // Simpan referensi fungsi terbaru agar event listener di dalam useEffect selalu memanggil state terbaru
  const toggleCallbackRef = useRef(triggerToggle);
  useEffect(() => {
    toggleCallbackRef.current = triggerToggle;
  });

  useEffect(() => {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = svgRef.current;
    const swing = swingRef.current;
    const helix = helixRef.current;
    const handle = handleRef.current;
    const ball = ballRef.current;
    const ring = ringRef.current;
    const icons = iconsRef.current;
    const strg = stringRef.current;

    if (!svg || !swing || !helix || !handle || !ball || !ring || !icons || !strg) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    // Bersihkan isi grup helix sebelum membuat elemen SVG
    helix.innerHTML = '';

    const CX = 32;
    const Y0 = 6;
    const Y1 = 46;
    const AMP = 11;
    const K = 0.31;
    const RUNG_STEP = 5;
    const SAMPLES = 32;

    const mk = (tag, cls) => {
      const e = document.createElementNS(NS, tag);
      e.setAttribute('class', cls);
      helix.appendChild(e);
      return e;
    };

    const rungCount = Math.floor((Y1 - Y0) / RUNG_STEP) + 1;
    const rungs = Array.from({ length: rungCount }, () => mk('line', 'dna-rung'));
    const pathA = mk('path', 'dna-strand a');
    const pathB = mk('path', 'dna-strand b');
    const nodesA = Array.from({ length: rungCount }, () => mk('circle', 'dna-node a'));
    const nodesB = Array.from({ length: rungCount }, () => mk('circle', 'dna-node b'));

    let t = 0;

    function drawHelix() {
      let dA = '';
      let dB = '';
      for (let i = 0; i <= SAMPLES; i++) {
        const y = Y0 + ((Y1 - Y0) * i) / SAMPLES;
        const s = Math.sin((y - Y0) * K + t) * AMP;
        const xA = (CX + s).toFixed(1);
        const xB = (CX - s).toFixed(1);
        const yFixed = y.toFixed(1);
        dA += (i ? ' L' : 'M') + xA + ' ' + yFixed;
        dB += (i ? ' L' : 'M') + xB + ' ' + yFixed;
      }
      pathA.setAttribute('d', dA);
      pathB.setAttribute('d', dB);

      for (let i = 0; i < rungCount; i++) {
        const y = Y0 + i * RUNG_STEP;
        const ph = (y - Y0) * K + t;
        const sinVal = Math.sin(ph);
        const cosVal = Math.cos(ph);
        const x1 = (CX + sinVal * AMP).toFixed(1);
        const x2 = (CX - sinVal * AMP).toFixed(1);

        rungs[i].setAttribute('x1', x1);
        rungs[i].setAttribute('x2', x2);
        rungs[i].setAttribute('y1', String(y));
        rungs[i].setAttribute('y2', String(y));

        nodesA[i].setAttribute('cx', x1);
        nodesA[i].setAttribute('cy', String(y));
        nodesA[i].setAttribute('r', (2.3 + 1.1 * cosVal).toFixed(2));
        nodesA[i].setAttribute('opacity', (0.7 + 0.3 * cosVal).toFixed(2));

        nodesB[i].setAttribute('cx', x2);
        nodesB[i].setAttribute('cy', String(y));
        nodesB[i].setAttribute('r', (2.3 - 1.1 * cosVal).toFixed(2));
        nodesB[i].setAttribute('opacity', (0.7 - 0.3 * cosVal).toFixed(2));
      }
    }

    // Fisika Tarik Tali
    const ANCHOR = { x: 32, y: 48 };
    const REST = { x: 32, y: 76 };
    const PIVOT = { x: 32, y: 0 };
    const PULL_THRESHOLD = 14;
    const MAX_PULL = 36;
    const CLICK_SLOP = 5;

    let b = { x: REST.x, y: REST.y };
    let bv = { x: 0, y: 0 };
    let theta = 0;
    let omega = 0;
    let dragging = false;
    let startPt = null;
    let moved = 0;
    let animFrameId = null;
    let lastTime = performance.now();
    let handledByPointerUp = false;
    let clickResetTimer = null;

    function pointerToLocal(e) {
      let p = null;
      if (typeof svg.createSVGPoint === 'function' && typeof svg.getScreenCTM === 'function') {
        const ctm = svg.getScreenCTM();
        if (ctm) {
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          p = pt.matrixTransform(ctm.inverse());
        }
      }
      if (!p) {
        const rect = svg.getBoundingClientRect?.();
        if (rect && rect.width && rect.height) {
          p = {
            x: ((e.clientX - rect.left) / rect.width) * 64,
            y: ((e.clientY - rect.top) / rect.height) * 110,
          };
        } else {
          // Fallback aman untuk lingkungan headless tanpa layout box
          p = {
            x: REST.x + (startPt ? e.clientX - startPt.x : 0),
            y: REST.y + (startPt ? e.clientY - startPt.y : 0),
          };
        }
      }
      const r = (-theta * Math.PI) / 180;
      const dx = p.x - PIVOT.x;
      const dy = p.y - PIVOT.y;
      return {
        x: PIVOT.x + dx * Math.cos(r) - dy * Math.sin(r),
        y: PIVOT.y + dx * Math.sin(r) + dy * Math.cos(r),
      };
    }

    const onPointerDown = (e) => {
      dragging = true;
      moved = 0;
      startPt = { x: e.clientX ?? 0, y: e.clientY ?? 0 };
      handle.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      const cx = e.clientX ?? 0;
      const cy = e.clientY ?? 0;
      moved = Math.max(moved, Math.hypot(cx - startPt.x, cy - startPt.y));
      const p = pointerToLocal({ clientX: cx, clientY: cy });
      let dx = p.x - ANCHOR.x;
      let dy = p.y - ANCHOR.y;
      const maxLen = REST.y - ANCHOR.y + MAX_PULL;
      const len = Math.hypot(dx, dy);
      if (len > maxLen && len > 0) {
        dx *= maxLen / len;
        dy *= maxLen / len;
      }
      b.x = ANCHOR.x + dx;
      b.y = Math.max(ANCHOR.y + 12, ANCHOR.y + dy);
      bv.x = 0;
      bv.y = 0;
    };

    const onRelease = () => {
      if (!dragging) return;
      dragging = false;
      handledByPointerUp = true;
      if (clickResetTimer) clearTimeout(clickResetTimer);
      clickResetTimer = setTimeout(() => {
        handledByPointerUp = false;
      }, 0);

      const pulled = b.y - REST.y;
      if (moved < CLICK_SLOP) {
        toggleCallbackRef.current();
        bv.y = 5;
        omega += 2.5;
      } else {
        if (pulled > PULL_THRESHOLD) toggleCallbackRef.current();
        omega += Math.min(Math.max(pulled, 0), MAX_PULL) * 0.07 + (b.x - REST.x) * 0.05;
      }
    };

    const onClick = () => {
      if (handledByPointerUp) {
        handledByPointerUp = false;
        return;
      }
      toggleCallbackRef.current();
      bv.y = 5;
      omega += 2.5;
    };

    const onKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleCallbackRef.current();
        bv.y = 5;
        omega += 2.5;
      }
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onRelease);
    handle.addEventListener('pointercancel', onRelease);
    handle.addEventListener('click', onClick);
    handle.addEventListener('keydown', onKeyDown);

    // Loop Animasi Menggunakan Delta Time
    function frame(now) {
      const timestamp = Number.isFinite(now) ? now : performance.now();
      const dt = Math.min(Math.max((timestamp - lastTime) / 1000, 0), 0.1); // Batasi maks 100ms untuk cegah lonjakan
      lastTime = timestamp;

      if (!dragging) {
        bv.x = (bv.x + (REST.x - b.x) * 0.12) * 0.86;
        bv.y = (bv.y + (REST.y - b.y) * 0.12) * 0.86;
        b.x += bv.x;
        b.y += bv.y;
      }

      const target = dragging ? (b.x - REST.x) * 0.5 : 0;
      omega += (target - theta) * 0.035;
      omega *= dragging ? 0.8 : 0.965;
      theta += omega;

      spinBoostRef.current *= Math.pow(0.92, dt * 60);

      if (!reduceMotion) {
        // Kecepatan putar berbasis waktu riil (smooth di semua refresh rate)
        t += (0.9 + spinBoostRef.current * 18) * dt;
      } else {
        theta = 0;
        omega = 0;
      }

      swing.setAttribute('transform', `rotate(${theta.toFixed(2)} ${PIVOT.x} ${PIVOT.y})`);
      strg.setAttribute('x2', b.x.toFixed(1));
      strg.setAttribute('y2', b.y.toFixed(1));
      ball.setAttribute('cx', b.x.toFixed(1));
      ball.setAttribute('cy', b.y.toFixed(1));
      ring.setAttribute('cx', b.x.toFixed(1));
      ring.setAttribute('cy', b.y.toFixed(1));
      icons.setAttribute('transform', `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) scale(.62)`);

      drawHelix();
      animFrameId = requestAnimationFrame(frame);
    }

    animFrameId = requestAnimationFrame(frame);

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (clickResetTimer) clearTimeout(clickResetTimer);
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onRelease);
      handle.removeEventListener('pointercancel', onRelease);
      handle.removeEventListener('click', onClick);
      handle.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div className="dna-toggle" title="Tarik atau klik untuk ganti mode terang/gelap">
      <svg
        ref={svgRef}
        viewBox="0 0 64 110"
        aria-hidden="false"
        aria-label="Heliks DNA sebagai tombol mode terang dan gelap"
      >
        <g ref={swingRef}>
          <rect className="dna-cord" x="31" y="0" width="2" height="6" />
          <g ref={helixRef} className="dna-helix-group" />
          <line ref={stringRef} className="dna-string" x1="32" y1="48" x2="32" y2="76" />
          <g
            ref={handleRef}
            className="dna-handle"
            tabIndex={0}
            role="switch"
            aria-checked={isDark}
            aria-label="Ganti mode terang atau gelap. Tarik atau klik."
          >
            <title>Tarik atau klik untuk ganti mode terang/gelap</title>
            <circle ref={ringRef} className="dna-ring" r="17" cx="32" cy="76" />
            <circle ref={ballRef} className="dna-ball" r="10" cx="32" cy="76" />
            <g ref={iconsRef} transform="translate(32 76) scale(.62)">
              <path
                className="dna-ico dna-moon"
                strokeWidth="0"
                d="M4 -8 A9 9 0 1 0 8 4 A7 7 0 0 1 4 -8 Z"
              />
              <g className="dna-sun">
                <circle className="dna-ico" r="5" strokeWidth="0" />
                <path
                  className="dna-ico"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  d="M0 -10V-8M0 8V10M-10 0H-8M8 0H10M-7 -7L-5.6 -5.6M5.6 5.6L7 7M-7 7L-5.6 5.6M5.6 -5.6L7 -7"
                />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
