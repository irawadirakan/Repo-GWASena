import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Plotly from 'plotly.js-dist-min';
import { useAnalysisStore } from '../store/useAnalysisStore.js';
import Step1Upload from '../components/wizard/Step1Upload.jsx';
import Step3Computation from '../components/wizard/Step3Computation.jsx';
import Step4Results from '../components/wizard/Step4Results.jsx';
import Step5Annotation from '../components/wizard/Step5Annotation.jsx';
import Step6Export from '../components/wizard/Step6Export.jsx';
import ScientificReportModal from '../components/wizard/ScientificReportModal.jsx';
import HistoryPage from '../pages/HistoryPage.jsx';
import ManhattanPlot from '../components/charts/ManhattanPlot.jsx';
import QQPlot from '../components/charts/QQPlot.jsx';
import { mockResponse, stubFetchRoutes } from './testHelpers.js';
import { resolveTargetTraitName } from '../constants/defaultParams.js';

describe('Evaluasi Tester Part 2 (7 Perbaikan Kualitas & Visualisasi)', () => {
  beforeEach(() => {
    useAnalysisStore.getState().reset();
    vi.restoreAllMocks();
    vi.spyOn(Plotly, 'react').mockImplementation((el) => {
      if (el && !el.on) {
        const listeners = {};
        el.on = (ev, cb) => {
          listeners[ev] = cb;
        };
        el.removeAllListeners = (ev) => {
          delete listeners[ev];
        };
        el.__triggerRelayout = (payload) => listeners['plotly_relayout']?.(payload);
      }
      return Promise.resolve();
    });
    vi.spyOn(Plotly.Plots, 'resize').mockImplementation(() => {});
  });

  it('Poin 1: Step4Results & ScientificReportModal menampilkan kotak Interpretasi Hasil Asosiasi (sig > 0 dan sig === 0)', () => {
    const sampleResultsSig = {
      association_results: [
        { snp_id: 'rs3683945', chromosome: '1', position: 3197400, p_value: 1e-8, neg_log10_p: 8.0, is_significant: true, effect_size: 0.42, std_error: 0.05 },
        { snp_id: 'rs3707673', chromosome: '2', position: 3407393, p_value: 0.12, neg_log10_p: 0.92, is_significant: false, effect_size: 0.03, std_error: 0.04 },
      ],
      significant_snps: [
        { snp_id: 'rs3683945', chromosome: '1', position: 3197400, p_value: 1e-8, neg_log10_p: 8.0, is_significant: true },
      ],
      top_snps: [],
      qq_data: [{ expected: 0.5, observed: 0.6 }, { expected: 1.5, observed: 3.1 }],
      summary: {
        trait: 'CD8',
        model: 'MLM',
        chromosome_count: 19,
        neg_log10_threshold: 5.39,
        bonferroni_threshold: 4.09e-6,
        lambda_gc: 1.01,
        samples_passed_qc: 1900,
        total_samples_analyzed: 1940,
        snps_passed_qc: 12226,
        asosiasi: { trait: 'CD8', model: 'MLM', jumlah_signifikan: 1, lambda_gc: 1.01 },
      },
    };

    useAnalysisStore.setState({
      results: sampleResultsSig,
      currentAnalysis: { analysis_id: 99, analysis_name: 'GWAS Mencit', status: 'selesai', organism: 'mus_musculus' },
      configParams: { organism: 'mus_musculus', trait: 'CD8', model: 'MLM', n_pc: 3 },
    });

    render(<Step4Results analysisId={99} onNavigateStep={vi.fn()} />);
    const step4Box = screen.getByTestId('step4-manhattan-interpretation');
    expect(step4Box).toHaveTextContent('Interpretasi Hasil Asosiasi Genomik (Manhattan Plot):');
    expect(step4Box).toHaveTextContent(/1 varian SNP signifikan/i);
    expect(step4Box).toHaveTextContent(/rs3683945/);
    expect(step4Box).toHaveTextContent(/Quantitative Trait Loci \(QTL\)/i);
    expect(step4Box).toHaveTextContent(/Mus musculus/);

    // Render ScientificReportModal dengan jumlah_signifikan === 0 (skenario poligenik)
    stubFetchRoutes(async () => mockResponse(404, {}));
    const polygenicResults = {
      ...sampleResultsSig,
      significant_snps: [],
      summary: {
        ...sampleResultsSig.summary,
        asosiasi: { trait: 'MCH', model: 'MLM', jumlah_signifikan: 0, lambda_gc: 1.02 },
      },
    };

    render(
      <ScientificReportModal
        isOpen={true}
        onClose={vi.fn()}
        analysisId={99}
        analysis={{ analysis_id: 99, analysis_name: 'GWAS Mencit Poligenik', organism: 'mus_musculus' }}
        results={polygenicResults}
        annotationData={{ status: 'tersedia', sumber: 'Ensembl REST API (mus_musculus)', sumber_tipe: 'ensembl', organism: 'mus_musculus', kandidat: [] }}
        configParams={{ organism: 'mus_musculus', trait: 'MCH', model: 'MLM', n_pc: 3 }}
      />
    );

    const reportBox = screen.getByTestId('report-manhattan-interpretation');
    expect(reportBox).toHaveTextContent('Interpretasi Hasil Asosiasi Genomik (Manhattan Plot):');
    expect(reportBox).toHaveTextContent(/arsitektur poligenik/i);
    expect(reportBox).toHaveTextContent(/FDR/i);
    expect(reportBox).toHaveTextContent(/Mus musculus/);
  });

  it('Poin 2: Step1Upload menampilkan indikator persentase loading (0%-100%) & progress bar saat validasi', async () => {
    let resolveUpload;
    stubFetchRoutes(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
    );

    render(
      <MemoryRouter>
        <Step1Upload analysisId="77" />
      </MemoryRouter>
    );

    const vcfInput = document.querySelector('input[type="file"][accept=".vcf,.vcf.gz,.bed"]');
    const csvInput = document.querySelector('input[type="file"][accept=".csv"]');
    fireEvent.change(vcfInput, {
      target: { files: [new File(['##fileformat=VCFv4.2\n'], 'mouse_hs1940.vcf', { type: 'text/vcf' })] },
    });
    fireEvent.change(csvInput, {
      target: { files: [new File(['sample_id,CD8\ns1,1.2\n'], 'fenotipe_mencit.csv', { type: 'text/csv' })] },
    });

    fireEvent.click(screen.getByRole('button', { name: /Unggah & Validasi Berkas Sekarang/i }));

    expect(screen.getByRole('button', { name: /Memvalidasi Format & Mencocokkan Sample ID\.\.\. \(\d+%\)/i })).toBeInTheDocument();
    const progBar = screen.getByRole('progressbar');
    expect(progBar).toBeInTheDocument();
    expect(Number(progBar.getAttribute('aria-valuenow'))).toBeGreaterThan(0);

    resolveUpload(
      mockResponse(200, {
        status: 'tervalidasi',
        analysis_id: 77,
        organism: 'mus_musculus',
        detected_organism: { organism: 'mus_musculus', label: 'Mencit (Mus musculus)', auto_detected: true },
        genotipe: { format: 'VCF', jumlah_sampel: 40, jumlah_snp: 200 },
        fenotipe: { jumlah_sampel: 40, daftar_sifat: ['CD8'] },
        kecocokan_sample_id: { status: 'cocok', jumlah_cocok: 40 },
      })
    );

    expect(await screen.findByText(/Validasi Dataset Berhasil/i)).toBeInTheDocument();
  });

  it('Poin 3: ManhattanPlot & QQPlot mempertahankan uirevision & zoom range saat titik SNP diklik', () => {
    const reactSpy = vi.mocked(Plotly.react);

    const snps = [
      { snp_id: 'rs1', chromosome: '1', position: 1000, p_value: 1e-6, neg_log10_p: 6, is_significant: true },
      { snp_id: 'rs2', chromosome: '2', position: 2000, p_value: 0.2, neg_log10_p: 0.7, is_significant: false },
    ];

    const { rerender, container } = render(
      <ManhattanPlot analysisId={55} snps={snps} threshold={5.0} selectedSnpId={null} onSelectSnp={vi.fn()} />
    );

    const firstLayout = reactSpy.mock.calls[0][2];
    expect(firstLayout.uirevision).toBe('manhattan-zoom-lock-55');
    expect(firstLayout.xaxis.uirevision).toBe(true);
    expect(firstLayout.yaxis.uirevision).toBe(true);

    // Simulasikan pengguna melakukan zoom pada sumbu X & Y
    const plotDiv = container.querySelector('.h-\\[430px\\]');
    plotDiv.__triggerRelayout({
      'xaxis.range[0]': 100,
      'xaxis.range[1]': 50000,
      'yaxis.range[0]': 2.5,
      'yaxis.range[1]': 7.5,
    });

    // Klik titik SNP -> mengubah selectedSnpId -> re-render harus mempertahankan range zoom terakhir!
    rerender(
      <ManhattanPlot analysisId={55} snps={snps} threshold={5.0} selectedSnpId="rs1" onSelectSnp={vi.fn()} />
    );

    const secondLayout = reactSpy.mock.calls[1][2];
    expect(secondLayout.uirevision).toBe('manhattan-zoom-lock-55');
    expect(secondLayout.xaxis.range).toEqual([100, 50000]);
    expect(secondLayout.xaxis.autorange).toBe(false);
    expect(secondLayout.yaxis.range).toEqual([2.5, 7.5]);
    expect(secondLayout.yaxis.autorange).toBe(false);

    // Verifikasi QQPlot juga mengunci uirevision
    render(<QQPlot analysisId={55} qqData={[{ expected: 0.5, observed: 0.6 }, { expected: 1.5, observed: 2.2 }]} lambdaGc={1.01} />);
    const qqLayout = reactSpy.mock.calls[2][2];
    expect(qqLayout.uirevision).toBe('qq-zoom-lock-55');
    expect(qqLayout.xaxis.uirevision).toBe(true);
    expect(qqLayout.yaxis.uirevision).toBe(true);
  });

  it('Poin 5: HistoryPage & ScientificReportModal menampilkan nama ilmiah dinamis (Mus musculus / Oryza sativa) tanpa hardcode Allium sativum / genom tanaman', async () => {
    stubFetchRoutes(async (url, opts) => {
      if (url === '/api/analyses' && (!opts.method || opts.method === 'GET')) {
        return mockResponse(200, [
          { analysis_id: 1, analysis_name: 'GWAS Mencit CD8', status: 'selesai', organism: 'mus_musculus', organism_label: 'Mus musculus' },
          { analysis_id: 2, analysis_name: 'GWAS Padi Sawah', status: 'selesai', organism: 'oryza_sativa', organism_label: 'Oryza sativa' },
          { analysis_id: 3, analysis_name: 'GWAS Bawang Putih', status: 'selesai', organism: 'Allium sativum', organism_label: 'Allium sativum' },
        ]);
      }
      return mockResponse(404, {});
    });

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Mus musculus')).toBeInTheDocument();
    expect(screen.getByText('Oryza sativa')).toBeInTheDocument();
    expect(screen.getByText('Allium sativum')).toBeInTheDocument();

    render(
      <ScientificReportModal
        isOpen={true}
        onClose={vi.fn()}
        analysisId={1}
        analysis={{ analysis_id: 1, analysis_name: 'GWAS Mencit', organism: 'mus_musculus' }}
        results={{
          association_results: [{ snp_id: 'rs1', chromosome: '1', position: 1000, p_value: 1e-6, neg_log10_p: 6, is_significant: true }],
          significant_snps: [{ snp_id: 'rs1', chromosome: '1', position: 1000, p_value: 1e-6, neg_log10_p: 6 }],
          top_snps: [],
          summary: { trait: 'CD8', model: 'MLM', chromosome_count: 19, neg_log10_threshold: 5.0, asosiasi: { jumlah_signifikan: 1, lambda_gc: 1.0 } },
        }}
        annotationData={{
          status: 'tersedia',
          sumber: 'Ensembl REST API (mus_musculus)',
          sumber_tipe: 'ensembl',
          organism: 'mus_musculus',
          kandidat: [
            {
              snp_id: 'rs1',
              chromosome: '1',
              position: 1000,
              gen: [{ gene_id: 'Gm26206', nama: 'Gm26206', deskripsi: 'predicted gene MGI', jarak_bp: 0, konsekuensi: 'intragenic_variant', letak: 'di dalam gen' }],
            },
          ],
        }}
        configParams={{ organism: 'mus_musculus', trait: 'CD8', model: 'MLM', n_pc: 3 }}
      />
    );

    expect(screen.getAllByText(/19 Kromosom/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/di sepanjang genom/i)).toHaveTextContent(/Mus musculus \(19 kromosom\)/i);
    expect(screen.getByText(/Pemetaan Gen Kandidat Fungsional \(ENSEMBL REST API — MUS MUSCULUS\)/i)).toBeInTheDocument();
    expect(screen.getByText(/riset genetik dan pemuliaan terarah/i)).toBeInTheDocument();
    expect(screen.queryByText(/di sepanjang genom tanaman/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pemuliaan tanaman terarah/i)).not.toBeInTheDocument();
  });

  it('Poin 6: Pill sub-navigasi di Step4, Step5, Step6 bebas awalan "Langkah 4:", "Langkah 5:", "Langkah 6:"', async () => {
    useAnalysisStore.setState({
      results: {
        association_results: [{ snp_id: 'rs1', chromosome: '1', position: 100, p_value: 1e-5, neg_log10_p: 5 }],
        significant_snps: [],
        top_snps: [{ snp_id: 'rs1', chromosome: '1', position: 100, p_value: 1e-5, neg_log10_p: 5 }],
        qq_data: [{ expected: 0.5, observed: 0.5 }],
        summary: { trait: 'CD8', model: 'MLM', chromosome_count: 19, neg_log10_threshold: 5.0 },
      },
    });
    stubFetchRoutes(async () => mockResponse(200, { status: 'tersedia', sumber: 'Ensembl REST API (mus_musculus)', sumber_tipe: 'ensembl', organism: 'mus_musculus', kandidat: [] }));

    const { unmount: u4 } = render(<Step4Results analysisId={1} onNavigateStep={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Hasil & Visualisasi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Anotasi Gen\s*→?$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ekspor & Laporan\s*→?$/i })).toBeInTheDocument();
    expect(screen.queryByText(/Langkah 4:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Langkah 5:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Langkah 6:/i)).not.toBeInTheDocument();
    u4();

    const { unmount: u5 } = render(<Step5Annotation analysisId={1} onNavigateStep={vi.fn()} />);
    await screen.findByTestId('annotation-source-badge');
    expect(screen.queryByText(/Langkah 4:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Langkah 5:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Langkah 6:/i)).not.toBeInTheDocument();
    u5();

    render(<Step6Export analysisId={1} analysis={{ analysis_name: 'Sesi 1', organism: 'mus_musculus' }} onNavigateStep={vi.fn()} />);
    expect(screen.queryByText(/Langkah 4:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Langkah 5:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Langkah 6:/i)).not.toBeInTheDocument();
  });

  it('Resolusi Sifat Fenotipe Target: Step1 auto-select CD8, Step3 QC Ringkasan & Step6 tidak menampilkan strip "-"', async () => {
    // 1. Cascading resolver across session shapes
    expect(resolveTargetTraitName({ analysis: { parameters: { trait: 'CD8' } } })).toBe('CD8');
    expect(resolveTargetTraitName({ analysis: { phenotype_columns: ['sample_id', 'MCH', 'CD8'] } })).toBe('MCH');
    expect(resolveTargetTraitName({ analysis: { organism: 'mus_musculus' } })).toBe('CD8');

    // 2. Step1Upload auto-selects CD8 into configParams.trait on CSV upload
    useAnalysisStore.setState({
      currentAnalysis: { analysis_id: 77, analysis_name: 'Sesi Mencit', status: 'draft' },
    });
    stubFetchRoutes(async (url, opts) => {
      if (url === '/api/analyses/77/upload' && opts.method === 'POST') {
        return mockResponse(200, {
          status: 'tervalidasi',
          analysis_id: 77,
          organism: 'mus_musculus',
          detected_organism: { organism: 'mus_musculus', label: 'Mencit (Mus musculus)', auto_detected: true },
          genotipe: { format: 'PLINK biner', nama_berkas: 'mouse_hs1940.bed', jumlah_sampel: 1940, jumlah_snp: 12226 },
          fenotipe: { nama_berkas: 'fenotipe_mencit_hs1940.csv', jumlah_sampel: 1940, daftar_sifat: ['CD8', 'MCH'] },
          kecocokan_sample_id: { status: 'cocok', jumlah_cocok: 1940 },
        });
      }
      if (url === '/api/analyses/77/status') {
        return mockResponse(200, {
          analysis_id: 77,
          status: 'berjalan',
          trait_name: 'CD8',
          progres_persen: 45,
          tahap_sekarang: 'qc',
          tahap: [{ kode: 'qc', nama: 'Quality Control', status: 'berjalan' }],
          ringkasan_qc: { sampel_awal: 1940, snp_awal: 12226, trait_name: 'CD8' },
        });
      }
      return mockResponse(404, {});
    });

    const { unmount: unmountStep1 } = render(
      <MemoryRouter>
        <Step1Upload analysisId="77" />
      </MemoryRouter>
    );
    const vcfInput = document.querySelector('input[type="file"][accept=".vcf,.vcf.gz,.bed"]');
    const csvInput = document.querySelector('input[type="file"][accept=".csv"]');
    fireEvent.change(vcfInput, { target: { files: [new File(['##fileformat=VCFv4.2\n'], 'mouse_hs1940.vcf', { type: 'text/vcf' })] } });
    fireEvent.change(csvInput, { target: { files: [new File(['sample_id,CD8,MCH\ns1,1.2,0.5\n'], 'fenotipe_mencit_hs1940.csv', { type: 'text/csv' })] } });
    fireEvent.click(screen.getByRole('button', { name: /Unggah & Validasi Berkas Sekarang/i }));
    await screen.findByText(/Validasi Dataset Berhasil/i);
    expect(useAnalysisStore.getState().configParams.trait).toBe('CD8');
    unmountStep1();

    // 3. Step3Computation clears configParams.trait -> still displays 'CD8' from status & analysis
    useAnalysisStore.setState({
      configParams: { organism: 'mus_musculus', trait: '', model: 'MLM', n_pc: 3 },
      currentAnalysis: { analysis_id: 77, status: 'berjalan', organism: 'mus_musculus', parameters: { trait: 'CD8' } },
      uploadSummary: null,
      results: null,
    });
    render(<Step3Computation analysisId={77} onComplete={vi.fn()} />);
    const traitBadge = await screen.findByTestId('qc-target-trait-value');
    expect(traitBadge).toHaveTextContent('CD8');
    expect(traitBadge.textContent.trim()).not.toBe('-');
    expect(traitBadge.textContent.trim()).not.toBe('—');
  });
});
