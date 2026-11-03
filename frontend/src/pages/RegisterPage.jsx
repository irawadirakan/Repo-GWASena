import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, Mail, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore.js';
import ErrorMessageArea from '../components/common/ErrorMessageArea.jsx';
import GoogleAccountChooserModal, { GoogleIcon } from '../components/common/GoogleAccountChooserModal.jsx';

/**
 * RegisterPage (Pendaftaran Akun Pengguna - Figma Aligned)
 * Acuan: 02 — Register.png, 02 — Register (Light).png
 * Kontrak Skema: RegisterIn (username: 3-50, email: max 120, password: min 8)
 * Fitur: Registrasi Manual & Registrasi Instan via Akun Google OAuth E2E.
 */
export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    // Validasi Sisi Klien
    const usernameRegex = /^[A-Za-z0-9_.-]+$/;
    if (!usernameRegex.test(cleanUsername)) {
      setError({
        message: 'Format nama pengguna tidak valid.',
        details: [
          'Hanya boleh mengandung huruf, angka, garis bawah (_), titik (.), atau tanda hubung (-).',
          'Panjang antara 3 hingga 50 karakter.',
        ],
      });
      return;
    }

    if (password.length < 8) {
      setError('Kata sandi harus memiliki panjang minimal 8 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok dengan kata sandi yang dimasukkan.');
      return;
    }

    try {
      await register(cleanUsername, cleanEmail, password);

      // Tandai intro selesai dan arahkan ke login dengan membawa banner sukses
      localStorage.setItem('gwasena_intro_completed', 'true');
      navigate('/login', {
        state: { registered: true, username: cleanUsername },
        replace: true,
      });
    } catch (err) {
      setError(err);
    }
  };

  const handleGoogleSuccess = () => {
    setIsGoogleModalOpen(false);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="w-full max-w-md animate-fade-in py-2">
      <div className="figma-card p-7 sm:p-9">
        {/* Header Form */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
            Buat Akun Baru
          </h1>
          <p className="mt-1.5 font-serif text-sm text-slate-600 dark:text-slate-300">
            Bergabunglah dengan platform analisis asosiasi genomik terpadu GWASena
          </p>
        </div>

        {/* Kotak Galat Pesan Figma Message Banner */}
        <ErrorMessageArea error={error} onDismiss={() => setError(null)} className="mb-4" />

        {/* Tombol Daftar Cepat dengan Google */}
        <div className="mb-4">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setIsGoogleModalOpen(true)}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#162142] hover:bg-slate-50 dark:hover:bg-[#1E2C58] text-slate-800 dark:text-white font-semibold text-sm shadow-sm hover:shadow transition-all active:scale-[0.985] cursor-pointer"
          >
            <GoogleIcon className="h-5 w-5" />
            <span>Daftar dengan Google</span>
          </button>
        </div>

        {/* Pemisah Garis 'atau' */}
        <div className="relative flex py-1 items-center mb-4">
          <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
          <span className="flex-shrink mx-3 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
            atau isi formulir pendaftaran
          </span>
          <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
        </div>

        {/* Form Registrasi */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Kolom Username */}
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1"
            >
              Username
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
                minLength={3}
                maxLength={50}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="user_gwas"
                className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2 pl-10 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] transition-all font-medium"
              />
            </div>
            <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300 font-medium">
              3–50 karakter (huruf, angka, _, ., -)
            </span>
          </div>

          {/* Kolom Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1"
            >
              Alamat Email
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Mail className="h-4 w-4" />
              </span>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={120}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@email.com"
                className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2 pl-10 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] transition-all font-medium"
              />
            </div>
          </div>

          {/* Kolom Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1"
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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2 pl-10 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] transition-all font-medium"
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

          {/* Kolom Konfirmasi Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1"
            >
              Konfirmasi Kata Sandi
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="h-4 w-4" />
              </span>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi"
                className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2 pl-10 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] transition-all font-medium"
              />
            </div>
          </div>

          {/* Tombol Submit Registrasi */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 figma-btn-primary py-3 text-sm sm:text-base cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Mendaftarkan akun...</span>
              </>
            ) : (
              <>
                <span>Daftar Akun</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {/* Opsi Akses Demo Instan */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
            <span className="flex-shrink mx-2 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 font-bold">
              atau mode pengujian
            </span>
            <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full figma-btn-secondary py-2.5 text-xs sm:text-sm font-bold cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-[#0284C7] dark:text-[#06B6D4]" />
            <span>Gunakan Akun Demo di Layar Masuk &rarr;</span>
          </button>
        </form>

        {/* Footer Kartu Form */}
        <div className="mt-5 border-t border-slate-200 dark:border-white/10 pt-3.5 text-center">
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
            Sudah memiliki akun?{' '}
            <Link
              to="/login"
              className="font-bold text-[#0284C7] dark:text-[#06B6D4] hover:underline transition-colors"
            >
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>

      {/* Modal Pemilih Akun Google Interaktif */}
      <GoogleAccountChooserModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onSuccess={handleGoogleSuccess}
      />
    </div>
  );
}
