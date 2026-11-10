import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAnalysisStore } from '../store/useAnalysisStore.js';
import { useAuthStore } from '../store/useAuthStore.js';
import AppLayout from '../layouts/AppLayout.jsx';
import Step5Annotation from '../components/wizard/Step5Annotation.jsx';
import Step6Export from '../components/wizard/Step6Export.jsx';
import HistoryPage from '../pages/HistoryPage.jsx';
import { mockResponse, stubFetchRoutes } from './testHelpers.js';

describe('PR #29 Contract Integration & Non-Blocking Annotation Flows', () => {
  it('Step5Annotation handles unavailable GFF3 gracefully (AC-07.2) with no hardcoded GC3G9001 mock gene', async () => {
    stubFetchRoutes(async (url) => {
      if (url.includes('/api/analyses/99/annotation')) {
        return mockResponse(404, {
          detail: { pesan: 'Berkas referensi GFF3 belum dimuat di peladen.' },
        });
      }
      return mockResponse(404, {});
    });

    const onNav = vi.fn();
    render(<Step5Annotation analysisId={99} onNavigateStep={onNav} />);

    expect(await screen.findByText('Berkas referensi GFF3 belum dimuat di peladen.')).toBeInTheDocument();
    expect(screen.queryByText(/GC3G9001/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Simulasi Anotasi/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Lanjut ke Pengunduhan Data \(Langkah 6\)/i }));
    expect(onNav).toHaveBeenCalledWith(6);
  });

  it('Step6Export invokes PR #29 CSV significant & HTML report endpoints and displays error without simulation on HTTP 500', async () => {
    useAnalysisStore.setState({
      results: {
        association_results: [{ snp_id: 'snp1', chromosome: 1, position: 100, p_value: 1e-6, neg_log10_p: 6 }],
        significant_snps: [{ snp_id: 'snp1' }],
        top_snps: [{ snp_id: 'snp1' }],
        summary: { snps_passed_qc: 10, lambda_gc: 1.01, trait: 'bobot_umbi_g', model: 'MLM' },
      },
    });

    const fetchSpy = stubFetchRoutes(async (url) => {
      if (url.includes('/annotation')) {
        return mockResponse(200, { status: 'tersedia', kandidat: [] });
      }
      if (url === '/api/analyses/99/results/csv?hanya_signifikan=true') {
        return mockResponse(200, 'snp_id,p_value\nsnp1,1e-6', 'text/csv');
      }
      if (url === '/api/analyses/99/report?unduh=true') {
        return mockResponse(200, '<html><body>Laporan</body></html>', 'text/html');
      }
      if (url === '/api/analyses/99/results/csv') {
        return mockResponse(500, 'Server error', 'text/plain');
      }
      return mockResponse(404, {});
    });

    render(<Step6Export analysisId={99} analysis={{ analysis_name: 'Sesi Test' }} onNavigateStep={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /Unduh SNP Signifikan Saja \(CSV\)/i }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/analyses/99/results/csv?hanya_signifikan=true',
        expect.any(Object)
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Unduh Laporan Web \(HTML\)/i }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/analyses/99/report?unduh=true',
        expect.any(Object)
      );
    });

    // Now test HTTP 500 on full CSV download shows error banner instead of simulated download
    fireEvent.click(screen.getByRole('button', { name: /Unduh Semua Hasil \(CSV\)/i }));
    expect(await screen.findByText('Gagal mengunduh CSV: status HTTP 500')).toBeInTheDocument();
  });

  it('HistoryPage locks delete button for running sessions and deletes completed sessions via DELETE API', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));

    const fetchSpy = stubFetchRoutes(async (url, opts) => {
      if (url === '/api/analyses' && (!opts.method || opts.method === 'GET')) {
        return mockResponse(200, [
          { analysis_id: 1, analysis_name: 'Sesi Selesai Uji', status: 'selesai', organism: 'Allium sativum' },
          { analysis_id: 2, analysis_name: 'Sesi Berjalan Uji', status: 'berjalan', organism: 'Allium sativum' },
        ]);
      }
      if (url === '/api/analyses/1' && opts.method === 'DELETE') {
        return mockResponse(200, { deleted: true });
      }
      return mockResponse(404, {});
    });

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Sesi Selesai Uji')).toBeInTheDocument();
    const deleteBtns = screen.getAllByRole('button', { name: /Hapus sesi/i });
    expect(deleteBtns).toHaveLength(2);

    // Completed session enabled; running session disabled
    expect(deleteBtns[0]).not.toBeDisabled();
    expect(deleteBtns[1]).toBeDisabled();

    fireEvent.click(deleteBtns[0]);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/analyses/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
    expect(screen.queryByText('Sesi Selesai Uji')).not.toBeInTheDocument();
    expect(screen.getByText('Sesi Berjalan Uji')).toBeInTheDocument();
  });

  it('AppLayout reflects real offline backend health instead of fake Standby/Siap status', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { user_id: 1, username: 'peneliti', role: 'peneliti' },
    });

    stubFetchRoutes(async (url) => {
      if (url === '/api/health') {
        throw new TypeError('Connection refused');
      }
      return mockResponse(404, {});
    });

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    const statusBtn = await screen.findByRole('button', { name: /Koneksi Terputus/i });
    fireEvent.click(statusBtn);

    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('Terputus')).toBeInTheDocument();
    expect(screen.queryByText(/Standby \/ Siap/i)).not.toBeInTheDocument();
  });
});
