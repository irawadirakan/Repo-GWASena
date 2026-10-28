import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, ArrowRight, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore.js';
import ErrorMessageArea from '../components/common/ErrorMessageArea.jsx';

/**
 * S-01: LoginPage (Autentikasi Pengguna - Figma Aligned)
 * Acuan: 01 — Login.png, 01 — Login (Light).png, 01b — Login_ Kredensial Salah.png
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();

  // Ambil state pendaftaran jika pengguna baru dialihkan dari S-02
  const registeredSuccess = location.state?.registered;
  const prefilledUsername = location.state?.username || '';

  const [username, setUsername] = useState(prefilledUsername);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Mohon isi nama pengguna/email dan kata sandi Anda.');
      return;
    }

    try {
      await login(username.trim(), password);

      // Arahkan ke rute awal jika sebelumnya dialihkan oleh ProtectedRoute (AC-01.3)
      const destination = location.state?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });
    } catch (err) {
      // Tangani galat kredensial salah (401) atau galat lainnya
      setError(err);
    }
  };

  return (
    <div className="w-full max-w-md animate-fade-in">
      <div className="figma-card p-7 sm:p-9">
        {/* Header Form */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
            Masuk ke Akun
          </h1>
          <p className="mt-1.5 font-serif text-sm text-slate-600 dark:text-slate-300">
            Masukkan kredensial akun peneliti Anda untuk melanjutkan riset
          </p>
        </div>

        {/* Banner Registrasi Sukses */}
        {registeredSuccess && (
          <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Akun berhasil dibuat. Silakan masukkan kata sandi Anda untuk masuk.</span>
          </div>
        )}

        {/* Kotak Pesan Galat Figma Message Banner */}
        <ErrorMessageArea error={error} onDismiss={() => setError(null)} className="mb-4" />

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Kolom Username / Email */}
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Username atau Alamat Email
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <User className="h-4 w-4" />
              </span>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="peneliti atau email@apps.ipb.ac.id"
                className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2.5 pl-10 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] transition-all font-medium"
              />
            </div>
          </div>

          {/* Kolom Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Kata Sandi
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="h-4 w-4" />
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2.5 pl-10 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Opsi Ingat Sesi */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-400 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-[#5B4DFE] focus:ring-[#5B4DFE]/40"
              />
              <span>Ingat sesi saya di perangkat ini</span>
            </label>
          </div>

          {/* Tombol Masuk Submit (Figma Primary CTA #5B4DFE with Tactile Micro-Interactions) */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#5B4DFE] py-3 text-sm font-bold text-white shadow-lg shadow-[#5B4DFE]/30 hover:bg-[#4F46E5] hover:-translate-y-[1px] hover:shadow-xl active:scale-[0.97] active:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#5B4DFE]/50 transition-all duration-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Memverifikasi kredensial...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Akun</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {/* Opsi Akses Demo Instan (Pengujian UI & Backend Offline) */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
            <span className="flex-shrink mx-2 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              atau mode pengujian
            </span>
            <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
          </div>

          <button
            type="button"
            onClick={async () => {
              try {
                await login('peneliti_ipb', 'password123');
                navigate('/dashboard');
              } catch (e) {
                console.error(e);
              }
            }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#162142] py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1E2C58] hover:-translate-y-[1px] hover:shadow-md active:scale-[0.97] active:brightness-95 transition-all duration-100 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#06B6D4]" />
            <span>Masuk Cepat (Akun Peneliti Demo)</span>
          </button>
        </form>

        {/* Footer Kartu Form */}
        <div className="mt-6 border-t border-slate-200 dark:border-white/10 pt-4 text-center space-y-2">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Belum memiliki akun peneliti?{' '}
            <Link
              to="/register"
              className="font-semibold text-[#5B4DFE] dark:text-[#06B6D4] hover:underline transition-colors"
            >
              Daftar di sini
            </Link>
          </p>

          <div>
            <Link
              to="/welcome"
              className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-500 hover:text-[#5B4DFE] dark:hover:text-[#06B6D4] transition-colors"
            >
              <span>✨ Lihat Pengenalan GWASena</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
