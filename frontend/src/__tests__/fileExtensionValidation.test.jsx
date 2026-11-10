import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Step1Upload from '../components/wizard/Step1Upload.jsx';
import { stubFetchRoutes } from './testHelpers.js';

describe('TC-02 Client-Side File Extension Validation (Rejects Invalid Files Before Fetch)', () => {
  it('rejects unsupported genotype extensions (.txt, .tar.gz, .exe) without calling upload API', () => {
    const fetchSpy = stubFetchRoutes(vi.fn());

    const { container } = render(
      <MemoryRouter>
        <Step1Upload analysisId="55" />
      </MemoryRouter>
    );

    const fileInputs = container.querySelectorAll('input[type="file"]');
    const genoInput = fileInputs[0];

    for (const badName of ['invalid.txt', 'archive.tar.gz', 'malware.exe']) {
      fireEvent.change(genoInput, {
        target: { files: [new File(['bad'], badName, { type: 'text/plain' })] },
      });
      expect(screen.getByText('Format berkas genotipe tidak didukung.')).toBeInTheDocument();
      expect(
        screen.getByText(
          `Berkas '${badName}' harus berformat .vcf / .vcf.gz (VCF) atau .bed (PLINK biner).`
        )
      ).toBeInTheDocument();
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects unsupported phenotype extensions (.xlsx, .tsv) without calling upload API', () => {
    const fetchSpy = stubFetchRoutes(vi.fn());

    const { container } = render(
      <MemoryRouter>
        <Step1Upload analysisId="55" />
      </MemoryRouter>
    );

    const fileInputs = container.querySelectorAll('input[type="file"]');
    const phenoInput = fileInputs[1];

    for (const badPheno of ['fenotipe.xlsx', 'fenotipe.tsv']) {
      fireEvent.change(phenoInput, {
        target: { files: [new File(['bad'], badPheno, { type: 'application/octet-stream' })] },
      });
      expect(screen.getByText('Format berkas fenotipe tidak didukung.')).toBeInTheDocument();
      expect(
        screen.getByText(`Berkas '${badPheno}' harus berformat .csv teks tabular.`)
      ).toBeInTheDocument();
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid PLINK sidecar extensions (.bim / .fam) and keeps upload CTA disabled', () => {
    const fetchSpy = stubFetchRoutes(vi.fn());

    const { container } = render(
      <MemoryRouter>
        <Step1Upload analysisId="55" />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /PLINK Biner \(\.bed \+ \.bim \+ \.fam\)/i }));

    const fileInputs = container.querySelectorAll('input[type="file"]');
    // In PLINK mode: [0]=bed, [1]=bim, [2]=fam, [3]=csv
    expect(fileInputs).toHaveLength(4);

    fireEvent.change(fileInputs[0], {
      target: { files: [new File(['bed'], 'cohort.bed', { type: 'application/octet-stream' })] },
    });
    fireEvent.change(fileInputs[1], {
      target: { files: [new File(['bad'], 'wrong_map.txt', { type: 'text/plain' })] },
    });

    expect(screen.getByText('Format berkas peta varian tidak valid.')).toBeInTheDocument();
    expect(screen.getByText("Berkas 'wrong_map.txt' harus berekstensi .bim.")).toBeInTheDocument();

    fireEvent.change(fileInputs[2], {
      target: { files: [new File(['bad'], 'wrong_ped.csv', { type: 'text/csv' })] },
    });
    expect(screen.getByText('Format berkas sampel/pedigree tidak valid.')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Unggah & Validasi Berkas Sekarang/i });
    expect(submitBtn).toBeDisabled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
