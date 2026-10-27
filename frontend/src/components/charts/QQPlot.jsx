import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { useThemeStore } from '../../store/useThemeStore.js';

/**
 * QQPlot - Visualisasi Quantile-Quantile (Expected vs Observed -log10 P)
 * Acuan: docs/gwasena-v2/DESIGN.md Bagian 7 & WIREFRAME.md Layar S-07
 */
export default function QQPlot({ qqData = [], lambdaGc = 1.024 }) {
  const containerRef = useRef(null);
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    if (!containerRef.current || !qqData || qqData.length === 0) return;

    const isDark = theme === 'dark';

    const xVals = qqData.map((d) => d.expected);
    const yVals = qqData.map((d) => d.observed);
    const maxVal = Math.ceil(Math.max(...xVals, ...yVals, 4));

    // Trace 1: Observasi Titik SNP
    const traceObserved = {
      x: xVals,
      y: yVals,
      mode: 'markers',
      type: 'scattergl',
      name: 'Observasi SNP',
      hoverinfo: 'text',
      text: qqData.map(
        (d) =>
          `Expected -log₁₀(P): ${d.expected.toFixed(2)}<br>` +
          `Observed -log₁₀(P): ${d.observed.toFixed(2)}`
      ),
      marker: {
        size: 5,
        color: isDark ? '#38BDF8' : '#2563EB', // Royal Blue
        opacity: 0.8,
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
      margin: { l: 56, r: 24, t: 36, b: 50 },
      paper_bgcolor: isDark ? '#0F172A' : '#FFFFFF',
      plot_bgcolor: isDark ? '#070B14' : '#F8FAFC',
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0.5,
        xanchor: 'center',
        y: 1.14,
        font: {
          family: 'Source Sans 3, Source Sans Pro, sans-serif',
          size: 11,
          color: isDark ? '#94A3B8' : '#1E293B',
        },
      },
      xaxis: {
        title: {
          text: 'Expected -log₁₀(p-value)',
          font: {
            family: 'Source Sans 3, Source Sans Pro, sans-serif',
            size: 12,
            color: isDark ? '#94A3B8' : '#1E293B',
          },
        },
        range: [0, maxVal],
        tickfont: {
          family: 'JetBrains Mono, monospace',
          size: 11,
          color: isDark ? '#E2E8F0' : '#1E293B',
        },
        showgrid: true,
        gridcolor: isDark ? '#1E293B' : '#E2E8F0',
        linecolor: isDark ? '#334155' : '#94A3B8',
        zeroline: false,
      },
      yaxis: {
        title: {
          text: 'Observed -log₁₀(p-value)',
          font: {
            family: 'Source Sans 3, Source Sans Pro, sans-serif',
            size: 12,
            color: isDark ? '#94A3B8' : '#1E293B',
          },
        },
        range: [0, maxVal],
        tickfont: {
          family: 'JetBrains Mono, monospace',
          size: 11,
          color: isDark ? '#E2E8F0' : '#1E293B',
        },
        showgrid: true,
        gridcolor: isDark ? '#1E293B' : '#E2E8F0',
        linecolor: isDark ? '#334155' : '#94A3B8',
        zeroline: false,
      },
      annotations: [
        {
          xref: 'paper',
          yref: 'paper',
          x: 0.05,
          y: 0.95,
          text: `<b>λ_GC = ${lambdaGc.toFixed(3)}</b><br><span style="font-size:10px;color:${isDark ? '#94A3B8' : '#475569'}">Terkontrol Baik (&lt; 1.05)</span>`,
          showarrow: false,
          align: 'left',
          bgcolor: isDark ? 'rgba(30, 41, 59, 0.85)' : '#FFFFFF',
          bordercolor: isDark ? '#334155' : '#CBD5E1',
          borderwidth: 1,
          borderpad: 6,
          font: {
            family: 'Source Sans 3, Source Sans Pro, sans-serif',
            size: 12,
            color: isDark ? '#F8FAFC' : '#0F172A',
          },
        },
      ],
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: 'gwasena_qq_plot',
        height: 500,
        width: 600,
        scale: 2,
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
    <div className="w-full overflow-hidden rounded-2xl figma-card p-2 sm:p-4">
      <div ref={containerRef} className="h-[380px] w-full" />
    </div>
  );
}
