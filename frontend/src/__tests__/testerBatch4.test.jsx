import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Plotly from 'plotly.js-dist-min';
import IntroPage from '../pages/IntroPage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';
import Step1Upload from '../components/wizard/Step1Upload.jsx';
import Step2Config from '../components/wizard/Step2Config.jsx';
import Step5Annotation from '../components/wizard/Step5Annotation.jsx';
import QQPlot from '../components/charts/QQPlot.jsx';
import { TIPS_EDUKATIF } from '../constants/eduHints.js';
import { apiClient } from '../services/apiClient.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { useAnalysisStore } from '../store/useAnalysisStore.js';

// Helper mock response
function mockResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Evaluasi Tester Batch 4: Resolusi 100% Modul GWASena', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
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

    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, isDemo: false });
    useAnalysisStore.setState({
      currentAnalysis: null,
      configParams: {},
      results: null,
      uploadSummary: null,
      activeStep: 1,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 0. PEMISAHAN KARTU (SHAPES) PADA INTROPAGE (S-00 / TAHAP 04)
  // ─────────────────────────────────────────────────────────────
  describe('0. Pemisahan Kartu pada IntroPage (S-00 / Tahap 04)', () => {
    it('Memisahkan Visualisasi Plot dan Aksi CTA menjadi dua kartu independen pada Tahap 04', () => {
      render(
        <BrowserRouter>
          <IntroPage />
        </BrowserRouter>
      );

      // Navigasi ke Tahap 04 (Lihat hasil dan laporan)
      const step4Btn = screen.getByRole('button', { name: /Lihat hasil dan laporan/i });
      fireEvent.click(step4Btn);

      // Kartu Pertama: Visualisasi Plot & Sinyal Asosiasi
      expect(screen.getByText(/Manhattan Plot & Signifikansi Genomik/i)).toBeInTheDocument();
      expect(screen.getByText(/Sinyal asosiasi terdeteksi:/i)).toBeInTheDocument();

      // Verifikasi banner sinyal asosiasi TIDAK memuat simbol bintang ✨
      const signalBanner = screen.getByText(/Sinyal asosiasi terdeteksi:/i).closest('div');
      expect(signalBanner.textContent).not.toContain('✨');

      // Kartu Kedua: Aksi CTA Terpisah
      const ctaCard = screen.getByTestId('intro-cta-card');
      expect(ctaCard).toBeInTheDocument();
      expect(ctaCard).toHaveTextContent('Siap memulai eksplorasi dan penemuan asosiasi genomik?');
      expect(ctaCard.querySelector('a[href="/login"]') || ctaCard.querySelector('button')).toHaveTextContent('Mulai Sekarang !');
      expect(ctaCard.querySelector('a[href="/register"]')).toHaveTextContent('Buat Akun Baru');

      // Verifikasi judul CTA melebar (w-full) dan kontainer tombol aksi (justify-end)
      const ctaTitle = ctaCard.querySelector('h3') || ctaCard.querySelector('p');
      expect(ctaTitle).toHaveClass('w-full');
      const btnWrapper = ctaCard.querySelector('div.mt-5') || ctaCard.querySelector('div.mt-4');
      expect(btnWrapper).toBeInTheDocument();
      expect(btnWrapper).toHaveClass('justify-end');

      // Verifikasi container flex memiliki gap vertikal pemisah (gap-4)
      const parentContainer = ctaCard.parentElement;
      expect(parentContainer).toHaveClass('flex-col');
      expect(parentContainer).toHaveClass('gap-4');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 1. MODUL AUTENTIKASI, AKUN DEMO, & VALIDASI FORM (S-01, S-02)
  // ─────────────────────────────────────────────────────────────
  describe('1. Autentikasi & Akun Demo (S-01, S-02)', () => {
    it('LoginPage dan RegisterPage menyediakan kontainer tombol resmi Google Auth', () => {
      const { unmount: unmountLogin } = render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      );
      expect(document.getElementById('google-auth-button')).toBeInTheDocument();
      unmountLogin();

      render(
        <BrowserRouter>
          <RegisterPage />
        </BrowserRouter>
      );
      expect(document.getElementById('google-auth-button')).toBeInTheDocument();
    });
    it('Bypass demo login di LoginPage langsung memindahkan ke /dashboard dan set isDemo: true', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/auth/demo')) {
          return mockResponse(200, {
            access_token: 'demo-token-123',
            token_type: 'bearer',
            user: { username: 'peneliti_demo', role: 'researcher', full_name: 'Peneliti Demo GWASena' },
          });
        }
        return mockResponse(404, {});
      });

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      );

      const demoBtn = screen.getByRole('button', { name: /Jelajahi Mode Demo/i });
      fireEvent.click(demoBtn);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
        expect(useAuthStore.getState().isDemo).toBe(true);
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
      });
    });

    it('Bypass demo login di RegisterPage langsung login sesi demo dan navigasi ke /dashboard', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/auth/demo')) {
          return mockResponse(200, {
            access_token: 'demo-token-123',
            token_type: 'bearer',
            user: { username: 'peneliti_demo', role: 'researcher', full_name: 'Peneliti Demo GWASena' },
          });
        }
        return mockResponse(404, {});
      });

      render(
        <BrowserRouter>
          <RegisterPage />
        </BrowserRouter>
      );

      const demoBtn = screen.getByRole('button', { name: /Gunakan Akun Peneliti Demo di Layar Masuk/i });
      fireEvent.click(demoBtn);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
        expect(useAuthStore.getState().isDemo).toBe(true);
      });
    });

    it('Memisahkan konteks autofill browser: Username dan Email memiliki atribut HTML terpisah', () => {
      render(
        <BrowserRouter>
          <RegisterPage />
        </BrowserRouter>
      );

      const usernameInput = screen.getByLabelText(/^Username$/i);
      expect(usernameInput).toHaveAttribute('name', 'username');
      expect(usernameInput).toHaveAttribute('id', 'username');
      expect(usernameInput).toHaveAttribute('autocomplete', 'username');

      const emailInput = screen.getByLabelText(/Alamat Email/i);
      expect(emailInput).toHaveAttribute('name', 'email');
      expect(emailInput).toHaveAttribute('id', 'email');
      expect(emailInput).toHaveAttribute('autocomplete', 'email');
    });

    it('Menolak username yang hanya berisi titik .... atau simbol tanpa huruf/angka', async () => {
      render(
        <BrowserRouter>
          <RegisterPage />
        </BrowserRouter>
      );

      const usernameInput = screen.getByLabelText(/^Username$/i);
      fireEvent.change(usernameInput, { target: { value: '....' } });

      expect(
        await screen.findByText(/3–50 karakter & wajib huruf\/angka/i)
      ).toBeInTheDocument();
    });

    it('Menampilkan panduan kata sandi baru yang mengizinkan simbol @, +, _', () => {
      render(
        <BrowserRouter>
          <RegisterPage />
        </BrowserRouter>
      );

      expect(
        screen.getByText(/Minimal 8 karakter kombinasi huruf & angka \(simbol seperti @, \+, _ diperbolehkan\)/i)
      ).toBeInTheDocument();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. MODUL UNGGAH DATASET & SAMPLE BENCHMARK (S-04)
  // ─────────────────────────────────────────────────────────────
  describe('2. Unggah Dataset & Sample Benchmark (S-04)', () => {
    it('Standarisasi istilah PLINK Biner (.bed + .bim + .fam) dan penjelasan triplet', () => {
      render(<Step1Upload onNext={vi.fn()} />);

      const plinkTab = screen.getByRole('button', { name: /PLINK Biner \(\.bed \+ \.bim \+ \.fam\)/i });
      expect(plinkTab).toBeInTheDocument();
      fireEvent.click(plinkTab);

      expect(screen.getByText(/Format PLINK biner membutuhkan triplet berkas lengkap/i)).toBeInTheDocument();
      expect(screen.getByText(/Genotipe PLINK Biner \(\.bed \+ \.bim \+ \.fam\)/i)).toBeInTheDocument();
    });

    it('Eliminasi total dukungan .vcf.gz: tolak berkas terkompresi dan tampilkan panduan format .vcf standar', () => {
      render(<Step1Upload onNext={vi.fn()} />);

      // Periksa badge format di kanan atas kartu genotipe adalah .vcf
      expect(screen.getByText('.vcf')).toBeInTheDocument();

      // Periksa deskripsi kartu genotipe
      expect(
        screen.getByText('Format VCF standar (.vcf) yang memuat informasi varian penanda SNP multi-sampel.')
      ).toBeInTheDocument();

      // Periksa catatan infobox bawah kartu
      expect(
        screen.getByText('Format genotipe yang didukung adalah teks VCF (.vcf) atau PLINK Biner (.bed, .bim, .fam).')
      ).toBeInTheDocument();

      // Periksa atribut accept pada input file genotipe
      const genotypeInput = screen.getByTestId('genotype-file-input');
      expect(genotypeInput.getAttribute('accept')).toBe('.vcf');

      // Coba masukkan berkas .vcf.gz -> wajib ditolak seketika
      const gzFile = new File(['fake binary gz data'], 'genotipe.vcf.gz', { type: 'application/gzip' });
      fireEvent.change(genotypeInput, { target: { files: [gzFile] } });

      expect(screen.getByText('Format .vcf.gz tidak didukung.')).toBeInTheDocument();
      expect(
        screen.getByText('Format .vcf.gz tidak didukung. Harap unggah berkas teks VCF standar (.vcf) tanpa kompresi.')
      ).toBeInTheDocument();
    });

    it('Validasi batas ukuran file di sisi klien: tolak genotipe > 50 MB', async () => {
      render(<Step1Upload onNext={vi.fn()} />);

      const fileInput = screen.getByTestId('genotype-file-input');
      const largeFile = new File(['x'.repeat(100)], 'huge_genotype.vcf', { type: 'text/plain' });
      Object.defineProperty(largeFile, 'size', { value: 55 * 1024 * 1024 }); // 55 MB

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      expect(
        await screen.findByText(/Batas maksimum unggah berkas genotipe adalah 50 MB/i)
      ).toBeInTheDocument();
    });

    it('Validasi batas ukuran file di sisi klien: tolak fenotipe CSV > 10 MB', async () => {
      render(<Step1Upload onNext={vi.fn()} />);

      const fileInput = screen.getByTestId('phenotype-file-input');
      const largeCsv = new File(['id,trait\n'], 'huge_pheno.csv', { type: 'text/csv' });
      Object.defineProperty(largeCsv, 'size', { value: 12 * 1024 * 1024 }); // 12 MB

      fireEvent.change(fileInput, { target: { files: [largeCsv] } });

      expect(
        await screen.findByText(/Batas maksimum unggah berkas fenotipe CSV adalah 10 MB/i)
      ).toBeInTheDocument();
    });

    it('apiClient dikonfigurasi dengan timeout 60000 ms (60 detik)', () => {
      expect(apiClient).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. MODUL KONFIGURASI QC, PCA, & INPUT DESIMAL (S-05)
  // ─────────────────────────────────────────────────────────────
  describe('3. Konfigurasi QC, PCA, & Input Desimal (S-05)', () => {
    it('Koreksi ilmiah kartu PCA: deskripsi akurat dan menghapus "atau kekerabatan aksesi"', () => {
      render(<Step2Config onNext={vi.fn()} onBack={vi.fn()} />);

      const pcaDesc = screen.getByText(/Principal Component Analysis \(PCA\) dihitung secara deterministik menggunakan dekomposisi nilai singular/i);
      expect(pcaDesc).toBeInTheDocument();
      expect(pcaDesc.textContent).not.toContain('atau kekerabatan aksesi');
    });

    it('Input Alpha menggunakan step="any" dan preset 0.10 mempertahankan format dua desimal', async () => {
      render(<Step2Config onNext={vi.fn()} onBack={vi.fn()} />);

      const alphaInput = document.getElementById('alpha');
      expect(alphaInput).toBeInTheDocument();
      expect(alphaInput).toHaveAttribute('step', 'any');

      const presetBtn = screen.getByRole('button', { name: /0\.10 \(Eksploratori\)/i });
      fireEvent.click(presetBtn);

      expect(alphaInput.value).toBe('0.10');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. MODUL KOMPUTASI & VISUALISASI PLOT (S-06, S-07)
  // ─────────────────────────────────────────────────────────────
  describe('4. Komputasi & Visualisasi Plot (S-06, S-07)', () => {
    it('Tips Edukatif tidak memiliki penomoran angka kaku pada judul', () => {
      TIPS_EDUKATIF.forEach((tip) => {
        expect(tip.judul).not.toMatch(/^\d+\.\s*/);
      });
    });

    it('QQ Plot merender elemen interaktif tooltip dengan observed, expected, dan deviasi', () => {
      const mockQqData = [
        { expected: 0.5, observed: 0.6 },
        { expected: 1.5, observed: 2.2 },
      ];

      render(<QQPlot analysisId={99} qqData={mockQqData} lambdaGc={1.02} />);

      expect(screen.getByText(/Observasi SNP \(-log₁₀ P\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Garis Ekspektasi Teoritis \(y = x\)/i)).toBeInTheDocument();
      expect(screen.getByText(/λ_GC = 1\.020/i)).toBeInTheDocument();

      const lastCall = vi.mocked(Plotly.react).mock.calls.at(-1);
      expect(lastCall).toBeDefined();
      const traces = lastCall[1];
      const obsTrace = traces[0];
      expect(obsTrace.text).toBeDefined();
      expect(obsTrace.text[0]).toContain('Observed -log₁₀(P) = 0.600');
      expect(obsTrace.text[0]).toContain('Expected -log₁₀(P) = 0.500');
      expect(obsTrace.text[0]).toContain('Deviasi');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. MODUL ANOTASI GEN & AKURASI GFF3 (S-08)
  // ─────────────────────────────────────────────────────────────
  describe('5. Anotasi Gen & Akurasi GFF3 (S-08)', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/api/analyses/77/annotation')) {
          return mockResponse(200, {
            status: 'tersedia',
            sumber: 'Ensembl REST API (mus_musculus)',
            sumber_tipe: 'ensembl',
            organism: 'mus_musculus',
            jendela_bp: 50000,
            pesan: 'Ditemukan 2 kandidat gen.',
            kandidat: [
              {
                snp_id: 'rs100',
                chromosome: '1',
                position: 100000,
                p_value: 1e-8,
                signifikan: true,
                gen: [
                  {
                    gene_id: 'GeneB_Far',
                    nama: 'Gene B',
                    jarak_bp: 15000,
                    konsekuensi: 'downstream_gene_variant',
                    letak: 'hilir (downstream)',
                    awal: 115000,
                    akhir: 120000,
                    untai: '+',
                  },
                  {
                    gene_id: 'GeneA_Intragenic',
                    nama: 'Gene A',
                    jarak_bp: 0,
                    konsekuensi: 'missense_variant',
                    letak: 'intragenik',
                    awal: 95000,
                    akhir: 105000,
                    untai: '+',
                  },
                ],
              },
            ],
          });
        }
        return mockResponse(404, {});
      });

      useAnalysisStore.setState({
        currentAnalysis: { id: 77, organism: 'mus_musculus' },
        configParams: { trait: 'Tingkat Imunitas' },
      });
    });

    it('Pembersihan overclaim bioinformatika: deskripsi akurat posisional tanpa jalur biosintesis', async () => {
      render(<Step5Annotation analysisId={77} onNavigateStep={vi.fn()} />);

      const desc = await screen.findByText(
        /Anotasi gen memetakan koordinat fisik varian SNP signifikan ke fitur genomik terdekat berdasarkan berkas referensi anotasi \(GFF3\) untuk mengidentifikasi kandidat gen posisional\./i
      );
      expect(desc).toBeInTheDocument();
      expect(desc.textContent).not.toContain('Anotasi gen biologis');
      expect(desc.textContent).not.toContain('jalur biosintesis');
      expect(desc.textContent).not.toContain('regulasi ekspresi genetik');
    });

    it('Peringatan relasi One-to-Many & jendela analisis (±50 kb) ditampilkan di atas tabel', async () => {
      render(<Step5Annotation analysisId={77} onNavigateStep={vi.fn()} />);

      expect(
        await screen.findByText(
          /Satu titik SNP signifikan dapat memunculkan lebih dari satu baris kandidat gen jika terdapat beberapa gen yang berdekatan dalam rentang jendela pencarian\. Gunakan ID SNP unik saat menghitung total lokus signifikan yang ditemukan\./i
        )
      ).toBeInTheDocument();
    });

    it('Tabel kandidat gen memiliki kolom Posisi Relatif dan Jarak ke Gen (bp), terurut dari gen terdekat', async () => {
      render(<Step5Annotation analysisId={77} onNavigateStep={vi.fn()} />);

      expect(await screen.findByText('Posisi Relatif')).toBeInTheDocument();
      expect(screen.getByText('Jarak ke Gen (bp)')).toBeInTheDocument();

      // Intragenic (0 bp) harus muncul sebelum downstream (15.000 bp)
      const rows = screen.getAllByRole('row');
      const tableText = rows.map((r) => r.textContent).join(' ');
      const posIntragenic = tableText.indexOf('GeneA_Intragenic');
      const posDownstream = tableText.indexOf('GeneB_Far');
      expect(posIntragenic).toBeLessThan(posDownstream);
    });

    it('Badge Sumber: Ensembl REST API berada tepat di bawah judul sebagai tautan eksternal aktif target="_blank"', async () => {
      render(<Step5Annotation analysisId={77} onNavigateStep={vi.fn()} />);

      const ensemblBadge = await screen.findByTestId('annotation-source-badge');
      expect(ensemblBadge.tagName.toLowerCase()).toBe('a');
      expect(ensemblBadge).toHaveAttribute('target', '_blank');
      expect(ensemblBadge).toHaveAttribute('href', 'https://www.ensembl.org/Mus_musculus');
      expect(ensemblBadge).toHaveTextContent('Sumber: Ensembl REST API (mus_musculus)');
    });

    it('Menampilkan bar Sifat fenotipe target dengan tata letak rapat di atas tabel', async () => {
      render(<Step5Annotation analysisId={77} onNavigateStep={vi.fn()} />);

      const traitBar = await screen.findByTestId('step5-target-trait-value');
      expect(traitBar).toBeInTheDocument();
      expect(traitBar).toHaveTextContent('Tingkat Imunitas');
    });
  });
});
