/**
 * Authentication Service GWASena 2.0
 * Terhubung 100% ke endpoint autentikasi backend tanpa fallback token palsu.
 */

import { apiClient, setStoredToken, removeStoredToken } from './apiClient.js';

export const authService = {
  /**
   * Login pengguna melalui backend API
   * @param {string} username - Username atau alamat email
   * @param {string} password - Kata sandi
   */
  async login(username, password) {
    const data = await apiClient.post('/api/auth/login', { username, password });
    if (!data?.access_token) {
      throw new Error('Server autentikasi tidak mengembalikan token akses yang valid.');
    }
    setStoredToken(data.access_token);
    return data;
  },

  /**
   * Login instan sesi peneliti demo via backend API
   */
  async loginDemo() {
    const data = await apiClient.post('/api/auth/demo', {});
    if (!data?.access_token) {
      throw new Error('Server autentikasi tidak mengembalikan token akses demo yang valid.');
    }
    setStoredToken(data.access_token);
    return data;
  },

  /**
   * Login/Registrasi otomatis dengan Google ID Token (credential)
   * @param {string} credential
   */
  async loginGoogle(credential) {
    const res = await apiClient.post('/api/auth/google', { credential });
    const data = res?.data || res;
    if (!data?.access_token) {
      throw new Error('Server autentikasi tidak mengembalikan token akses yang valid.');
    }
    setStoredToken(data.access_token);
    return data;
  },

  /**
   * Registrasi akun peneliti baru melalui backend API
   * @param {string} username
   * @param {string} email
   * @param {string} password
   */
  async register(username, email, password) {
    return apiClient.post('/api/auth/register', { username, email, password });
  },

  /**
   * Ambil profil pengguna yang sedang login; hapus token bila gagal/kedaluwarsa
   */
  async getMe() {
    try {
      return await apiClient.get('/api/auth/me');
    } catch (err) {
      removeStoredToken();
      throw err;
    }
  },

  /**
   * Logout di sisi klien
   */
  logout() {
    removeStoredToken();
  },
};
