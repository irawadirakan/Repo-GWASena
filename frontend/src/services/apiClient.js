/**
 * HTTP Client Wrapper (Fetch) GWASena 2.0
 * Acuan: docs/gwasena-v2/API_INTEGRATION.md & FRONTEND_ARCHITECTURE.md
 */

/**
 * Human-Friendly Error Formatter
 * Menerjemahkan pesan galat teknis Pydantic / FastAPI menjadi kalimat bahasa Indonesia
 * yang santun, jelas, dan ramah pengguna umum (tanpa kode teknis mentah).
 */
export function formatUserFriendlyError(err) {
  if (!err) return null;

  const translateSingle = (str) => {
    if (!str || typeof str !== 'string') return str;
    let s = str.trim();

    // Galat unggah berkas genotipe
    if (
      s.toLowerCase().includes('genotipe') &&
      (s.includes('UploadFile') || s.includes('Field required') || s.includes('str') || s.includes('expected') || s.includes('Value error'))
    ) {
      return 'Berkas Genotipe (.vcf atau PLINK .bed/.bim/.fam) belum dipilih atau formatnya tidak sesuai.';
    }

    // Galat unggah berkas fenotipe
    if (
      s.toLowerCase().includes('fenotipe') &&
      (s.includes('UploadFile') || s.includes('Field required') || s.includes('str') || s.includes('expected') || s.includes('Value error'))
    ) {
      return 'Berkas Fenotipe (.csv) belum dipilih atau tidak terbaca.';
    }

    // Galat ketidakcocokan / ketiadaan Sample ID
    if (
      s.toLowerCase().includes('sample_id') ||
      s.toLowerCase().includes('sampel tidak cocok') ||
      s.toLowerCase().includes('sample mismatch') ||
      s.toLowerCase().includes('tidak ditemukan pada berkas')
    ) {
      return "Kolom 'sample_id' tidak ditemukan pada berkas CSV atau terdapat ID sampel yang tidak cocok antara berkas Genotipe dan Fenotipe.";
    }

    // Pembersihan kode teknis FastAPI/Pydantic
    s = s.replace(/^body\s*>\s*/i, '');
    s = s.replace(/^Value error,\s*/i, '');
    s = s.replace(/Expected UploadFile, received:\s*<class\s*'str'>/gi, 'Berkas belum diunggah atau tidak valid');
    s = s.replace(/Field required/gi, 'Bidang ini wajib diisi');
    s = s.replace(/Input should be a valid/gi, 'Format masukan harus berupa');
    s = s.replace(/<class\s*'[^']+'>/gi, 'tipe data tidak sesuai');

    return s;
  };

  if (typeof err === 'string') {
    return translateSingle(err);
  }

  if (typeof err === 'object') {
    const rawMessage = err.message || err.pesan || 'Terjadi kesalahan pada sistem.';
    const cleanMessage = translateSingle(rawMessage);
    const rawDetails = err.details || err.rincian || [];
    const cleanDetails = Array.isArray(rawDetails)
      ? rawDetails.map(translateSingle).filter(Boolean)
      : [];

    return {
      ...err,
      message: cleanMessage,
      pesan: cleanMessage,
      details: cleanDetails,
      rincian: cleanDetails,
    };
  }

  return err;
}

export class ApiError extends Error {
  constructor(message, status = 500, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = Array.isArray(details) ? details : details ? [String(details)] : [];
    this.pesan = message;
    this.rincian = this.details;
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
  const { timeoutMs = 15000, signal: externalSignal, ...fetchOptions } = options;
  const token = getStoredToken();
  const headers = new Headers(fetchOptions.headers || {});

  // Inject Bearer token if available
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // If body is NOT FormData and not explicitly set, default to JSON
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let controller = null;
  let timeoutId = null;
  let didTimeout = false;
  let effectiveSignal = externalSignal;

  if (timeoutMs > 0 && typeof AbortController !== 'undefined') {
    controller = new AbortController();
    effectiveSignal = controller.signal;
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }
    timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
  }

  const config = {
    ...fetchOptions,
    headers,
    ...(effectiveSignal ? { signal: effectiveSignal } : {}),
  };

  let abortRejectCleanup = null;
  let res;
  try {
    const fetchPromise = fetch(endpoint, config);
    if (effectiveSignal) {
      res = await new Promise((resolve, reject) => {
        if (effectiveSignal.aborted) {
          const abortErr = new Error('Aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
          return;
        }
        const onAbort = () => {
          const abortErr = new Error('Aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        };
        effectiveSignal.addEventListener('abort', onAbort, { once: true });
        abortRejectCleanup = () => effectiveSignal.removeEventListener('abort', onAbort);
        fetchPromise.then(resolve, reject);
      });
    } else {
      res = await fetchPromise;
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      const abortErr = new ApiError(
        didTimeout
          ? 'Permintaan melebihi batas waktu tunggu server (timeout).'
          : 'Permintaan dibatalkan.',
        didTimeout ? 408 : 0,
        [didTimeout ? `Batas waktu ${timeoutMs} ms terlampaui.` : 'Request aborted']
      );
      abortErr.isAborted = !didTimeout;
      abortErr.isTimeout = didTimeout;
      throw abortErr;
    }
    throw new ApiError(
      'Gagal terhubung ke server backend. Pastikan server aktif.',
      0,
      [err.message]
    );
  } finally {
    if (abortRejectCleanup) abortRejectCleanup();
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
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
        'Server backend di http://localhost:8000 sedang tidak aktif atau tidak dapat dihubungi.';
    }

    const toArray = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v.trim() ? [v] : []);

    if (data && typeof data === 'object') {
      // 1. Format galat khusus GWASena: { detail: { pesan, rincian } } atau top-level { pesan, rincian }
      if (data.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)) {
        message = data.detail.pesan || data.detail.message || message;
        details = toArray(data.detail.rincian || data.detail.details);
      } else if (data.pesan) {
        message = data.pesan;
        details = toArray(data.rincian || data.details);
      }
      // 2. Format standar FastAPI: { detail: "string" }
      else if (typeof data.detail === 'string') {
        message = data.detail;
      }
      // 3. Format validasi default FastAPI Pydantic: { detail: [{ msg, loc }] }
      else if (Array.isArray(data.detail)) {
        message = 'Format masukan data tidak valid atau berkas belum lengkap.';
        details = data.detail.map((d) => {
          const locStr = d.loc ? d.loc.join(' > ') : '';
          const fullMsg = `${locStr ? locStr + ': ' : ''}${d.msg || ''}`;
          // Terjemahkan langsung jika mengandung berkas genotipe/fenotipe
          if (locStr.includes('genotipe')) {
            return 'Berkas Genotipe (.vcf atau PLINK .bed/.bim/.fam) belum dipilih atau formatnya tidak sesuai.';
          }
          if (locStr.includes('fenotipe')) {
            return 'Berkas Fenotipe (.csv) belum dipilih atau tidak terbaca.';
          }
          return fullMsg;
        });
      } else if (data.message) {
        message = data.message;
        details = toArray(data.details || data.rincian);
      }
    }

    // Normalisasi dengan Human-Friendly Error Formatter
    const formatted = formatUserFriendlyError({ message, details });
    message = formatted.message;
    details = formatted.details;

    // Tangani 401 Unauthorized secara terpusat
    if (res.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/google')) {
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
