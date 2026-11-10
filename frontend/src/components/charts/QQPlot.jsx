import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { useThemeStore } from '../../store/useThemeStore.js';

/**
 * QQPlot - Visualisasi Quantile-Quantile (Expected vs Observed -log10 P)
 * Evaluasi inflasi genomik (lambda GC) terhadap distribusi teoretis (null hypothesis).
 * Mendukung zoom lock (uirevision + relayout preservation) dan Custom HTML Legend Pills.
 */
export default function QQPlot({ analysisId = 'default', qqData = [], lambdaGc = 1.024 }) {
  const containerRef = useRef(null);
  const zoomRangeRef = useRef({ xaxis: null, yaxis: null });
  const prevDatasetKeyRef = useRef('');
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    if (!containerRef.current || !qqData || qqData.length === 0) return;

    const datasetKey = `${analysisId || 'default'}:${qqData.length}`;
    if (prevDatasetKeyRef.current !== datasetKey) {
      zoomRangeRef.current = { xaxis: null, yaxis: null };
      prevDatasetKeyRef.current = datasetKey;
    }

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

    const savedXRange = zoomRangeRef.current.xaxis;
    const savedYRange = zoomRangeRef.current.yaxis;

    const layout = {
      autosize: true,
      uirevision: `qq-zoom-lock-${analysisId || 'default'}`,
      margin: { l: 65, r: 30, t: 30, b: 60 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: isDark ? 'rgba(7, 11, 20, 0.65)' : 'rgba(248, 250, 252, 0.65)',
      showlegend: false, // Gunakan Custom HTML Legend di luar canvas
      xaxis: {
        uirevision: true,
        range: savedXRange || [0, maxVal],
        ...(savedXRange ? { autorange: false } : {}),
        title: {
          text: 'Expected -log₁₀(p-value)',
          font: {
            family: 'Source Sans 3, Source Sans Pro, sans-serif',
            size: 12,
            color: isDark ? '#94A3B8' : '#334155',
          },
          standoff: 14,
        },
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
        uirevision: true,
        range: savedYRange || [0, maxVal],
        ...(savedYRange ? { autorange: false } : {}),
        title: {
          text: 'Observed -log₁₀(p-value)',
          font: {
            family: 'Source Sans 3, Source Sans Pro, sans-serif',
            size: 12,
            color: isDark ? '#94A3B8' : '#334155',
          },
          standoff: 10,
        },
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

    const container = containerRef.current;
    Plotly.react(container, [traceObserved, traceRefLine], layout, config);

    const handleRelayout = (ev) => {
      if (!ev || typeof ev !== 'object') return;
      if (ev['xaxis.autorange'] === true) {
        zoomRangeRef.current.xaxis = null;
      } else if (ev['xaxis.range[0]'] !== undefined && ev['xaxis.range[1]'] !== undefined) {
        zoomRangeRef.current.xaxis = [ev['xaxis.range[0]'], ev['xaxis.range[1]']];
      } else if (Array.isArray(ev['xaxis.range']) && ev['xaxis.range'].length === 2) {
        zoomRangeRef.current.xaxis = [...ev['xaxis.range']];
      }

      if (ev['yaxis.autorange'] === true) {
        zoomRangeRef.current.yaxis = null;
      } else if (ev['yaxis.range[0]'] !== undefined && ev['yaxis.range[1]'] !== undefined) {
        zoomRangeRef.current.yaxis = [ev['yaxis.range[0]'], ev['yaxis.range[1]']];
      } else if (Array.isArray(ev['yaxis.range']) && ev['yaxis.range'].length === 2) {
        zoomRangeRef.current.yaxis = [...ev['yaxis.range']];
      }
    };

    if (typeof container.on === 'function') {
      container.on('plotly_relayout', handleRelayout);
    }

    const handleResize = () => {
      if (containerRef.current) {
        Plotly.Plots.resize(containerRef.current);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (container && typeof container.removeAllListeners === 'function') {
        container.removeAllListeners('plotly_relayout');
      }
    };
  }, [analysisId, qqData, lambdaGc, theme]);

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
            λ_GC = {lambdaGc !== null && lambdaGc !== undefined && !isNaN(Number(lambdaGc)) ? Number(lambdaGc).toFixed(3) : '-'}
          </span>
          {lambdaGc !== null && lambdaGc !== undefined && !isNaN(Number(lambdaGc)) && (
            <span className={`text-xs font-bold ${Number(lambdaGc) <= 1.05 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {Number(lambdaGc) <= 1.05 ? '(Terkontrol Baik < 1.05)' : '(Inflasi Moderat)'}
            </span>
          )}
        </div>
      </div>

      <div ref={containerRef} className="h-[430px] w-full" />
    </div>
  );
}
