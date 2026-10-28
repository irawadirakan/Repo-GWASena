/**
 * HTTP Client Wrapper (Fetch) GWASena 2.0
 * Acuan: docs/gwasena-v2/API_INTEGRATION.md & FRONTEND_ARCHITECTURE.md
 */

export class ApiError extends Error {
  constructor(message, status = 500, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const TOKEN_KEY = 'gwasena_access_token';

export function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function removeStoredToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Universal request function
 * @param {string} endpoint - Relative path (e.g., '/api/auth/login')
 * @param {RequestInit} [options={}]
 */
export async function request(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  // Inject Bearer token if available
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // If body is NOT FormData and not explicitly set, default to JSON
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const config = {
    ...options,
    headers,
  };

  let res;
  try {
    res = await fetch(endpoint, config);
  } catch (err) {
    throw new ApiError(
      'Gagal terhubung ke server backend. Pastikan server aktif.',
      0,
      [err.message]
    );
  }

  // Parse JSON response or handle empty body
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    let message = 'Terjadi kesalahan pada sistem.';
    let details = [];

    // Deteksi jika proxy Vite gagal menghubungi backend lokal (port 8000 tidak aktif)
    if (
      (res.status === 500 || res.status === 502 || res.status === 504) &&
      (!data || typeof data === 'string' || !contentType.includes('application/json'))
    ) {
      message =
        'Server backend di http://localhost:8000 sedang tidak aktif. Silakan jalankan backend FastAPI ("uvicorn backend.main:app --port 8000") atau gunakan tombol Masuk Cepat Akun Demo.';
    }

    if (data && typeof data === 'object') {
      // 1. Format galat 422 khusus GWASena: { detail: { pesan, rincian } }
      if (data.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)) {
        message = data.detail.pesan || message;
        details = Array.isArray(data.detail.rincian) ? data.detail.rincian : [];
      }
      // 2. Format standar FastAPI: { detail: "string" }
      else if (typeof data.detail === 'string') {
        message = data.detail;
      }
      // 3. Format validasi default FastAPI Pydantic: { detail: [{ msg, loc }] }
      else if (Array.isArray(data.detail)) {
        message = 'Format masukan data tidak valid.';
        details = data.detail.map((d) => (d.msg ? `${d.loc ? d.loc.join(' > ') + ': ' : ''}${d.msg}` : String(d)));
      } else if (data.message) {
        message = data.message;
      }
    }

    // Tangani 401 Unauthorized secara terpusat
    if (res.status === 401 && !endpoint.includes('/api/auth/login')) {
      removeStoredToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gwasena:auth-expired'));
      }
    }

    throw new ApiError(message, res.status, details);
  }

  return data;
}

export const apiClient = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) =>
    request(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: (endpoint, body, options = {}) =>
    request(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
};
