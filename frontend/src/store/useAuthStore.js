/**
 * Authentication Store GWASena 2.0
 * Acuan: docs/gwasena-v2/USER_FLOW.md & API_INTEGRATION.md
 */

import { create } from 'zustand';
import { authService } from '../services/authService.js';
import { getStoredToken, removeStoredToken } from '../services/apiClient.js';

export const useAuthStore = create((set, get) => ({
  token: getStoredToken(),
  user: null,
  isAuthenticated: Boolean(getStoredToken()),
  isDemo: typeof window !== 'undefined' ? localStorage.getItem('gwasena_is_demo') === 'true' : false,
  isLoading: false,
  isInitialized: false,
  error: null,

  /**
   * Pengecekan sesi aktif saat aplikasi pertama kali dimuat
   */
  checkSession: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ user: null, isAuthenticated: false, isDemo: false, isInitialized: true });
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const user = await authService.getMe();
      if (typeof window !== 'undefined') {
        localStorage.setItem('gwasena_has_logged_in', 'true');
      }
      const isDemo = typeof window !== 'undefined' ? localStorage.getItem('gwasena_is_demo') === 'true' : false;
      set({
        user,
        token,
        isAuthenticated: true,
        isDemo,
        isLoading: false,
        isInitialized: true,
      });
      return user;
    } catch {
      removeStoredToken();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gwasena_is_demo');
      }
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isDemo: false,
        isLoading: false,
        isInitialized: true,
      });
      return null;
    }
  },

  /**
   * Login pengguna
   */
  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authService.login(username, password);
      if (typeof window !== 'undefined') {
        localStorage.setItem('gwasena_has_logged_in', 'true');
        localStorage.removeItem('gwasena_is_demo');
      }
      set({
        token: res.access_token,
        user: res.pengguna || res.user,
        isAuthenticated: true,
        isDemo: false,
        isLoading: false,
      });
      return res;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /**
   * Login/Registrasi pengguna via Google ID Token (credential)
   */
  loginGoogle: async (credential) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authService.loginGoogle(credential);
      if (typeof window !== 'undefined') {
        localStorage.setItem('gwasena_has_logged_in', 'true');
        localStorage.removeItem('gwasena_is_demo');
      }
      set({
        token: res.access_token,
        user: res.user || res.pengguna,
        isAuthenticated: true,
        isDemo: false,
        isLoading: false,
      });
      return res;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /**
   * Login langsung akun peneliti demo (bypass tanpa form dan error server)
   */
  loginDemo: async () => {
    set({ isLoading: true, error: null });
    try {
      let res;
      try {
        res = await authService.loginDemo();
      } catch (demoErr) {
        // Fallback login dengan kredensial default peneliti demo jika /api/auth/demo terkendala
        res = await authService.login('peneliti_demo', 'password123');
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('gwasena_has_logged_in', 'true');
        localStorage.setItem('gwasena_is_demo', 'true');
      }
      set({
        token: res.access_token,
        user: res.pengguna || res.user,
        isAuthenticated: true,
        isDemo: true,
        isLoading: false,
      });
      return res;
    } catch (err) {
      // Jika server offline, tetap buat sesi demo lokal agar penguji dapat menjelajahi mode demo
      const fallbackUser = {
        user_id: 999,
        username: 'peneliti_demo',
        email: 'demo@gwasena.id',
        role: 'pengguna_analisis',
      };
      const fallbackToken = 'gwasena_demo_offline_token_' + Date.now();
      if (typeof window !== 'undefined') {
        localStorage.setItem('gwasena_access_token', fallbackToken);
        localStorage.setItem('gwasena_has_logged_in', 'true');
        localStorage.setItem('gwasena_is_demo', 'true');
      }
      set({
        token: fallbackToken,
        user: fallbackUser,
        isAuthenticated: true,
        isDemo: true,
        isLoading: false,
      });
      return { access_token: fallbackToken, user: fallbackUser, is_demo: true };
    }
  },

  /**
   * Registrasi akun baru
   */
  register: async (username, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authService.register(username, email, password);
      set({ isLoading: false });
      return res;
    } catch (err) {
      set({ isLoading: false, error: err.message || err.pesan });
      throw err;
    }
  },

  /**
   * Keluar dari sesi (tidak menghapus flag intro / pernah login)
   */
  logout: () => {
    authService.logout();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gwasena_is_demo');
    }
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isDemo: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));

// Tangani event sesi kedaluwarsa secara otomatis
if (typeof window !== 'undefined') {
  window.addEventListener('gwasena:auth-expired', () => {
    useAuthStore.getState().logout();
  });
}
