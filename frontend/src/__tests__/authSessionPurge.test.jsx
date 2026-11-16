import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore.js';
import LoginPage from '../pages/LoginPage.jsx';
import AdminPage from '../pages/AdminPage.jsx';
import { mockResponse, stubFetchRoutes } from './testHelpers.js';

const TOKEN_KEY = 'gwasena_access_token';

describe('TC-01 Real Auth Session Validation, Fake/Stale Token Purge & Admin RBAC', () => {
  it('purges legacy/fake token on HTTP 401 from /api/auth/me and sets isAuthenticated=false', async () => {
    localStorage.setItem(TOKEN_KEY, 'gwasena_demo_token_legacy_12345');

    stubFetchRoutes(async (url) => {
      if (url === '/api/auth/me') {
        return mockResponse(401, { detail: { pesan: 'Token tidak valid atau kedaluwarsa' } });
      }
      return mockResponse(404, { detail: 'Not found' });
    });

    const user = await useAuthStore.getState().checkSession();

    expect(user).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isInitialized).toBe(true);
  });

  it('purges stale token when backend is offline / network throws in checkSession', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale.jwt.payload');

    stubFetchRoutes(async () => {
      throw new TypeError('Failed to fetch');
    });

    const user = await useAuthStore.getState().checkSession();

    expect(user).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('LoginPage renders real 401 error and never fabricates demo tokens', async () => {
    stubFetchRoutes(async (url) => {
      if (url === '/api/auth/login') {
        return mockResponse(401, { detail: { pesan: 'Username atau kata sandi salah.' } });
      }
      return mockResponse(404, { detail: 'Not found' });
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Username atau Alamat Email/i), {
      target: { value: 'peneliti_ipb' },
    });
    fireEvent.change(screen.getByLabelText(/^Kata Sandi$/i), {
      target: { value: 'salah_password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Masuk ke Dashboard/i }));

    expect(await screen.findByText('Username atau kata sandi salah.')).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('AdminPage shows AccessDeniedState for non-administrator role without calling admin API', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { user_id: 2, username: 'peneliti', role: 'peneliti' },
    });
    const fetchSpy = stubFetchRoutes(async () => mockResponse(200, {}));

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Akses Ditolak (403 Forbidden)')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('AdminPage handles HTTP 403 dynamically and loads real stats for administrator', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { user_id: 1, username: 'admin_ipb', role: 'administrator' },
    });

    stubFetchRoutes(async (url) => {
      if (url === '/api/admin/ringkasan') {
        return mockResponse(200, {
          total_pengguna: 14,
          total_analisis: 29,
          analisis_aktif: 2,
          analisis_selesai: 24,
          analisis_gagal: 3,
        });
      }
      if (url === '/api/admin/users') {
        return mockResponse(200, [
          { user_id: 1, username: 'admin_ipb', email: 'admin@ipb.ac.id', role: 'administrator', jumlah_analisis: 5 },
        ]);
      }
      if (url.startsWith('/api/admin/analyses')) {
        return mockResponse(200, [
          { analysis_id: 7, analysis_name: 'Uji Bawang Aktif', username: 'peneliti1', organism: 'Allium sativum', status: 'berjalan' },
        ]);
      }
      return mockResponse(404, { detail: 'Not found' });
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Uji Bawang Aktif')).toBeInTheDocument();
    expect(screen.getByText('admin_ipb')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('29')).toBeInTheDocument();

    // Now test 403 fallback
    stubFetchRoutes(async () => mockResponse(403, { detail: { pesan: 'Hanya administrator' } }));
    fireEvent.click(screen.getByRole('button', { name: /Segarkan Data/i }));

    await waitFor(() => {
      expect(screen.getByText('Akses Ditolak (403 Forbidden)')).toBeInTheDocument();
    });
  });
});
