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
  isLoading: false,
  isInitialized: false,
  error: null,

  /**
   * Pengecekan sesi aktif saat aplikasi pertama kali dimuat
   */
  checkSession: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ user: null, isAuthenticated: false, isInitialized: true });
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const user = await authService.getMe();
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
      });
      return user;
    } catch {
      removeStoredToken();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      });
      return null;
    }
  },

  /**
   * Login pengguna (S-01)
   */
  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authService.login(username, password);
      set({
        token: res.access_token,
        user: res.pengguna,
        isAuthenticated: true,
        isLoading: false,
      });
      return res;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /**
   * Registrasi akun baru (S-02)
   */
  register: async (username, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authService.register(username, email, password);
      set({ isLoading: false });
      return res;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /**
   * Keluar dari sesi (tidak menghapus flag intro)
   */
  logout: () => {
    authService.logout();
    set({
      token: null,
      user: null,
      isAuthenticated: false,
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
