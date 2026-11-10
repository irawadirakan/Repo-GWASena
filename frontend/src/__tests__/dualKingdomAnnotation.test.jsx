import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAnalysisStore } from '../store/useAnalysisStore.js';
import Step1Upload from '../components/wizard/Step1Upload.jsx';
import Step2Config from '../components/wizard/Step2Config.jsx';
import Step5Annotation from '../components/wizard/Step5Annotation.jsx';
import {
  ANIMAL_ORGANISM_OPTIONS,
  PLANT_ORGANISM_OPTIONS,
  ORGANISM_OPTIONS,
  detectOrganismClientSide,
  normalizeOrganismCode,
} from '../constants/defaultParams.js';
import { mockResponse, stubFetchRoutes } from './testHelpers.js';

describe('Smart Auto-Detect, Universal Custom Species & Dual-Server Ensembl', () => {
  beforeEach(() => {
    useAnalysisStore.getState().reset();
  });

  it('Step1Upload auto-detects mouse organism on upload and syncs useAnalysisStore', async () => {
    useAnalysisStore.setState({
      currentAnalysis: { analysis_id: 77, analysis_name: 'Sesi Mencit', status: 'draft' },
    });

    stubFetchRoutes(async (url, opts) => {
      if (url === '/api/analyses/77/upload' && opts.method === 'POST') {
        return mockResponse(200, {
          status: 'tervalidasi',
          analysis_id: 77,
          organism: 'mus_musculus',
          detected_organism: {
            organism: 'mus_musculus',
            kingdom: 'hewan',
            label: 'Mencit (Mus musculus)',
            detected_by: 'nama berkas/profil dataset',
            auto_detected: true,
          },
          genotipe: { format: 'VCF', nama_berkas: 'mouse_hs1940.vcf', jumlah_sampel: 40, jumlah_snp: 200 },
          fenotipe: { nama_berkas: 'fenotipe_mencit.csv', jumlah_sampel: 40, daftar_sifat: ['CD8', 'MCH'] },
          kecocokan_sample_id: { status: 'cocok', jumlah_cocok: 40 },
        });
      }
      return mockResponse(404, {});
    });

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

    const step1Badge = await screen.findByTestId('step1-detected-organism-badge');
    expect(step1Badge).toHaveTextContent(/Mencit \(Mus musculus\)/i);
    expect(useAnalysisStore.getState().configParams.organism).toBe('mus_musculus');
    expect(useAnalysisStore.getState().currentAnalysis.organism).toBe('mus_musculus');
  });

  it('Step2Config shows updated description without model/ternak, auto-detect badge, category tabs, and submits selected species', async () => {
    useAnalysisStore.setState({
      uploadSummary: {
        analysis_id: 55,
        organism: 'mus_musculus',
        detected_organism: {
          organism: 'mus_musculus',
          kingdom: 'hewan',
          label: 'Mencit (Mus musculus)',
          auto_detected: true,
        },
        kecocokan_sample_id: { status: 'cocok', jumlah_cocok: 40 },
      },
      currentAnalysis: {
        analysis_id: 55,
        analysis_name: 'GWAS Mencit HS1940',
        status: 'tervalidasi',
        organism: 'mus_musculus',
      },
      configParams: {
        organism: 'mus_musculus',
        detectedOrganism: { organism: 'mus_musculus', auto_detected: true },
        qc: { mind: 0.1, geno: 0.1, maf: 0.05 },
        model: 'MLM',
        n_pc: 3,
      },
      activeStep: 2,
    });

    let putBody = null;
    const fetchSpy = stubFetchRoutes(async (url, opts) => {
      if (url === '/api/analyses/55/parameters' && opts.method === 'PUT') {
        putBody = JSON.parse(opts.body);
        return mockResponse(200, { status: 'siap', organism: putBody.organism });
      }
      if (url === '/api/analyses/55/run' && opts.method === 'POST') {
        return mockResponse(202, { status: 'berjalan' });
      }
      return mockResponse(404, {});
    });

    render(
      <Step2Config
        analysisId={55}
        availableTraits={['CD8', 'MCH']}
        onPrev={vi.fn()}
        onRunSuccess={vi.fn()}
      />
    );

    // Exact subtitle copy requirement (no "model/ternak")
    expect(
      screen.getByText(
        'Pilih spesies hewan atau tanaman untuk pemetaan gen kandidat otomatis via Ensembl REST API atau referensi GFF3 Lokal.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/model\/ternak/i)).not.toBeInTheDocument();

    // Auto-detected green badge & mus_musculus preselected
    expect(screen.getByTestId('auto-detected-organism-badge')).toHaveTextContent(
      '✓ Terdeteksi otomatis dari berkas dataset Anda'
    );

    const select = screen.getByLabelText(/Organisme Target Riset/i);
    expect(select).toHaveValue('mus_musculus');
    expect(Array.from(select.querySelectorAll('option')).map((o) => o.value)).toEqual(
      ORGANISM_OPTIONS.map((o) => o.value)
    );

    // Filter Hewan tab shows animal options only
    fireEvent.click(screen.getByRole('tab', { name: 'Hewan' }));
    expect(Array.from(screen.getByLabelText(/Organisme Target Riset/i).querySelectorAll('option')).map((o) => o.value)).toEqual(
      ANIMAL_ORGANISM_OPTIONS.map((o) => o.value)
    );

    // Filter Tanaman tab shows plant options only
    fireEvent.click(screen.getByRole('tab', { name: 'Tanaman' }));
    expect(Array.from(screen.getByLabelText(/Organisme Target Riset/i).querySelectorAll('option')).map((o) => o.value)).toEqual(
      PLANT_ORGANISM_OPTIONS.map((o) => o.value)
    );

    // Switch back to Otomatis snaps to auto-detected mus_musculus
    fireEvent.click(screen.getByRole('tab', { name: /Otomatis/i }));
    expect(screen.getByLabelText(/Organisme Target Riset/i)).toHaveValue('mus_musculus');

    fireEvent.click(screen.getByRole('button', { name: /Jalankan Analisis GWAS/i }));

    await waitFor(() => {
      expect(putBody).not.toBeNull();
    });
    expect(putBody.organism).toBe('mus_musculus');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/analyses/55/parameters',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('Step2Config custom species tab allows free scientific name input and sends snake_case organism in PUT /parameters', async () => {
    useAnalysisStore.setState({
      currentAnalysis: {
        analysis_id: 88,
        analysis_name: 'GWAS Kucing',
        status: 'tervalidasi',
        organism: 'Allium sativum',
      },
      activeStep: 2,
    });

    let putBody = null;
    stubFetchRoutes(async (url, opts) => {
      if (url === '/api/analyses/88/parameters' && opts.method === 'PUT') {
        putBody = JSON.parse(opts.body);
        return mockResponse(200, { status: 'siap', organism: putBody.organism });
      }
      if (url === '/api/analyses/88/run' && opts.method === 'POST') {
        return mockResponse(202, { status: 'berjalan' });
      }
      return mockResponse(404, {});
    });

    render(
      <Step2Config
        analysisId={88}
        availableTraits={['coat_color']}
        onPrev={vi.fn()}
        onRunSuccess={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Spesies Lainnya/i }));
    const customInput = screen.getByLabelText(/Ketik Nama Ilmiah Spesies/i);
    fireEvent.change(customInput, { target: { value: 'Felis catus' } });

    expect(screen.getByTestId('config-annotation-source-pill')).toHaveTextContent(
      'Ensembl REST API (felis_catus)'
    );
    expect(normalizeOrganismCode('Capra hircus')).toBe('capra_hircus');
    expect(detectOrganismClientSide({ filenames: ['tomato_panel.vcf'] }).organism).toBe('solanum_lycopersicum');

    fireEvent.click(screen.getByRole('button', { name: /Jalankan Analisis GWAS/i }));
    await waitFor(() => {
      expect(putBody).not.toBeNull();
    });
    expect(putBody.organism).toBe('felis_catus');
  });

  it('Step5Annotation displays Ensembl REST API badge with candidate genes for mus_musculus', async () => {
    stubFetchRoutes(async (url) => {
      if (url.includes('/api/analyses/55/annotation')) {
        return mockResponse(200, {
          status: 'tersedia',
          sumber: 'Ensembl REST API (mus_musculus)',
          sumber_tipe: 'ensembl',
          organism: 'mus_musculus',
          organism_target: 'Mencit (Mus musculus)',
          jendela_bp: 50000,
          pesan: 'Ditemukan 1 kandidat gen dari Ensembl REST API (mus_musculus).',
          kandidat: [
            {
              snp_id: 'rs3683945',
              chromosome: '1',
              position: 3197400,
              p_value: 1.2e-7,
              signifikan: true,
              gen: [
                {
                  gene_id: 'Gm26206',
                  nama: 'Gm26206',
                  deskripsi: 'predicted gene, 26206 [Source:MGI Symbol]',
                  awal: 3172239,
                  akhir: 3172348,
                  untai: '+',
                  jarak_bp: 25052,
                  konsekuensi: 'downstream_gene_variant',
                  letak: 'di hilir (downstream)',
                },
              ],
            },
          ],
        });
      }
      return mockResponse(404, {});
    });

    render(<Step5Annotation analysisId={55} onNavigateStep={vi.fn()} />);

    const badge = await screen.findByTestId('annotation-source-badge');
    expect(badge).toHaveTextContent('Sumber: Ensembl REST API (mus_musculus)');
    expect(screen.getByText('Gm26206')).toBeInTheDocument();
    expect(screen.getByText('rs3683945')).toBeInTheDocument();
  });

  it('Step5Annotation displays GFF3 Referensi Lokal badge for local plant annotation', async () => {
    stubFetchRoutes(async (url) => {
      if (url.includes('/api/analyses/12/annotation')) {
        return mockResponse(200, {
          status: 'tersedia',
          sumber: 'anotasi_bawang_putih_contoh.gff3',
          sumber_tipe: 'gff3',
          organism: 'allium_sativum',
          organism_target: 'Allium sativum',
          jendela_bp: 50000,
          pesan: 'Ditemukan 1 kandidat gen.',
          kandidat: [
            {
              snp_id: 'snp_chr3_0042',
              chromosome: '3',
              position: 500000,
              p_value: 2.5e-8,
              signifikan: true,
              gen: [
                {
                  gene_id: 'GC3G9001',
                  nama: 'Alliinase',
                  deskripsi: 'Alliin lyase isoform',
                  awal: 495000,
                  akhir: 505000,
                  untai: '+',
                  jarak_bp: 0,
                  konsekuensi: 'intragenic_variant',
                  letak: 'di dalam gen',
                },
              ],
            },
          ],
        });
      }
      return mockResponse(404, {});
    });

    render(<Step5Annotation analysisId={12} onNavigateStep={vi.fn()} />);

    const badge = await screen.findByTestId('annotation-source-badge');
    expect(badge).toHaveTextContent('Sumber: GFF3 Referensi Lokal');
    expect(screen.getByText('GC3G9001')).toBeInTheDocument();
  });
});
