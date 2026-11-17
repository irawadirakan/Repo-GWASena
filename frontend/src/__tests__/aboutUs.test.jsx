import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AboutFloatingButton from '../components/common/AboutFloatingButton.jsx';
import AboutPage from '../pages/AboutPage.jsx';
import { useThemeStore } from '../store/useThemeStore.js';
import { useAuthStore } from '../store/useAuthStore.js';

describe('Feature About Us — Revisi Presisi Master Prompt', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    useThemeStore.setState({ theme: 'dark' });
    useAuthStore.setState({ isAuthenticated: false, user: null });
  });

  describe('AboutFloatingButton (FAB)', () => {
    it('renders floating button with Users icon, tooltip, glass-btn class, and link to /about', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AboutFloatingButton />
        </MemoryRouter>
      );

      const fabLink = screen.getByRole('link', { name: /Tim di Balik GWASena/i });
      expect(fabLink).toBeInTheDocument();
      expect(fabLink).toHaveAttribute('href', '/about');
      expect(fabLink).toHaveClass('glass-btn');
      expect(screen.getByText('Tim di Balik GWASena')).toBeInTheDocument();
    });

    it('does not render when user is on the /about page', () => {
      render(
        <MemoryRouter initialEntries={['/about']}>
          <AboutFloatingButton />
        </MemoryRouter>
      );

      expect(screen.queryByRole('link', { name: /Tim di Balik GWASena/i })).not.toBeInTheDocument();
    });
  });

  describe('AboutPage (Halaman About Us)', () => {
    it('renders Header with exact badge and ALL CAPS Headline', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/about']}>
          <AboutPage />
        </MemoryRouter>
      );

      // Badge Header persis
      expect(screen.getAllByText('Kelompok 4 · Program Studi Bioinformatika · IPB University').length).toBeGreaterThan(0);

      // Headline Utama persis ALL CAPS
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SATU ANALISIS DALAM SATU PLATFORM.');

      // Subjudul persis
      expect(screen.getByRole('heading', { level: 2, name: /Mengapa GWASena kami bangun\?/i })).toBeInTheDocument();

      // Hapus sepenuhnya kalimat pembuat
      expect(container.textContent).not.toMatch(/Dibuat untuk mempermudah analisis GWAS bagi peneliti dan akademisi/i);
    });

    it('renders 6 SDLC steps with exact revised titles, descriptions, and without Selesai dalam Sprint badge', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/about']}>
          <AboutPage />
        </MemoryRouter>
      );

      // 01 Perencanaan
      expect(screen.getByText('Perencanaan & Penentuan Kebutuhan')).toBeInTheDocument();
      expect(screen.getByText(/Menentukan fitur utama, kebutuhan pengguna, ruang lingkup analisis GWAS/i)).toBeInTheDocument();

      // 02 Analisis
      expect(screen.getByText('Analisis Kebutuhan Sistem')).toBeInTheDocument();
      expect(screen.getByText(/Mengidentifikasi kebutuhan data, alur analisis, metode perhitungan/i)).toBeInTheDocument();

      // 03 Desain UI/UX
      expect(screen.getByText('Perancangan Antarmuka & Pengalaman Pengguna')).toBeInTheDocument();
      expect(screen.getByText(/Menyusun wireframe, desain halaman, komponen antarmuka/i)).toBeInTheDocument();

      // 04 Implementasi
      expect(screen.getByText('Pengembangan Frontend & Backend')).toBeInTheDocument();
      expect(screen.getByText(/Membangun antarmuka web, mengembangkan layanan backend/i)).toBeInTheDocument();

      // 05 Pengujian
      expect(screen.getByText('Pengujian & Evaluasi Sistem')).toBeInTheDocument();
      expect(screen.getByText(/Menguji fungsi setiap fitur, memeriksa integrasi sistem/i)).toBeInTheDocument();

      // 06 Deployment
      expect(screen.getByText('Penyelesaian & Publikasi Platform')).toBeInTheDocument();
      expect(screen.getByText(/Menyiapkan platform agar dapat diakses pengguna/i)).toBeInTheDocument();

      // Badge status Selesai dalam Sprint dihapus sepenuhnya
      expect(container.textContent).not.toMatch(/Selesai dalam Sprint/i);
    });

    it('renders team cards in exact order (Rakan -> Akna -> Moreno -> Isnaini -> Fannikha) with Rakan NIM G0401241032 and full email breakdown', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/about']}>
          <AboutPage />
        </MemoryRouter>
      );

      // Pastikan petunjuk membalik dihapus
      expect(container.textContent).not.toMatch(/sorot kartu untuk rincian tugas/i);
      expect(container.textContent).not.toMatch(/ketuk untuk membalik/i);

      // 1. Rakan Fawwaz Irawadi (NIM G0401241032)
      expect(screen.getByText('G0401241032')).toBeInTheDocument();
      expect(screen.getAllByText('Rakan Fawwaz Irawadi').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Project Manager (PM)').length).toBeGreaterThan(0);
      const rakanImg = screen.getByRole('img', { name: 'Rakan Fawwaz Irawadi' });
      expect(rakanImg).toBeInTheDocument();
      expect(rakanImg).toHaveAttribute('src', '/assets/team/foto-rakan.jpg');
      expect(rakanImg).toHaveClass('object-cover');
      expect(rakanImg).toHaveClass('object-center');

      // 2. Akna Mafaiz Firjatullah
      expect(screen.getByText('G0401241027')).toBeInTheDocument();
      expect(screen.getAllByText('Akna Mafaiz Firjatullah').length).toBeGreaterThan(0);
      expect(screen.getAllByText('System Analyst (SA)').length).toBeGreaterThan(0);

      // 3. Moreno Ardiansyah (Position 3)
      expect(screen.getByText('G0401241024')).toBeInTheDocument();
      expect(screen.getAllByText('Moreno Ardiansyah').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Frontend Developer (FE)').length).toBeGreaterThan(0);

      // 4. Isnaini Tiana Hayu (Position 4)
      expect(screen.getByText('G0401241021')).toBeInTheDocument();
      expect(screen.getAllByText('Isnaini Tiana Hayu').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Backend Developer (BE)').length).toBeGreaterThan(0);

      // 5. Fannikha Haeny Dzikriany
      expect(screen.getByText('G0401241031')).toBeInTheDocument();
      expect(screen.getAllByText('Fannikha Haeny Dzikriany').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Tester (QA)').length).toBeGreaterThan(0);

      // Email utuh dengan break-all font-mono tanpa truncate
      const emails = [
        'faisakna@apps.ipb.ac.id',
        'isnainitiana@apps.ipb.ac.id',
        'refall22ardiansyah@apps.ipb.ac.id',
        'fannikhahaen_dzikriany@apps.ipb.ac.id',
      ];
      emails.forEach((email) => {
        const el = screen.getByText(email);
        expect(el).toBeInTheDocument();
        expect(el).toHaveClass('break-all');
        expect(el).toHaveClass('font-mono');
        expect(el).not.toHaveClass('truncate');
      });
    });

    it('renders 3-column balanced statistics grid and removes 500 SNP benchmark', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/about']}>
          <AboutPage />
        </MemoryRouter>
      );

      const accentBox = container.querySelector('.glass-card-accent');
      expect(accentBox).toBeInTheDocument();

      // Pastikan grid 3 kolom pada desktop
      const gridContainer = accentBox.querySelector('.grid');
      expect(gridContainer).toHaveClass('md:grid-cols-3');
      expect(gridContainer).not.toHaveClass('md:grid-cols-4');
      expect(gridContainer).not.toHaveClass('md:grid-cols-5');

      // 3 Metrik utama
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('Tahap Pipeline Terintegrasi')).toBeInTheDocument();

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Model Statistik: GLM & MLM')).toBeInTheDocument();

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Komponen PCA Otomatis (PC1–PC3)')).toBeInTheDocument();

      // Pastikan 500 SNP dihapus
      expect(screen.queryByText('500')).not.toBeInTheDocument();
      expect(screen.queryByText(/SNP dataset benchmark/i)).not.toBeInTheDocument();
    });

    it('renders Tantangan Teknis section and simplified GitHub repository card', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/about']}>
          <AboutPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Tantangan Teknis • Pengembangan Sistem')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: /Tantangan dan Solusi di Balik GWASena/i })).toBeInTheDocument();

      // Card GitHub yang disederhanakan
      expect(screen.getByText('Kode Sumber & Dokumentasi')).toBeInTheDocument();
      const githubLink = screen.getByRole('link', { name: /Repositori GitHub/i });
      expect(githubLink).toBeInTheDocument();
      expect(githubLink).toHaveAttribute('href', 'https://github.com/irawadirakan/Repo-GWASena');

      // Pastikan Apresiasi, Beri Masukan, dan Lapor Bug dihapus sepenuhnya
      expect(container.textContent).not.toMatch(/Apresiasi & Dukungan/i);
      expect(screen.queryByText('Beri Masukan')).not.toBeInTheDocument();
      expect(screen.queryByText('Lapor Bug')).not.toBeInTheDocument();
    });
  });
});
