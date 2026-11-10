import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, ArrowRight, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore.js';
import ErrorMessageArea from '../components/common/ErrorMessageArea.jsx';

/**
 * LoginPage (Autentikasi Pengguna - Figma Aligned)
 * Acuan: 01 — Login.png, 01 — Login (Light).png, 01b — Login_ Kredensial Salah.png
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();

  // Ambil state pendaftaran jika pengguna baru dialihkan dari registrasi
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

      // Tandai bahwa pengguna sudah pernah login di peramban ini
      if (typeof window !== 'undefined') {
        localStorage.setItem('gwasena_has_logged_in', 'true');
      }

      // Arahkan ke rute awal jika sebelumnya dialihkan oleh ProtectedRoute
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
            Masuk ke GWASena
          </h1>
          <p className="mt-1.5 font-serif text-sm text-slate-600 dark:text-slate-300">
            Masukkan kredensial akun Anda untuk mengakses platform analisis.
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

          {/* Tombol Masuk Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full figma-btn-primary py-3 text-sm sm:text-base cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Memverifikasi kredensial...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {/* Opsi Akses Demo Instan */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
            <span className="flex-shrink mx-2 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 font-bold">
              Ingin coba GWASena?
            </span>
            <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={async () => {
              setError(null);
              try {
                await login('peneliti_ipb', 'password123');
                if (typeof window !== 'undefined') {
                  localStorage.setItem('gwasena_has_logged_in', 'true');
                }
                navigate('/dashboard');
              } catch (e) {
                setError(e);
              }
            }}
            className="w-full figma-btn-secondary py-2.5 text-xs sm:text-sm font-bold cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-[#0284C7] dark:text-[#06B6D4]" />
            <span>Masuk Akun Peneliti Terdaftar</span>
          </button>
        </form>

        {/* Footer Kartu Form */}
        <div className="mt-6 border-t border-slate-200 dark:border-white/10 pt-4 text-center space-y-2">
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
            Belum memiliki akun?{' '}
            <Link
              to="/register"
              className="font-bold text-[#0284C7] dark:text-[#06B6D4] hover:underline transition-colors"
            >
              Daftar di sini
            </Link>
          </p>

          <div>
            <Link
              to="/welcome"
              className="inline-flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300 hover:text-[#0284C7] dark:hover:text-[#06B6D4] transition-colors font-semibold"
            >
              <span>✨ Lihat Pengenalan GWASena</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
