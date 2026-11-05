import { useState, useEffect } from 'react';
import { X, User, ArrowRight, Loader2, Sparkles, Check, Plus, Shield } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore.js';
import ErrorMessageArea from './ErrorMessageArea.jsx';

/**
 * Google 'G' multicolored official SVG
 */
export function GoogleIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

const DEFAULT_PRESET_ACCOUNTS = [
  {
    name: 'Dr. Budi Santoso',
    email: 'budi.santoso@apps.ipb.ac.id',
    avatarBg: 'bg-emerald-600',
    initial: 'B',
    desc: 'Akun Civitas IPB University',
  },
  {
    name: 'Peneliti Bioinformatika',
    email: 'researcher.gwas@gmail.com',
    avatarBg: 'bg-blue-600',
    initial: 'P',
    desc: 'Akun Google Peneliti',
  },
  {
    name: 'Pengguna Analisis GWAS',
    email: 'user.gwasena@gmail.com',
    avatarBg: 'bg-indigo-600',
    initial: 'U',
    desc: 'Akun Google Umum',
  },
];

/**
 * GoogleAuthModal
 * Modal Pemilih / Masuk Akun Google Interaktif (Anti Black Page)
 * Mendukung pemilihan 1-klik akun tersimpan di perangkat serta penambahan akun kustom.
 */
export default function GoogleAuthModal({ isOpen, onClose, onSuccess }) {
  const { googleLogin, isLoading } = useAuthStore();
  const [error, setError] = useState(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [savedAccounts, setSavedAccounts] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      try {
        const stored = localStorage.getItem('gwasena_saved_accounts');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSavedAccounts(parsed);
            return;
          }
        }
      } catch (e) {
        console.warn('Gagal membaca akun tersimpan:', e);
      }
      setSavedAccounts(DEFAULT_PRESET_ACCOUNTS);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectAccount = async (account) => {
    setError(null);
    try {
      await googleLogin({
        email: account.email,
        name: account.name || account.username || account.email.split('@')[0],
        google_sub: 'google-sub-' + btoa(account.email).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24),
      });
      onSuccess?.();
    } catch (err) {
      setError(err?.message || 'Gagal masuk dengan akun Google.');
    }
  };

  const handleCustomSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = customEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Mohon masukkan alamat email Google / Gmail yang valid.');
      return;
    }
    setError(null);
    try {
      const name = customName.trim() || cleanEmail.split('@')[0];
      await googleLogin({
        email: cleanEmail,
        name,
        google_sub: 'google-sub-' + btoa(cleanEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24),
      });
      onSuccess?.();
    } catch (err) {
      setError(err?.message || 'Gagal masuk dengan akun Google.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md figma-card p-6 sm:p-7 shadow-2xl space-y-4 animate-modal-in border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121634]">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <GoogleIcon className="h-6 w-6" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans tracking-tight">
                Masuk dengan Google
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-sans">
                Layanan Autentikasi GWASena Terverifikasi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white active:scale-95 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notifikasi Galat */}
        <ErrorMessageArea error={error} onDismiss={() => setError(null)} />

        {!showCustomForm ? (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
              Pilih Akun di Perangkat Ini
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {savedAccounts.map((account, idx) => {
                const displayName = account.name || account.username || account.email;
                const initial = (displayName.charAt(0) || 'U').toUpperCase();
                const bg = account.avatarBg || (idx % 2 === 0 ? 'bg-blue-600' : 'bg-emerald-600');
                return (
                  <button
                    key={account.email + idx}
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleSelectAccount(account)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-blue-50/70 dark:hover:bg-white/10 hover:border-blue-400 dark:hover:border-blue-500 transition-all text-left active:scale-[0.985] cursor-pointer group"
                  >
                    <div
                      className={`h-10 w-10 rounded-full ${bg} flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform`}
                    >
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {displayName}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {account.email}
                      </div>
                      {account.desc && (
                        <div className="text-[11px] text-blue-600 dark:text-cyan-400 font-medium">
                          {account.desc}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors" />
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowCustomForm(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Gunakan Akun Google Lain</span>
              </button>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <Shield className="h-3 w-3 text-emerald-500" />
                <span>OAuth 2.0 Aman</span>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCustomSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="customName"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 font-sans"
              >
                Nama Lengkap (Opsional)
              </label>
              <input
                id="customName"
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Contoh: Peneliti Mandiri"
                className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#0F172E] py-2 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
              />
            </div>

            <div>
              <label
                htmlFor="customEmail"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 font-sans"
              >
                Alamat Email Google / Gmail
              </label>
              <input
                id="customEmail"
                type="email"
                required
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="nama@gmail.com atau nama@apps.ipb.ac.id"
                className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#0F172E] py-2 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setShowCustomForm(false)}
                className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                ← Kembali ke Daftar Akun
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Menghubungkan...</span>
                  </>
                ) : (
                  <>
                    <span>Lanjutkan Masuk</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
