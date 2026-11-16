import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Plotly from 'plotly.js-dist-min';
import { useAnalysisStore } from '../store/useAnalysisStore.js';
import { useAuthStore } from '../store/useAuthStore.js';
import DashboardPage from '../pages/DashboardPage.jsx';
import Step2Config from '../components/wizard/Step2Config.jsx';
import Step3Computation from '../components/wizard/Step3Computation.jsx';
import { EDU_HINTS, TIPS_EDUKATIF } from '../constants/eduHints.js';
import Step4Results from '../components/wizard/Step4Results.jsx';
import Step5Annotation from '../components/wizard/Step5Annotation.jsx';
import Step6Export from '../components/wizard/Step6Export.jsx';
import ScientificReportModal from '../components/wizard/ScientificReportModal.jsx';
import HistoryPage from '../pages/HistoryPage.jsx';
import { mockResponse, stubFetchRoutes } from './testHelpers.js';

describe('Evaluasi Tester Batch 3 (Progress Stages, Pill Tabs, & Anti-Infinite-Loading)', () => {
  beforeEach(() => {
    useAnalysisStore.getState().reset();
    vi.restoreAllMocks();
    vi.spyOn(Plotly, 'react').mockImplementation(() => Promise.resolve());
    vi.spyOn(Plotly.Plots, 'resize').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Step3Computation: menghapus teks endpoint internal, mengubah judul Tahapan Eksekusi, dan menampilkan % + progress bar di tiap tahap', async () => {
    useAnalysisStore.setState({
      currentAnalysis: { analysis_id: 42, analysis_name: 'Uji Progres', status: 'berjalan', organism: 'mus_musculus' },
      configParams: { organism: 'mus_musculus', trait: 'CD8', model: 'MLM', n_pc: 3 },
    });

    stubFetchRoutes(async (url) => {
      if (url === '/api/analyses/42/status') {
        return mockResponse(200, {
          analysis_id: 42,
          status: 'berjalan',
          trait_name: 'CD8',
          progres_persen: 45,
          pesan_status: 'Menghitung PCA populasi...',
          langkah_berikutnya: 'GET /api/analyses/42/results',
          tahap_sekarang: 'pca',
          tahap: [
            { kode: 'qc', nama: 'Quality Control', status: 'selesai' },
            { kode: 'pca', nama: 'PCA & Kinship', status: 'berjalan' },
            { kode: 'gwas', nama: 'Asosiasi GWAS', status: 'menunggu' },
            { kode: 'anotasi', nama: 'Anotasi', status: 'menunggu' },
          ],
        });
      }
      return mockResponse(404, {});
    });

    const { container } = render(<Step3Computation analysisId={42} onComplete={vi.fn()} />);

    await screen.findByText('Menghitung PCA populasi...');

    // 1. Tidak boleh ada teks path endpoint internal
    expect(screen.queryByText(/Berikutnya:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/GET \/api\/analyses\/42\/results/i)).not.toBeInTheDocument();

    // 2. Judul seksi "Tahapan Eksekusi" (tanpa "Diskrit") & Tahap 4 updated title
    expect(screen.getByText('Tahapan Eksekusi')).toBeInTheDocument();
    expect(screen.queryByText(/Tahapan Eksekusi Diskrit/i)).not.toBeInTheDocument();
    expect(screen.getByText('Anotasi Kandidat Gen (GFF3 / Ensembl)')).toBeInTheDocument();

    // 3. Lencana persentase 0%-100% di keempat kartu tahap
    const pctBadges = Array.from(container.querySelectorAll('[data-testid^="stage-percent-"]'));
    expect(pctBadges).toHaveLength(4);
    expect(pctBadges.map((el) => el.textContent.trim())).toEqual(['100%', '45%', '0%', '0%']);

    // 4. Progress bar horizontal di keempat tahap memiliki warna sesuai status
    const progressBars = container.querySelectorAll('[role="progressbar"]');
    expect(progressBars.length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector('.bg-emerald-500.w-full')).not.toBeNull();
    expect(container.querySelector('.bg-cyan-500')).not.toBeNull();
    expect(container.querySelectorAll('.w-0').length).toBeGreaterThanOrEqual(2);
  });

  it('Pill sub-navigasi Step4, Step5, Step6 menampilkan teks murni tanpa simbol panah', async () => {
    const sampleResults = {
      association_results: [{ snp_id: 'rs1', chromosome: '1', position: 100, p_value: 1e-6, neg_log10_p: 6, is_significant: true }],
      significant_snps: [{ snp_id: 'rs1', chromosome: '1', position: 100, p_value: 1e-6, neg_log10_p: 6, is_significant: true }],
      top_snps: [{ snp_id: 'rs1', chromosome: '1', position: 100, p_value: 1e-6, neg_log10_p: 6 }],
      qq_data: [{ expected: 0.5, observed: 0.6 }],
      summary: { trait: 'CD8', model: 'MLM', chromosome_count: 19, neg_log10_threshold: 5.0 },
    };

    useAnalysisStore.setState({
      results: sampleResults,
      currentAnalysis: { analysis_id: 1, analysis_name: 'Sesi Pill', status: 'selesai', organism: 'mus_musculus' },
    });

    stubFetchRoutes(async () =>
      mockResponse(200, {
        status: 'tersedia',
        sumber: 'Ensembl REST API (mus_musculus)',
        sumber_tipe: 'ensembl',
        organism: 'mus_musculus',
        kandidat: [],
      })
    );

    const assertNoArrowPills = () => {
      const btnHasil = screen.getByRole('button', { name: 'Hasil & Visualisasi' });
      const btnAnotasi = screen.getByRole('button', { name: 'Anotasi Gen' });
      const btnEkspor = screen.getByRole('button', { name: 'Ekspor & Laporan' });
      for (const btn of [btnHasil, btnAnotasi, btnEkspor]) {
        expect(btn.textContent).not.toMatch(/[←→]/);
      }
    };

    const { unmount: u4 } = render(<Step4Results analysisId={1} onNavigateStep={vi.fn()} />);
    assertNoArrowPills();
    u4();

    const { unmount: u5 } = render(<Step5Annotation analysisId={1} onNavigateStep={vi.fn()} />);
    await screen.findByTestId('annotation-source-badge');
    assertNoArrowPills();
    u5();

    render(<Step6Export analysisId={1} analysis={{ analysis_name: 'Sesi Pill', organism: 'mus_musculus' }} onNavigateStep={vi.fn()} />);
    assertNoArrowPills();
  });

  it('Step5Annotation anti-infinite-loading: timeout 4 detik menghentikan spinner & fallback ke results store jika ada', async () => {
    vi.useFakeTimers();

    useAnalysisStore.setState({
      currentAnalysis: { analysis_id: 55, status: 'selesai', organism: 'mus_musculus' },
      configParams: { organism: 'mus_musculus', trait: 'CD8', model: 'MLM', n_pc: 3 },
      results: {
        significant_snps: [
          { snp_id: 'rs3683945', chromosome: '1', position: 3197400, p_value: 1e-8, is_significant: true },
        ],
        top_snps: [],
        association_results: [],
      },
    });

    // Server tidak merespons (hanging forever)
    stubFetchRoutes(() => new Promise(() => {}));

    const { container } = render(<Step5Annotation analysisId={55} onNavigateStep={vi.fn()} />);
    expect(screen.getByText(/Memuat pemetaan kandidat gen/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });

    expect(screen.queryByText(/Memuat pemetaan kandidat gen/i)).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeNull();
    expect(screen.getByText('rs3683945')).toBeInTheDocument();
  });

  it('Step5Annotation anti-infinite-loading: timeout tanpa results menampilkan fallback non-blocking AC-07.2 tanpa hang', async () => {
    vi.useFakeTimers();
    useAnalysisStore.setState({ results: null, currentAnalysis: { analysis_id: 56, organism: 'allium_sativum' } });
    stubFetchRoutes(() => new Promise(() => {}));

    const { container } = render(<Step5Annotation analysisId={56} onNavigateStep={vi.fn()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });

    expect(container.querySelector('.animate-spin')).toBeNull();
    expect(screen.getByText(/Layanan Referensi Anotasi Gen Sementara Tidak Tersedia/i)).toBeInTheDocument();
  });

  it('HistoryPage menormalkan payload { items }, merender Empty State [], dan menghentikan loading via timeout 5 detik dengan fallback', async () => {
    // 1. Normalisasi bentuk objek { items: [...] }
    stubFetchRoutes(async () =>
      mockResponse(200, {
        items: [
          {
            analysis_id: 10,
            analysis_name: 'Sesi Paginasi Ensembl',
            status: 'selesai',
            organism: 'mus_musculus',
            organism_label: 'Mus musculus',
          },
        ],
      })
    );

    const { unmount: uItems } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Sesi Paginasi Ensembl')).toBeInTheDocument();
    uItems();

    // 2. Empty state bersih pada []
    stubFetchRoutes(async () => mockResponse(200, []));
    const { unmount: uEmpty, container: cEmpty } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    );
    expect(await screen.findByText(/Belum Ada Sesi Analisis/i)).toBeInTheDocument();
    expect(cEmpty.querySelector('.animate-spin')).toBeNull();
    uEmpty();

    // 3. Timeout 5 detik saat fetch menggantung -> berhenti loading & pakai fallback store bila ada
    vi.useFakeTimers();
    useAnalysisStore.setState({
      currentAnalysis: {
        analysis_id: 88,
        analysis_name: 'Sesi Aktif Fallback',
        status: 'berjalan',
        organism: 'bos_taurus',
      },
    });
    stubFetchRoutes(() => new Promise(() => {}));

    const { unmount: uHangStore, container: cHangStore } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });

    expect(cHangStore.querySelector('.animate-spin')).toBeNull();
    expect(screen.getByText('Sesi Aktif Fallback')).toBeInTheDocument();
    uHangStore();

    // 4. Timeout 5 detik tanpa fallback di store -> spinner berhenti dan menampilkan kondisi error/kosong (tidak hang)
    useAnalysisStore.setState({ currentAnalysis: null });
    const { container: cHangEmpty } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });

    expect(cHangEmpty.querySelector('.animate-spin')).toBeNull();
  });

  it('DashboardPage: menghapus Ringkasan Aktivitas Riset, merapikan Hero Banner, dan menampilkan Modal tinggi bebas scroll tanpa teks opsional', async () => {
    useAuthStore.setState({
      user: { username: 'rakantester', email: 'rakan@contoh.id', role: 'peneliti' },
      isAuthenticated: true,
    });
    stubFetchRoutes(async (url) => {
      if (url.includes('/api/meta')) {
        return mockResponse(200, { organisme: { nama_ilmiah: 'Allium sativum' } });
      }
      return mockResponse(200, {});
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // 1. Hero banner proporsional & tidak ada sub-kotak Ringkasan Aktivitas Riset
    expect(screen.getByText('Alur Kerja Analisis Asosiasi Genomik GWASena')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Selamat datang kembali,\s*rakantester!/i })).toBeInTheDocument();
    expect(screen.queryByText(/Ringkasan Aktivitas Riset/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sesi Terdaftar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Siap untuk Analisis/i)).not.toBeInTheDocument();

    // 2. Buka Modal Inisiasi Sesi Analisis Baru
    fireEvent.click(screen.getByRole('button', { name: /\+ Inisiasi Sesi Analisis Baru/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.className).toContain('items-start');
    expect(dialog.className).toContain('overflow-y-auto');
    expect(dialog.className).toContain('pt-16');
    expect(dialog.className).toContain('sm:pt-24');
    expect(dialog.className).toContain('md:pt-28');
    // Pastikan modal berada di luar wrapper .animate-fade-in (tidak terjebak transform containing block)
    expect(dialog.closest('.animate-fade-in')).toBeNull();

    // 3. Input tanpa teks keterangan opsional & tombol aksi terlihat utuh
    expect(screen.getByPlaceholderText('Contoh: Analisis Asosiasi Genomik 2026')).toHaveValue('');
    expect(screen.queryByText(/Opsional: Kosongkan/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mulai Analisis/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tutup modal' })).toBeInTheDocument();
  });

  it('Step3Computation & useAnalysisStore: Monotonic Progress Guarantee (tidak pernah turun, +0.2% creep mentok 92%, animasi pulse, & snap 100%)', async () => {
    // 1. Uji Math.max guard langsung pada store
    const store = useAnalysisStore.getState();
    store.ensureProgressAnalysis(99);
    store.setGlobalProgress(85);
    expect(useAnalysisStore.getState().globalProgress).toBe(85);
    store.setGlobalProgress(50); // tidak boleh mundur
    expect(useAnalysisStore.getState().globalProgress).toBe(85);

    store.setStageProgress(3, 72.4, 92);
    expect(useAnalysisStore.getState().stageProgress[3]).toBe(72.4);
    store.setStageProgress(3, 45, 92); // tidak boleh mundur ke 45
    expect(useAnalysisStore.getState().stageProgress[3]).toBe(72.4);

    // 2. Uji simulasi polling Step3Computation dengan regresi respons & komputasi MLM panjang
    useAnalysisStore.getState().reset();
    vi.useFakeTimers();
    useAnalysisStore.setState({
      currentAnalysis: { analysis_id: 101, analysis_name: 'MLM Monotonik', status: 'berjalan', organism: 'mus_musculus' },
      configParams: { organism: 'mus_musculus', trait: 'CD8', model: 'MLM', n_pc: 3 },
    });

    let pollCount = 0;
    stubFetchRoutes(async (url) => {
      if (url === '/api/analyses/101/status') {
        pollCount += 1;
        if (pollCount === 1) {
          return mockResponse(200, {
            analysis_id: 101,
            status: 'berjalan',
            trait_name: 'CD8',
            progres_persen: 67,
            pesan_status: 'Menjalankan inversi matriks MLM...',
            tahap_sekarang: 'asosiasi',
            tahap: [
              { kode: 'qc', nama: 'QC', status: 'selesai' },
              { kode: 'pca', nama: 'PCA', status: 'selesai' },
              { kode: 'asosiasi', nama: 'Uji Asosiasi', status: 'berjalan' },
              { kode: 'anotasi', nama: 'Anotasi', status: 'menunggu' },
            ],
          });
        }
        if (pollCount === 2) {
          // Simulasi desinkronisasi backend mengirim progres lebih rendah & tahap mundur
          return mockResponse(200, {
            analysis_id: 101,
            status: 'berjalan',
            trait_name: 'CD8',
            progres_persen: 40,
            pesan_status: 'Menghitung kinships...',
            tahap_sekarang: 'pca',
            tahap: [
              { kode: 'qc', nama: 'QC', status: 'berjalan' },
              { kode: 'pca', nama: 'PCA', status: 'selesai' },
              { kode: 'asosiasi', nama: 'Uji Asosiasi', status: 'menunggu' },
              { kode: 'anotasi', nama: 'Anotasi', status: 'menunggu' },
            ],
          });
        }
        return mockResponse(200, {
          analysis_id: 101,
          status: 'selesai',
          trait_name: 'CD8',
          progres_persen: 100,
          pesan_status: 'Analisis selesai.',
          tahap: [
            { kode: 'qc', nama: 'QC', status: 'selesai' },
            { kode: 'pca', nama: 'PCA', status: 'selesai' },
            { kode: 'asosiasi', nama: 'Uji Asosiasi', status: 'selesai' },
            { kode: 'anotasi', nama: 'Anotasi', status: 'selesai' },
          ],
        });
      }
      if (url === '/api/analyses/101/results') {
        return mockResponse(200, {
          analysis_id: 101,
          association_results: [],
          significant_snps: [],
          top_snps: [],
          qq_data: [],
          summary: { trait: 'CD8', model: 'MLM', chromosome_count: 19, asosiasi: { jumlah_signifikan: 0 } },
        });
      }
      return mockResponse(404, {});
    });

    const { container } = render(<Step3Computation analysisId={101} onComplete={vi.fn()} />);

    // Flush poll 1 microtasks
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('global-progress-percent')).toHaveTextContent('67%');
    expect(screen.getByTestId('global-progress-bar').className).toContain('animate-pulse');
    expect(screen.getByTestId('stage-percent-1')).toHaveTextContent('100%');
    expect(screen.getByTestId('stage-percent-2')).toHaveTextContent('100%');
    expect(screen.getByTestId('stage-percent-3')).toHaveTextContent('45%');

    // Majukan 2000ms (1x creep +0.2% sebelum poll 2 di t=3000ms) -> 67.2% & 45.2%
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(screen.getByTestId('global-progress-percent')).toHaveTextContent('67.2%');
    expect(screen.getByTestId('stage-percent-3')).toHaveTextContent('45.2%');

    // Majukan melewati t=3000ms agar poll 2 (regresi 40% & tahap mundur) masuk -> HARUS TAHAN & TIDAK MUNDUR!
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(screen.getByTestId('global-progress-percent')).toHaveTextContent('67.2%');
    expect(screen.getByTestId('stage-percent-1')).toHaveTextContent('100%');
    expect(screen.getByTestId('stage-percent-3')).toHaveTextContent('45.2%');

    // Uji batas atap 92% untuk tahap berjalan & batas milestone untuk global
    await act(async () => {
      useAnalysisStore.getState().setStageProgress(3, 91.8, 92);
      useAnalysisStore.getState().setGlobalProgress(74, 74.2);
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(Number(screen.getByTestId('stage-percent-3').textContent.replace('%', ''))).toBeLessThanOrEqual(92);
    expect(Number(screen.getByTestId('global-progress-percent').textContent.replace('%', ''))).toBeLessThan(75);

    // Biarkan poll 3 (status: 'selesai') masuk -> snap ke 100% seluruhnya
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByTestId('global-progress-percent')).toHaveTextContent('100%');
    expect(screen.getByTestId('global-progress-bar').className).toContain('bg-emerald-500');
    expect(screen.getByTestId('global-progress-bar').className).not.toContain('animate-pulse');
    expect(screen.getByTestId('stage-percent-1')).toHaveTextContent('100%');
    expect(screen.getByTestId('stage-percent-2')).toHaveTextContent('100%');
    expect(screen.getByTestId('stage-percent-3')).toHaveTextContent('100%');
    expect(screen.getByTestId('stage-percent-4')).toHaveTextContent('100%');
  });

  it('Step2Config & eduHints: generalisasi teks HWE & Kinship ramah Dual-Kingdom (Hewan & Tumbuhan)', () => {
    useAnalysisStore.setState({
      currentAnalysis: { analysis_id: 21, status: 'tervalidasi', organism: 'mus_musculus', trait_name: 'CD8' },
      uploadSummary: {
        status: 'tervalidasi',
        kecocokan_sample_id: { status: 'cocok' },
        fenotipe: { daftar_sifat: ['CD8'] },
      },
    });

    render(<Step2Config analysisId={21} onStarted={vi.fn()} />);

    expect(screen.queryByText(/Nonaktif secara bawaan untuk tanaman klonal/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Nonaktif secara default. Aktifkan untuk populasi kawin acak (seperti hewan/ternak), dan nonaktifkan untuk varietas klonal/penyerbuk sendiri (tanaman).'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Aktifkan HWE terutama pada analisis populasi hewan atau organisme dengan perkawinan acak\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Untuk tanaman galur inbred, klonal, atau silang dalam, disarankan tetap menonaktifkan filter ini guna mencegah hilangnya varian sejati\./i)
    ).toBeInTheDocument();

    expect(EDU_HINTS.hwe.hint).toMatch(/populasi hewan/i);
    expect(EDU_HINTS.king_cutoff.hint).toMatch(/hewan ternak maupun koleksi plasma nutfah tanaman/i);
    const tipHwe = TIPS_EDUKATIF.find((t) => t.id === 4);
    expect(tipHwe.teks).toMatch(/hewan\/ternak/i);
    expect(tipHwe.teks).toMatch(/galur inbred/i);
  });

  it('ScientificReportModal menghapus label Core v2.4 menjadi GWASena dan menampilkan FastAPI (Python Pipeline) sebagai Mesin Komputasi', async () => {
    stubFetchRoutes(async () => mockResponse(404, {}));

    render(
      <ScientificReportModal
        isOpen={true}
        onClose={vi.fn()}
        analysisId={33}
        analysis={{ analysis_id: 33, analysis_name: 'Uji Ekspor Bersih', organism: 'mus_musculus' }}
        results={{
          association_results: [],
          significant_snps: [],
          top_snps: [],
          qq_data: [],
          summary: { trait: 'CD8', model: 'MLM', chromosome_count: 19, neg_log10_threshold: 5.0, asosiasi: { jumlah_signifikan: 0, lambda_gc: 1.0 } },
        }}
        annotationData={{ status: 'tidak_tersedia', pesan: '', kandidat: [] }}
        configParams={{ organism: 'mus_musculus', trait: 'CD8', model: 'MLM', n_pc: 3 }}
      />
    );

    await screen.findByText('Mesin Komputasi');
    expect(screen.getByText('FastAPI (Python Pipeline)')).toBeInTheDocument();
    expect(screen.getAllByText('GWASena').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/sistem komputasi terpadu GWASena berdasarkan data genotipe/i)).toBeInTheDocument();
    expect(screen.queryByText(/Core v2\.4/i)).not.toBeInTheDocument();
  });
});
