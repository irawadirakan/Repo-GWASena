import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAnalysisStore } from '../store/useAnalysisStore.js';
import Step1Upload from '../components/wizard/Step1Upload.jsx';
import Step2Config from '../components/wizard/Step2Config.jsx';
import Step3Computation from '../components/wizard/Step3Computation.jsx';
import { mockResponse, stubFetchRoutes } from './testHelpers.js';

describe('Wizard State-Guard Rules (BR-01, BR-02, BR-03, BR-05, AC-10.1)', () => {
  it('BR-01/BR-02 blocks navigating to Step 2+ unless uploadSummary & Sample ID match are valid', () => {
    const store = useAnalysisStore.getState();

    // Missing uploadSummary -> locked at step 1
    expect(store.setActiveStep(2)).toBe(1);
    expect(useAnalysisStore.getState().activeStep).toBe(1);

    // Invalid validation flag -> status stays draft, step stays 1
    store.setCurrentAnalysis({ analysis_id: 1, status: 'draft' });
    store.setUploadSummary({
      analysis_id: 1,
      status: 'tervalidasi',
      validation: { is_valid: false, sample_match: true },
    });
    expect(useAnalysisStore.getState().currentAnalysis.status).toBe('draft');
    expect(useAnalysisStore.getState().setActiveStep(2)).toBe(1);

    // Mismatched Sample ID -> blocked at step 1
    store.setUploadSummary({
      analysis_id: 1,
      validation: { is_valid: true, sample_match: false },
      kecocokan_sample_id: { status: 'tidak_cocok' },
    });
    expect(useAnalysisStore.getState().setActiveStep(2)).toBe(1);

    // Valid upload + Sample ID cocok -> allows Step 2, blocks Step 4 before selesai
    store.setUploadSummary({
      analysis_id: 1,
      status: 'tervalidasi',
      kecocokan_sample_id: { status: 'cocok', jumlah_cocok: 40 },
    });
    expect(useAnalysisStore.getState().currentAnalysis.status).toBe('tervalidasi');
    expect(useAnalysisStore.getState().setActiveStep(2)).toBe(2);
    expect(useAnalysisStore.getState().setActiveStep(4)).toBe(2);

    // Completed -> allows Step 4..6
    useAnalysisStore.getState().setCurrentAnalysis({ analysis_id: 1, status: 'selesai' });
    expect(useAnalysisStore.getState().setActiveStep(6)).toBe(6);
  });

  it('Step1Upload disables Step 2 CTA when validation fails and renders PR #29 non-fatal peringatan banner when valid', () => {
    useAnalysisStore.setState({
      uploadSummary: {
        analysis_id: 10,
        genotipe: { format: 'VCF', jumlah_sampel: 40, jumlah_snp: 500 },
        fenotipe: { jumlah_sampel: 40, daftar_sifat: ['bobot_umbi_g'] },
        kecocokan_sample_id: { status: 'cocok', jumlah_cocok: 40 },
        peringatan: ["Kolom non-numerik 'catatan_teks' diabaikan otomatis."],
      },
    });

    const onNext = vi.fn();
    render(
      <MemoryRouter>
        <Step1Upload analysisId="10" onNext={onNext} />
      </MemoryRouter>
    );

    const warnBanner = screen.getByRole('status');
    expect(warnBanner).toHaveTextContent('Peringatan Validasi (Non-Fatal):');
    expect(warnBanner).toHaveTextContent("Kolom non-numerik 'catatan_teks' diabaikan otomatis.");

    const proceedBtn = screen.getByRole('button', { name: /Lanjut ke Konfigurasi QC \(Langkah 2\)/i });
    expect(proceedBtn).not.toBeDisabled();
    fireEvent.click(proceedBtn);
    expect(useAnalysisStore.getState().activeStep).toBe(2);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('Step1Upload disables Step 2 CTA if uploadSummary has sample_match=false', () => {
    useAnalysisStore.setState({
      uploadSummary: {
        analysis_id: 11,
        validation: { is_valid: true, sample_match: false },
        kecocokan_sample_id: { status: 'tidak_cocok', jumlah_cocok: 0 },
      },
    });

    render(
      <MemoryRouter>
        <Step1Upload analysisId="11" />
      </MemoryRouter>
    );

    const proceedBtn = screen.getByRole('button', { name: /Lanjut ke Konfigurasi QC \(Langkah 2\)/i });
    expect(proceedBtn).toBeDisabled();
  });

  it('BR-03 enforces mutually exclusive GLM / MLM single selection & mandatory PCA (n_pc = 3)', () => {
    useAnalysisStore.getState().setConfigParams({ model: 'OTHER', n_pc: 0 });
    expect(useAnalysisStore.getState().configParams.model).toBe('GLM');
    expect(useAnalysisStore.getState().configParams.n_pc).toBe(3);

    useAnalysisStore.getState().setConfigParams({ model: 'MLM' });
    render(<Step2Config analysisId={10} availableTraits={['bobot_umbi_g']} />);

    const radioGroup = screen.getByRole('radiogroup', { name: /Pilih model uji asosiasi/i });
    const radios = radioGroup.querySelectorAll('[role="radio"]');
    expect(radios).toHaveLength(2);
    const glmCard = radios[0];
    const mlmCard = radios[1];

    // Default MLM checked, GLM unchecked
    expect(glmCard).toHaveAttribute('aria-checked', 'false');
    expect(mlmCard).toHaveAttribute('aria-checked', 'true');

    // Click GLM -> mutual exclusion flips to GLM
    fireEvent.click(glmCard);
    expect(glmCard).toHaveAttribute('aria-checked', 'true');
    expect(mlmCard).toHaveAttribute('aria-checked', 'false');

    // Keyboard Enter on MLM -> switches back to MLM
    fireEvent.keyDown(mlmCard, { key: 'Enter' });
    expect(mlmCard).toHaveAttribute('aria-checked', 'true');
    expect(glmCard).toHaveAttribute('aria-checked', 'false');
  });

  it('BR-05/AC-10.1 locks steps and config mutations during antre/berjalan and unlocks on failure', async () => {
    useAnalysisStore.setState({
      activeStep: 3,
      isComputing: true,
      currentAnalysis: { analysis_id: 12, status: 'berjalan' },
      uploadSummary: { status: 'tervalidasi', kecocokan_sample_id: { status: 'cocok' } },
      configParams: {
        trait: 'bobot_umbi_g',
        qc: { mind: 0.1, geno: 0.1, maf: 0.05 },
        n_pc: 3,
        model: 'MLM',
        koreksi: ['bonferroni'],
        alpha: 0.05,
      },
    });

    // Store locks step switches away from step 3 and ignores config mutations
    const store = useAnalysisStore.getState();
    expect(store.setActiveStep(1)).toBe(3);
    expect(store.setActiveStep(2)).toBe(3);
    expect(store.setActiveStep(4)).toBe(3);
    store.setConfigParams({ model: 'GLM', alpha: 0.01 });
    expect(useAnalysisStore.getState().configParams.model).toBe('MLM');

    // Step2Config buttons are disabled while locked during compute
    const { unmount } = render(<Step2Config analysisId={12} availableTraits={['bobot_umbi_g']} />);
    expect(screen.getByRole('button', { name: /Kembali ke Unggah Berkas/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Jalankan Analisis GWAS/i })).toBeDisabled();
    unmount();

    // Polling returns gagal -> unlocks navigation back to Step 2
    stubFetchRoutes(async () =>
      mockResponse(200, {
        status: 'gagal',
        progres_persen: 20,
        galat: { pesan: 'Tidak ada varian setelah QC' },
      })
    );

    render(<Step3Computation analysisId={12} />);
    const backBtn = await screen.findByRole('button', {
      name: /Kembali ke Konfigurasi QC & Model \(Langkah 2\)/i,
    });
    expect(useAnalysisStore.getState().isComputing).toBe(false);

    fireEvent.click(backBtn);
    expect(useAnalysisStore.getState().activeStep).toBe(2);
  });
});
