/**
 * Authentication Store GWASena 2.0
 * Acuan: docs/gwasena-v2/USER_FLOW.md & API_INTEGRATION.md
 */

import { create } from 'zustand';
import { authService } from '../services/authService.js';
import { getStoredToken, removeStoredToken, setStoredToken } from '../services/apiClient.js';

function normalizeUser(raw) {
  if (!raw) {
    return {
      user_id: 1,
      username: 'peneliti',
      name: 'Peneliti GWASena',
      email: 'user@gwasena.id',
      role: 'pengguna_analisis',
    };
  }
  const username = raw.username || raw.name || raw.email?.split('@')[0] || 'peneliti';
  const name = raw.name || raw.username || 'Peneliti GWASena';
  const email = raw.email || `${username}@gwasena.id`;
  const role = raw.role || 'pengguna_analisis';
  return {
    ...raw,
    username,
    name,
    email,
    role,
    user_id: raw.user_id || raw.id || 1,
  };
}

function saveAccountToStorage(userObj, token) {
  if (typeof window === 'undefined' || !userObj) return;
  try {
    const raw = localStorage.getItem('gwasena_saved_accounts');
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    list = list.filter((a) => a.email !== userObj.email);
    list.unshift({
      user_id: userObj.user_id,
      username: userObj.username,
      name: userObj.name || userObj.username,
      email: userObj.email,
      role: userObj.role,
      token: token || null,
      last_active: Date.now(),
    });
    localStorage.setItem('gwasena_saved_accounts', JSON.stringify(list.slice(0, 6)));
  } catch (err) {
    console.warn('Gagal menyimpan riwayat akun:', err);
  }
}

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
      const rawUser = await authService.getMe();
      const user = normalizeUser(rawUser);
      saveAccountToStorage(user, token);
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
   * Login pengguna manual
   */
  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authService.login(username, password);
      const user = normalizeUser(res.user || res.pengguna);
      saveAccountToStorage(user, res.access_token);
      set({
        token: res.access_token,
        user,
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
   * Login atau Daftar dengan Google OAuth (Anti-Black-Page)
   */
  googleLogin: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authService.googleAuth(payload);
      const user = normalizeUser(res.user || res.pengguna);
      saveAccountToStorage(user, res.access_token);
      set({
        token: res.access_token,
        user,
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
   * Berpindah akun tersimpan di perangkat dalam 1-klik (Ala Google Switcher)
   */
  switchAccount: (account) => {
    const token = account.token || getStoredToken();
    if (token) {
      setStoredToken(token);
    }
    const user = normalizeUser(account);
    saveAccountToStorage(user, token);
    set({
      token,
      user,
      isAuthenticated: true,
      error: null,
    });
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
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /**
   * Keluar dari sesi (tidak menghapus flag intro atau akun tersimpan)
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
