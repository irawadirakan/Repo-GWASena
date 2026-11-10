import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAnalysisStore } from '../store/useAnalysisStore.js';
import DashboardPage from '../pages/DashboardPage.jsx';
import Step1Upload from '../components/wizard/Step1Upload.jsx';
import Step2Config from '../components/wizard/Step2Config.jsx';
import Step3Computation from '../components/wizard/Step3Computation.jsx';
import { mockResponse, stubFetchRoutes } from './testHelpers.js';

describe('Zero Simulation Fallback & Structured Error Rendering', () => {
  it('DashboardPage keeps modal open and shows { pesan, rincian } when POST /api/analyses fails (HTTP 500)', async () => {
    stubFetchRoutes(async (url, opts) => {
      if (url.includes('/api/meta')) {
        return mockResponse(200, { organisme: { nama_ilmiah: 'Allium sativum' } });
      }
      if (url === '/api/analyses' && opts.method === 'POST') {
        return mockResponse(500, {
          detail: {
            pesan: 'Basis data sesi gagal dihubungi',
            rincian: ['PostgreSQL connection pool exhausted'],
          },
        });
      }
      return mockResponse(404, { detail: 'Not found' });
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /\+ Inisiasi Sesi Analisis Baru/i }));
    const input = await screen.findByLabelText(/Nama Sesi Analisis/i);
    fireEvent.change(input, { target: { value: 'Sesi Uji Error' } });
    fireEvent.click(screen.getByRole('button', { name: /Mulai Analisis/i }));

    expect(await screen.findByText('Basis data sesi gagal dihubungi')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL connection pool exhausted')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama Sesi Analisis/i)).toBeInTheDocument();
    expect(useAnalysisStore.getState().isSimulated).toBe(false);
    expect(useAnalysisStore.getState().currentAnalysis).toBeNull();
  });

  it('Step1Upload rejects fallback simulation when benchmark endpoint returns HTTP 404', async () => {
    stubFetchRoutes(async (url) => {
      if (url === '/api/analyses/benchmark') {
        return mockResponse(404, {
          detail: {
            pesan: 'Berkas benchmark tidak tersedia di server',
            rincian: ['data/contoh/genotipe_bawang_putih_mini.vcf tidak ditemukan'],
          },
        });
      }
      return mockResponse(404, { detail: 'Not found' });
    });

    render(
      <MemoryRouter>
        <Step1Upload analysisId="42" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Pakai VCF/i }));

    expect(await screen.findByText('Berkas benchmark tidak tersedia di server')).toBeInTheDocument();
    expect(
      screen.getByText('data/contoh/genotipe_bawang_putih_mini.vcf tidak ditemukan')
    ).toBeInTheDocument();
    expect(useAnalysisStore.getState().isSimulated).toBe(false);
    expect(useAnalysisStore.getState().uploadSummary).toBeNull();
    expect(screen.queryByRole('button', { name: /Lanjut ke Konfigurasi QC/i })).not.toBeInTheDocument();
  });

  it('Step1Upload displays structured error without advancing when upload returns HTTP 400', async () => {
    stubFetchRoutes(async (url) => {
      if (url === '/api/analyses/42/upload') {
        return mockResponse(400, {
          detail: {
            pesan: 'Sample ID tidak cocok antara VCF dan CSV',
            rincian: ['Sampel S99 di CSV tidak ditemukan di VCF'],
          },
        });
      }
      return mockResponse(404, { detail: 'Not found' });
    });

    const { container } = render(
      <MemoryRouter>
        <Step1Upload analysisId="42" />
      </MemoryRouter>
    );

    const fileInputs = container.querySelectorAll('input[type="file"]');
    const vcfInput = fileInputs[0];
    const csvInput = fileInputs[1];

    fireEvent.change(vcfInput, {
      target: { files: [new File(['##fileformat=VCFv4.2'], 'test.vcf', { type: 'text/plain' })] },
    });
    fireEvent.change(csvInput, {
      target: { files: [new File(['sample_id,trait\nS99,1.0'], 'pheno.csv', { type: 'text/csv' })] },
    });

    const submitBtn = screen.getByRole('button', { name: /Unggah & Validasi Berkas Sekarang/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Sample ID tidak cocok antara VCF dan CSV')).toBeInTheDocument();
    expect(screen.getByText('Sampel S99 di CSV tidak ditemukan di VCF')).toBeInTheDocument();
    expect(useAnalysisStore.getState().isSimulated).toBe(false);
    expect(useAnalysisStore.getState().activeStep).toBe(1);
    expect(screen.queryByRole('button', { name: /Lanjut ke Konfigurasi QC/i })).not.toBeInTheDocument();
  });

  it('Step2Config & runAnalysis throw real errors on HTTP 401/500 without falling back to simulation', async () => {
    useAnalysisStore.setState({
      activeStep: 2,
      currentAnalysis: { analysis_id: 77, id: 77, status: 'tervalidasi' },
      uploadSummary: { status: 'tervalidasi', fenotipe: { sifat_tersedia: ['bobot_umbi_g'] } },
    });

    stubFetchRoutes(async (url) => {
      if (url === '/api/analyses/77/parameters') {
        return mockResponse(200, { status: 'ok' });
      }
      if (url === '/api/analyses/77/run') {
        return mockResponse(500, {
          detail: {
            pesan: 'Worker komputasi sedang tidak tersedia',
            rincian: ['Redis broker tidak merespons'],
          },
        });
      }
      return mockResponse(401, { detail: { pesan: 'Tidak terotorisasi' } });
    });

    const onRunSuccess = vi.fn();
    const { unmount } = render(
      <Step2Config
        analysisId={77}
        availableTraits={['bobot_umbi_g']}
        onRunSuccess={onRunSuccess}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Jalankan Analisis GWAS/i }));

    expect(await screen.findByText('Worker komputasi sedang tidak tersedia')).toBeInTheDocument();
    expect(screen.getByText('Redis broker tidak merespons')).toBeInTheDocument();
    expect(onRunSuccess).not.toHaveBeenCalled();
    expect(useAnalysisStore.getState().isSimulated).toBe(false);
    expect(useAnalysisStore.getState().activeStep).toBe(2);

    unmount();
    // Verify 401 directly from store.runAnalysis also throws without simulation
    stubFetchRoutes(async () => mockResponse(401, { detail: { pesan: 'Sesi token kedaluwarsa' } }));
    await expect(
      useAnalysisStore.getState().runAnalysis(77, { trait: 'bobot_umbi_g', model: 'MLM' })
    ).rejects.toThrow('Sesi token kedaluwarsa');
    expect(useAnalysisStore.getState().isSimulated).toBe(false);
  });

  it('Step3Computation halts polling and renders failure details without simulation on status=gagal', async () => {
    useAnalysisStore.setState({
      activeStep: 3,
      isComputing: true,
      currentAnalysis: { analysis_id: 88, id: 88, status: 'berjalan' },
    });

    const fetchSpy = stubFetchRoutes(async (url) => {
      if (url === '/api/analyses/88/status') {
        return mockResponse(200, {
          status: 'gagal',
          progres_persen: 25,
          tahap_sekarang: 'qc',
          pesan_status: 'Penyaringan QC gagal',
          galat: {
            pesan: 'Filter MAF terlalu ketat sehingga 0 SNP lolos',
            rincian: ['Longgarkan ambang MAF dari 0.45 ke 0.05'],
          },
        });
      }
      return mockResponse(404, { detail: 'Not found' });
    });

    render(<Step3Computation analysisId={88} onComplete={vi.fn()} />);

    expect(await screen.findByText('Filter MAF terlalu ketat sehingga 0 SNP lolos')).toBeInTheDocument();
    expect(screen.getByText('Longgarkan ambang MAF dari 0.45 ke 0.05')).toBeInTheDocument();
    expect(useAnalysisStore.getState().isSimulated).toBe(false);
    expect(useAnalysisStore.getState().isComputing).toBe(false);
    expect(useAnalysisStore.getState().isFailed).toBe(true);
    expect(
      screen.getByRole('button', { name: /Kembali ke Konfigurasi QC & Model \(Langkah 2\)/i })
    ).not.toBeDisabled();
    expect(
      screen.getByRole('button', { name: /Kembali ke Unggah & Validasi \(Langkah 1\)/i })
    ).not.toBeDisabled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('Step3Computation handles HTTP 500 during status polling cleanly with no simulation fallback', async () => {
    useAnalysisStore.setState({
      activeStep: 3,
      isComputing: true,
      currentAnalysis: { analysis_id: 89, id: 89, status: 'berjalan' },
    });

    stubFetchRoutes(async () =>
      mockResponse(500, {
        detail: {
          pesan: 'Peladen status komputasi galat',
          rincian: ['Internal server timeout'],
        },
      })
    );

    render(<Step3Computation analysisId={89} onComplete={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Peladen status komputasi galat')).toBeInTheDocument();
    });
    expect(screen.getByText('Internal server timeout')).toBeInTheDocument();
    expect(useAnalysisStore.getState().isSimulated).toBe(false);
    expect(useAnalysisStore.getState().isComputing).toBe(false);
  });
});
