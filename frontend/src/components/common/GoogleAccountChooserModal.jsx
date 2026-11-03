import { useState } from 'react';
import { X, User, ArrowRight, Loader2, Sparkles, Check } from 'lucide-react';
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

const PRESET_ACCOUNTS = [
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
 * GoogleAccountChooserModal
 * Pemilih Akun Google Interaktif (Interactive Google Account Chooser)
 * Memungkinkan login 1-klik menggunakan akun Google cepat atau mengetikkan Gmail/Nama kustom.
 */
export default function GoogleAccountChooserModal({ isOpen, onClose, onSuccess }) {
  const { googleLogin, isLoading } = useAuthStore();
  const [error, setError] = useState(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');

  if (!isOpen) return null;

  const handleSelectAccount = async (account) => {
    setError(null);
    try {
      await googleLogin({
        email: account.email,
        name: account.name,
        google_sub: 'sim-google-' + btoa(account.email).replace(/=/g, ''),
      });
      onSuccess?.();
    } catch (err) {
      setError(err);
    }
  };

  const handleCustomSubmit = async (e) => {
    e.preventDefault();
    if (!customEmail.trim()) {
      setError('Mohon masukkan alamat email Google / Gmail.');
      return;
    }
    setError(null);
    try {
      const email = customEmail.trim();
      const name = customName.trim() || email.split('@')[0];
      await googleLogin({
        email,
        name,
        google_sub: 'custom-google-' + btoa(email).replace(/=/g, ''),
      });
      onSuccess?.();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-[#121B38] rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-white/10 space-y-5 animate-modal-in">
        {/* Header Dialog Google */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-sm">
              <GoogleIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-sans tracking-tight">
                Pilih Akun Google
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lanjutkan ke aplikasi GWASena
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ErrorMessageArea error={error} onDismiss={() => setError(null)} />

        {/* Daftar Akun Cepat */}
        {!showCustomForm ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pilih akun yang tersedia di perangkat ini:
            </p>

            <div className="space-y-2">
              {PRESET_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleSelectAccount(acc)}
                  className="w-full flex items-center gap-3.5 p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 hover:bg-blue-50/80 dark:hover:bg-[#5B4DFE]/15 hover:border-blue-400 dark:hover:border-[#06B6D4]/50 active:scale-[0.985] transition-all text-left group"
                >
                  <div
                    className={`h-10 w-10 rounded-full ${acc.avatarBg} text-white flex items-center justify-center text-sm font-bold shadow-sm shrink-0`}
                  >
                    {acc.initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white font-sans truncate group-hover:text-blue-600 dark:group-hover:text-[#06B6D4] transition-colors">
                      {acc.name}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      {acc.email}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-[#06B6D4] group-hover:translate-x-1 transition-all shrink-0" />
                </button>
              ))}
            </div>

            {/* Opsi Gunakan Akun Lain */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowCustomForm(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-slate-300 dark:border-white/20 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-[#06B6D4] transition-all"
              >
                <User className="h-4 w-4" />
                <span>Gunakan Akun Google / Gmail Lain</span>
              </button>
            </div>
          </div>
        ) : (
          /* Form Akun Kustom */
          <form onSubmit={handleCustomSubmit} className="space-y-3.5 animate-fade-in">
            <div>
              <label
                htmlFor="customEmail"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1"
              >
                Alamat Gmail / Google Workspace
              </label>
              <input
                id="customEmail"
                type="email"
                required
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="nama.anda@gmail.com"
                className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2.5 px-3.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
              />
            </div>

            <div>
              <label
                htmlFor="customName"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1"
              >
                Nama Lengkap Profil Google (Opsional)
              </label>
              <input
                id="customName"
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Contoh: Andi Pratama"
                className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2.5 px-3.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowCustomForm(false)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white font-medium"
              >
                &larr; Kembali ke daftar akun
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menghubungkan...</span>
                  </>
                ) : (
                  <>
                    <span>Lanjutkan Masuk</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer Aman Google */}
        <div className="pt-3 border-t border-slate-200 dark:border-white/10 text-center">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
            <Sparkles className="h-3 w-3 text-emerald-500" />
            <span>Terhubung langsung dengan sesi JWT aman platform GWASena</span>
          </p>
        </div>
      </div>
    </div>
  );
}
