import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { useThemeStore } from '../../store/useThemeStore.js';

/**
 * QQPlot - Visualisasi Quantile-Quantile (Expected vs Observed -log10 P)
 * Evaluasi inflasi genomik (lambda GC) terhadap distribusi teoretis (null hypothesis).
 * Dilengkapi Custom HTML Legend Pills bar di luar SVG untuk menjamin 100% bebas clipping.
 */
export default function QQPlot({ qqData = [], lambdaGc = 1.024 }) {
  const containerRef = useRef(null);
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    if (!containerRef.current || !qqData || qqData.length === 0) return;

    const isDark = theme === 'dark';

    const xVals = qqData.map((d) => d.expected);
    const yVals = qqData.map((d) => d.observed);
    const maxVal = Math.ceil(Math.max(...xVals, ...yVals, 4.5));

    // Trace 1: Observasi Titik SNP
    const traceObserved = {
      x: xVals,
      y: yVals,
      mode: 'markers',
      type: 'scattergl',
      name: 'Observasi SNP (-log₁₀ P)',
      hoverinfo: 'text',
      text: qqData.map(
        (d) =>
          `Expected -log₁₀(P): ${d.expected.toFixed(2)}<br>` +
          `Observed -log₁₀(P): ${d.observed.toFixed(2)}`
      ),
      marker: {
        size: 5.5,
        color: isDark ? '#38BDF8' : '#2563EB', // Royal Blue di Light Mode
        opacity: 0.85,
      },
    };

    // Trace 2: Garis Referensi Diagonal Null Hypothesis (y = x)
    const traceRefLine = {
      x: [0, maxVal],
      y: [0, maxVal],
      mode: 'lines',
      type: 'scatter',
      name: 'Garis Ekspektasi Teoritis (y = x)',
      line: {
        color: isDark ? '#F59E0B' : '#D97706', // Amber
        width: 2,
        dash: 'dash',
      },
      hoverinfo: 'none',
    };

    const layout = {
      autosize: true,
      margin: { l: 65, r: 30, t: 30, b: 60 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: isDark ? 'rgba(7, 11, 20, 0.65)' : 'rgba(248, 250, 252, 0.65)',
      showlegend: false, // Gunakan Custom HTML Legend di luar canvas
      xaxis: {
        title: {
          text: 'Expected -log₁₀(p-value)',
          font: {
            family: 'Source Sans 3, Source Sans Pro, sans-serif',
            size: 12,
            color: isDark ? '#94A3B8' : '#334155',
          },
          standoff: 14,
        },
        range: [0, maxVal],
        tickfont: {
          family: 'JetBrains Mono, monospace',
          size: 11,
          color: isDark ? '#E2E8F0' : '#1E293B',
        },
        showgrid: true,
        gridcolor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)',
        linecolor: isDark ? '#334155' : '#94A3B8',
        zeroline: false,
      },
      yaxis: {
        title: {
          text: 'Observed -log₁₀(p-value)',
          font: {
            family: 'Source Sans 3, Source Sans Pro, sans-serif',
            size: 12,
            color: isDark ? '#94A3B8' : '#334155',
          },
          standoff: 10,
        },
        range: [0, maxVal],
        tickfont: {
          family: 'JetBrains Mono, monospace',
          size: 11,
          color: isDark ? '#E2E8F0' : '#1E293B',
        },
        showgrid: true,
        gridcolor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)',
        linecolor: isDark ? '#334155' : '#94A3B8',
        zeroline: false,
      },
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      scrollZoom: true,
      doubleClick: 'reset+autosize',
      modeBarButtonsToRemove: ['lasso2d', 'select2d', 'sendDataToCloud', 'toggleSpikelines'],
      toImageButtonOptions: {
        format: 'png',
        filename: 'gwasena_qq_plot_hd',
        height: 1080,
        width: 1920,
        scale: 3,
      },
    };

    Plotly.react(containerRef.current, [traceObserved, traceRefLine], layout, config);

    const handleResize = () => {
      if (containerRef.current) {
        Plotly.Plots.resize(containerRef.current);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [qqData, lambdaGc, theme]);

  return (
    <div className="w-full overflow-hidden rounded-3xl figma-card p-3.5 sm:p-5">
      {/* ── Custom HTML/Tailwind Legend Pills Bar (100% Bebas Clipping) ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3.5 border-b border-slate-200/80 dark:border-white/10 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Badge Observasi SNP */}
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-blue-50/90 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-300/80 dark:border-blue-600/40 shadow-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB] dark:bg-[#38BDF8]" />
            <span className="font-semibold">Observasi SNP (-log₁₀ P)</span>
          </div>

          {/* Badge Garis Ekspektasi Teoritis */}
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300/80 dark:border-amber-600/40 shadow-xs">
            <span className="w-3.5 border-t-2 border-dashed border-[#D97706] dark:border-[#F59E0B]" />
            <span className="font-semibold">Garis Ekspektasi Teoritis (y = x)</span>
          </div>
        </div>

        {/* Badge Metrik Inflasi Genomik λ_GC */}
        <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold bg-slate-100/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 shadow-xs">
          <span className="font-mono font-bold text-slate-900 dark:text-white">
            λ_GC = {Number(lambdaGc).toFixed(3)}
          </span>
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">
            (Terkontrol Baik &lt; 1.05)
          </span>
        </div>
      </div>

      <div ref={containerRef} className="h-[430px] w-full" />
    </div>
  );
}
