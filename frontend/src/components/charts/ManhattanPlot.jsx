import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { useThemeStore } from '../../store/useThemeStore.js';

function normalizeChrKey(chr) {
  return String(chr ?? '1').replace(/^chr/i, '').trim() || '1';
}

function compareChroms(a, b) {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  if (!isNaN(na)) return -1;
  if (!isNaN(nb)) return 1;
  return a.localeCompare(b);
}

/**
 * ManhattanPlot - Visualisasi Interaktif GWAS Manhattan Plot
 * WebGL (scattergl) dengan pewarnaan bergantian antar-kromosom,
 * penguncian posisi zoom (uirevision + relayout preservation) saat klik SNP,
 * dan Custom HTML Legend Pills bar di luar SVG untuk menjamin 100% bebas clipping.
 */
export default function ManhattanPlot({
  analysisId = 'default',
  snps = [],
  threshold = 3.98, // -log10(p) cutoff
  onSelectSnp,
  selectedSnpId = null,
}) {
  const containerRef = useRef(null);
  const zoomRangeRef = useRef({ xaxis: null, yaxis: null });
  const prevDatasetKeyRef = useRef('');
  const onSelectSnpRef = useRef(onSelectSnp);
  onSelectSnpRef.current = onSelectSnp;

  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    if (!containerRef.current || !snps || snps.length === 0) return;

    const datasetKey = `${analysisId || 'default'}:${snps.length}:${snps[0]?.snp_id || ''}`;
    if (prevDatasetKeyRef.current !== datasetKey) {
      zoomRangeRef.current = { xaxis: null, yaxis: null };
      prevDatasetKeyRef.current = datasetKey;
    }

    const isDark = theme === 'dark';

    // Warna kromosom bergantian sesuai spesifikasi ilmiah kontras tinggi
    const colorOdd = isDark ? '#818CF8' : '#4F46E5';   // Indigo
    const colorEven = isDark ? '#38BDF8' : '#0EA5E9';  // Cyan / Sky
    const colorSignificant = isDark ? '#34D399' : '#10B981'; // Emerald
    const colorSelected = '#F43F5E'; // Rose-500

    const defaultChrLengths = {
      '1': 180000000,
      '2': 175000000,
      '3': 190000000,
      '4': 165000000,
      '5': 170000000,
      '6': 160000000,
      '7': 155000000,
      '8': 150000000,
    };

    const posByChr = {};
    snps.forEach((snp) => {
      const ck = normalizeChrKey(snp.chromosome);
      const p = Number(snp.position) || 0;
      if (!posByChr[ck] || p > posByChr[ck]) {
        posByChr[ck] = p;
      }
    });

    const chromList = Object.keys(posByChr).sort(compareChroms);
    const chrOffsets = {};
    const chrIndex = {};
    const tickVals = [];
    const tickText = [];
    let runningOffset = 0;

    chromList.forEach((ck, idx) => {
      chrOffsets[ck] = runningOffset;
      chrIndex[ck] = idx;
      const span = Math.max(posByChr[ck] || 0, defaultChrLengths[ck] || 10000000);
      tickVals.push(runningOffset + span / 2);
      tickText.push(chromList.length > 12 ? ck : `Chr ${ck}`);
      runningOffset += span;
    });

    // Pisahkan SNP ke dalam traces
    const xNonSig = [];
    const yNonSig = [];
    const textNonSig = [];
    const colorNonSig = [];
    const snpRefNonSig = [];

    const xSig = [];
    const ySig = [];
    const textSig = [];
    const snpRefSig = [];

    const xSel = [];
    const ySel = [];
    const textSel = [];
    const snpRefSel = [];

    snps.forEach((snp) => {
      const ck = normalizeChrKey(snp.chromosome);
      const offset = chrOffsets[ck] || 0;
      const cIdx = chrIndex[ck] ?? 0;
      const cumPos = offset + Number(snp.position);
      const pVal = snp.p_value;
      const negLogP = snp.neg_log10_p ?? snp.neglog10p ?? (pVal > 0 ? -Math.log10(pVal) : 0);
      const isSelected = selectedSnpId && snp.snp_id === selectedSnpId;
      const pDisplay =
        pVal !== null && pVal !== undefined && !isNaN(Number(pVal))
          ? Number(pVal) < 0.0001
            ? Number(pVal).toExponential(3)
            : Number(pVal).toFixed(5)
          : '-';
      const betaRaw = snp.beta ?? snp.effect_size;
      const betaDisplay =
        betaRaw !== null && betaRaw !== undefined && !isNaN(Number(betaRaw))
          ? `${Number(betaRaw) >= 0 ? '+' : ''}${Number(Number(betaRaw).toFixed(4))}`
          : '-';

      const tooltipText =
        `<b>${snp.snp_id}</b><br>` +
        `Kromosom: ${ck}<br>` +
        `Posisi: ${Number(snp.position).toLocaleString('id-ID')} bp<br>` +
        `p-value: ${pDisplay}<br>` +
        `-log10(p): ${Number(negLogP).toFixed(2)}<br>` +
        `Effect Size (Beta): ${betaDisplay}`;

      if (isSelected) {
        xSel.push(cumPos);
        ySel.push(negLogP);
        textSel.push(tooltipText);
        snpRefSel.push(snp);
      }

      if (snp.is_significant || negLogP >= threshold) {
        xSig.push(cumPos);
        ySig.push(negLogP);
        textSig.push(tooltipText);
        snpRefSig.push(snp);
      } else {
        xNonSig.push(cumPos);
        yNonSig.push(negLogP);
        textNonSig.push(tooltipText);
        colorNonSig.push(cIdx % 2 === 0 ? colorOdd : colorEven);
        snpRefNonSig.push(snp);
      }
    });

    const traces = [
      // Trace 0: SNP Teruji (Non-Signifikan)
      {
        x: xNonSig,
        y: yNonSig,
        text: textNonSig,
        hoverinfo: 'text',
        mode: 'markers',
        type: 'scattergl',
        name: 'SNP Teruji (Non-Signifikan)',
        marker: {
          size: 5.5,
          color: colorNonSig,
          opacity: 0.85,
        },
      },
      // Trace 1: SNP Signifikan (Lolos Ambang)
      {
        x: xSig,
        y: ySig,
        text: textSig,
        hoverinfo: 'text',
        mode: 'markers',
        type: 'scattergl',
        name: 'SNP Signifikan (Lolos Ambang)',
        marker: {
          size: 8.5,
          color: colorSignificant,
          symbol: 'diamond',
          line: {
            color: isDark ? '#FFFFFF' : '#0F172A',
            width: 1.25,
          },
        },
      },
    ];

    // Trace 2: SNP Terpilih (jika ada)
    if (xSel.length > 0) {
      traces.push({
        x: xSel,
        y: ySel,
        text: textSel,
        hoverinfo: 'text',
        mode: 'markers',
        type: 'scattergl',
        name: 'SNP Terpilih',
        marker: {
          size: 11,
          color: colorSelected,
          line: {
            color: '#FFFFFF',
            width: 2,
          },
        },
      });
    }

    // Batas Sumbu Y otomatis dengan padding atas proporsional
    const maxNegLogP = Math.max(0, ...snps.map((s) => s.neg_log10_p ?? (-Math.log10(s.p_value) || 0)));
    const yUpper = Math.max(maxNegLogP + 1.2, threshold + 1.0, 5.0);

    const savedXRange = zoomRangeRef.current.xaxis;
    const savedYRange = zoomRangeRef.current.yaxis;

    const layout = {
      autosize: true,
      // Pertahankan posisi zoom saat selectedSnp berubah (uirevision konstan)
      uirevision: `manhattan-zoom-lock-${analysisId || 'default'}`,
      margin: { l: 65, r: 30, t: 30, b: 60 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: isDark ? 'rgba(7, 11, 20, 0.65)' : 'rgba(248, 250, 252, 0.65)',
      showlegend: false,
      xaxis: {
        uirevision: true,
        ...(savedXRange ? { range: savedXRange, autorange: false } : {}),
        title: {
          text: 'Kromosom Genom (Chromosome)',
          font: {
            family: 'Source Sans 3, Source Sans Pro, sans-serif',
            size: 12,
            color: isDark ? '#94A3B8' : '#334155',
          },
          standoff: 14,
        },
        tickvals: tickVals,
        ticktext: tickText,
        tickfont: {
          family: 'Source Sans 3, Source Sans Pro, sans-serif',
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
        range: savedYRange || [0, yUpper],
        ...(savedYRange ? { autorange: false } : {}),
        title: {
          text: '-log₁₀(p-value)',
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
      // Garis Ambang Signifikansi (Threshold Line)
      shapes: [
        {
          type: 'line',
          xref: 'paper',
          x0: 0,
          x1: 1,
          yref: 'y',
          y0: threshold,
          y1: threshold,
          line: {
            color: isDark ? '#06B6D4' : '#0891B2',
            width: 1.75,
            dash: 'dash',
          },
        },
      ],
      annotations: [
        {
          xref: 'paper',
          x: 0.99,
          yref: 'y',
          y: threshold,
          text: `Ambang Batas (-log₁₀P = ${threshold.toFixed(2)})`,
          showarrow: false,
          xanchor: 'right',
          yanchor: 'bottom',
          font: {
            family: 'Source Sans 3, Source Sans Pro, sans-serif',
            size: 10.5,
            color: isDark ? '#06B6D4' : '#0891B2',
          },
        },
      ],
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
        filename: 'gwasena_manhattan_plot_hd',
        height: 1080,
        width: 1920,
        scale: 3,
      },
    };

    const container = containerRef.current;
    Plotly.react(container, traces, layout, config);

    // Event Listener Klik Titik
    const handlePlotClick = (data) => {
      if (!data || !data.points || data.points.length === 0) return;
      const pt = data.points[0];
      const curveNumber = pt.curveNumber;
      const pointNumber = pt.pointNumber;

      let clickedSnp = null;
      if (curveNumber === 0) {
        clickedSnp = snpRefNonSig[pointNumber];
      } else if (curveNumber === 1) {
        clickedSnp = snpRefSig[pointNumber];
      } else if (curveNumber === 2) {
        clickedSnp = snpRefSel[pointNumber];
      }

      if (clickedSnp && onSelectSnpRef.current) {
        onSelectSnpRef.current(clickedSnp);
      }
    };

    // Simpan rentang zoom terakhir agar tidak pernah tereset saat re-render / klik SNP
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
      container.on('plotly_click', handlePlotClick);
      container.on('plotly_relayout', handleRelayout);
    }

    // Handle Window Resize
    const handleResize = () => {
      if (containerRef.current) {
        Plotly.Plots.resize(containerRef.current);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (container && typeof container.removeAllListeners === 'function') {
        container.removeAllListeners('plotly_click');
        container.removeAllListeners('plotly_relayout');
      }
    };
  }, [analysisId, snps, threshold, theme, selectedSnpId]);

  const sigCount = snps.filter((s) => s.is_significant || (s.neg_log10_p ?? -Math.log10(s.p_value)) >= threshold).length;

  return (
    <div className="w-full overflow-hidden rounded-3xl figma-card p-3.5 sm:p-5">
      {/* ── Custom HTML/Tailwind Legend Pills Bar (100% Bebas Clipping) ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3.5 border-b border-slate-200/80 dark:border-white/10 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Badge SNP Teruji (Non-Signifikan) */}
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700/60 shadow-xs">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#4F46E5] dark:bg-[#818CF8]" title="Kromosom Ganjil" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#0EA5E9] dark:bg-[#38BDF8]" title="Kromosom Genap" />
            </span>
            <span className="font-semibold">SNP Teruji (Non-Signifikan)</span>
          </div>

          {/* Badge SNP Signifikan (Lolos Ambang) */}
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-600/40 shadow-xs">
            <span className="inline-block w-2.5 h-2.5 rotate-45 bg-[#10B981] dark:bg-[#34D399]" />
            <span className="font-semibold">SNP Signifikan (Lolos Ambang)</span>
            <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-emerald-200/80 dark:bg-emerald-800/60 px-2 py-0.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
              {sigCount}
            </span>
          </div>

          {/* Badge Ambang Batas Signifikansi */}
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-cyan-50/90 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-300 border border-cyan-300/80 dark:border-cyan-600/40 shadow-xs">
            <span className="w-3.5 border-t-2 border-dashed border-[#0891B2] dark:border-[#06B6D4]" />
            <span className="font-semibold">Ambang Signifikansi (-log₁₀P = {threshold.toFixed(2)})</span>
          </div>

          {/* Badge SNP Terpilih (jika ada) */}
          {selectedSnpId && (
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-rose-50/90 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300/80 dark:border-rose-600/40 shadow-xs animate-pop-in">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F43F5E]" />
              <span className="font-semibold">SNP Terpilih ({selectedSnpId})</span>
            </div>
          )}
        </div>

        <div className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
          Total Teruji: <span className="font-bold text-slate-900 dark:text-white">{snps.length}</span> SNP
        </div>
      </div>

      <div ref={containerRef} className="h-[430px] w-full" />
    </div>
  );
}
