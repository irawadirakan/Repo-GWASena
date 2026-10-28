import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { useThemeStore } from '../../store/useThemeStore.js';

/**
 * ManhattanPlot - Visualisasi Interaktif GWAS Manhattan Plot untuk Bawang Putih (8 Kromosom)
 * Acuan: docs/gwasena-v2/DESIGN.md Bagian 7 & AC-08.1, AC-08.2
 *
 * Menggunakan WebGL (scattergl) dengan pewarnaan bergantian antar-kromosom,
 * garis ambang signifikansi, dan penanganan klik titik SNP.
 */
export default function ManhattanPlot({
  snps = [],
  threshold = 3.98, // -log10(p) cutoff
  onSelectSnp,
  selectedSnpId = null,
}) {
  const containerRef = useRef(null);
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    if (!containerRef.current || !snps || snps.length === 0) return;

    const isDark = theme === 'dark';

    // Warna untuk Dark vs Light Mode sesuai spesifikasi kontras tinggi
    const colorEven = isDark ? '#38BDF8' : '#2563EB'; // Royal Blue di Light Mode
    const colorOdd = isDark ? '#818CF8' : '#4F46E5';  // Indigo di Light Mode
    const colorSignificant = isDark ? '#34D399' : '#059669'; // Emerald
    const colorSelected = '#F43F5E'; // Rose-500

    // Siapkan data per kromosom dengan offset posisi kumulatif pada sumbu X
    const chrLengths = {
      1: 180000000,
      2: 175000000,
      3: 190000000,
      4: 165000000,
      5: 170000000,
      6: 160000000,
      7: 155000000,
      8: 150000000,
    };

    const chrOffsets = {};
    let runningOffset = 0;
    const tickVals = [];
    const tickText = [];

    for (let c = 1; c <= 8; c++) {
      chrOffsets[c] = runningOffset;
      const cLength = chrLengths[c] || 160000000;
      tickVals.push(runningOffset + cLength / 2);
      tickText.push(`Chr ${c}`);
      runningOffset += cLength;
    }

    // Pisahkan SNP ke dalam traces:
    // Trace 1: Titik non-signifikan (warna bergantian)
    // Trace 2: Titik signifikan (emerald/highlight)
    // Trace 3: Titik terpilih (jika ada)

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

    snps.forEach((snp) => {
      const c = Number(snp.chromosome) || 1;
      const offset = chrOffsets[c] || 0;
      const cumPos = offset + Number(snp.position);
      const negLogP = snp.neg_log10_p ?? -Math.log10(snp.p_value);
      const isSelected = selectedSnpId && snp.snp_id === selectedSnpId;

      const tooltipText = `<b>${snp.snp_id}</b><br>` +
        `Kromosom: ${c}<br>` +
        `Posisi: ${Number(snp.position).toLocaleString('id-ID')} bp<br>` +
        `p-value: ${snp.p_value < 0.0001 ? Number(snp.p_value).toExponential(3) : Number(snp.p_value).toFixed(5)}<br>` +
        `-log10(p): ${negLogP.toFixed(2)}<br>` +
        `Effect Size (Beta): ${snp.effect_size >= 0 ? '+' : ''}${snp.effect_size}`;

      if (isSelected) {
        xSel.push(cumPos);
        ySel.push(negLogP);
        textSel.push(tooltipText);
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
        colorNonSig.push(c % 2 === 0 ? colorEven : colorOdd);
        snpRefNonSig.push(snp);
      }
    });

    const traces = [
      // Titik Standar
      {
        x: xNonSig,
        y: yNonSig,
        text: textNonSig,
        hoverinfo: 'text',
        mode: 'markers',
        type: 'scattergl',
        name: 'SNP Teruji',
        marker: {
          size: 5,
          color: colorNonSig,
          opacity: 0.85,
        },
      },
      // Titik Signifikan
      {
        x: xSig,
        y: ySig,
        text: textSig,
        hoverinfo: 'text',
        mode: 'markers',
        type: 'scattergl',
        name: 'Signifikan (Lolos Ambang)',
        marker: {
          size: 8,
          color: colorSignificant,
          symbol: 'diamond',
          line: {
            color: isDark ? '#FFFFFF' : '#0F172A',
            width: 1,
          },
        },
      },
    ];

    // Jika ada yang sedang dipilih secara aktif
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

    // Batas Sumbu Y
    const maxY = Math.max(threshold + 2, ...snps.map((s) => s.neg_log10_p || 0));

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
        y: 1.12,
        font: {
          family: 'Source Sans 3, Source Sans Pro, sans-serif',
          size: 11,
          color: isDark ? '#94A3B8' : '#1E293B',
        },
      },
      xaxis: {
        title: {
          text: 'Kromosom Bawang Putih (Allium sativum L.)',
          font: {
            family: 'Source Sans 3, Source Sans Pro, sans-serif',
            size: 12,
            color: isDark ? '#94A3B8' : '#1E293B',
          },
        },
        tickvals: tickVals,
        ticktext: tickText,
        tickfont: {
          family: 'Source Sans 3, Source Sans Pro, sans-serif',
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
          text: '-log₁₀(p-value)',
          font: {
            family: 'Source Sans 3, Source Sans Pro, sans-serif',
            size: 12,
            color: isDark ? '#94A3B8' : '#1E293B',
          },
        },
        range: [0, Math.ceil(maxY) + 0.5],
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
          text: `Ambang Signifikansi (-log₁₀P = ${threshold.toFixed(2)})`,
          showarrow: false,
          xanchor: 'right',
          yanchor: 'bottom',
          font: {
            family: 'Source Sans 3, Source Sans Pro, sans-serif',
            size: 10,
            color: isDark ? '#06B6D4' : '#0891B2',
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
        filename: 'gwasena_manhattan_plot',
        height: 600,
        width: 1000,
        scale: 2,
      },
    };

    Plotly.react(containerRef.current, traces, layout, config);

    // Event Listener Klik Titik
    const container = containerRef.current;
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
      }

      if (clickedSnp && onSelectSnp) {
        onSelectSnp(clickedSnp);
      }
    };

    container.on('plotly_click', handlePlotClick);

    // Handle Window Resize
    const handleResize = () => {
      if (containerRef.current) {
        Plotly.Plots.resize(containerRef.current);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (container && container.removeAllListeners) {
        container.removeAllListeners('plotly_click');
      }
    };
  }, [snps, threshold, theme, selectedSnpId, onSelectSnp]);

  return (
    <div className="w-full overflow-hidden rounded-2xl figma-card p-2 sm:p-4">
      <div ref={containerRef} className="h-[420px] w-full" />
    </div>
  );
}
