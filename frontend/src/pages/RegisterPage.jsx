import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, Mail, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore.js';
import ErrorMessageArea from '../components/common/ErrorMessageArea.jsx';

/**
 * RegisterPage (Pendaftaran Akun Peneliti - Figma Aligned)
 * Acuan: 02 — Register.png, 02 — Register (Light).png
 * Kontrak Skema: RegisterIn (username: 3-50, email: max 120, password: min 8)
 */
export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);

  // Validasi Real-time (Evaluasi Tester Poin 1 & 2)
  const cleanUsername = username.trim();
  const usernameRegex = /^[A-Za-z0-9_.-]{3,50}$/;
  const isUsernameValid = cleanUsername.length === 0 || usernameRegex.test(cleanUsername);

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const dummyEmailPatterns = [
    'test@test.com', 'blablabla@gmail.com', '123@gmail.com', 'asdf@gmail.com',
    'abc@xyz.com', 'admin@admin.com', 'user@user.com', 'fake@gmail.com'
  ];
  const isDummyEmail = dummyEmailPatterns.includes(cleanEmail) || /^(test|blabla|1234?5?|asdf|qwerty|dummy|fake)@/i.test(cleanEmail);
  const isEmailFormatValid = emailRegex.test(cleanEmail);
  const isEmailAcceptable = cleanEmail.length === 0 || (isEmailFormatValid && !isDummyEmail);

  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const isPasswordValid = password.length === 0 || (password.length >= 8 && hasLetter && hasNumber);
  const isPasswordMatch = confirmPassword.length === 0 || (password === confirmPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    // Validasi Sisi Klien (Evaluasi Tester Poin 1 & 2)
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

    if (!emailRegex.test(cleanEmail) || isDummyEmail) {
      setError({
        message: 'Alamat email tidak valid atau domain percobaan.',
        details: [
          'Pastikan alamat email berformat sah (contoh: peneliti@apps.ipb.ac.id).',
          'Alamat email sementara/dummy (seperti test@test.com atau blablabla@gmail.com) tidak diizinkan.',
        ],
      });
      return;
    }

    if (password.length < 8 || !hasLetter || !hasNumber) {
      setError('Kata sandi minimal 8 karakter dan wajib kombinasi huruf serta angka.');
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

  return (
    <div className="w-full max-w-md animate-fade-in py-2">
      <div className="figma-card p-7 sm:p-9">
        {/* Header Form */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
            Buat Akun Baru
          </h1>
          <p className="mt-1.5 font-serif text-sm text-slate-600 dark:text-slate-300">
            Daftarkan akun Anda untuk mulai melakukan analisis genomik terpadu di GWASena.
          </p>
        </div>

        {/* Kotak Galat Pesan Figma Message Banner */}
        <ErrorMessageArea error={error} onDismiss={() => setError(null)} className="mb-4" />

        {/* Form Registrasi */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Kolom Username (Real-time Validation) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="username"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Username
              </label>
              {cleanUsername.length > 0 && (
                <span className={`text-[11px] font-bold ${isUsernameValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {isUsernameValid ? '✓ Username valid' : '✗ 3–50 karakter (huruf, angka, _, ., -)'}
                </span>
              )}
            </div>
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
                placeholder="peneliti_ipb"
                className={`w-full rounded-xl border ${cleanUsername.length > 0 && !isUsernameValid ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300 dark:border-white/10'} bg-[#F1F4FD] dark:bg-[#0F172E] py-2 pl-10 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] transition-all font-medium`}
              />
            </div>
            <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300 font-medium">
              3–50 karakter (huruf, angka, _, ., -)
            </span>
          </div>

          {/* Kolom Email (Real-time Disposable/Dummy Check) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Alamat Email
              </label>
              {cleanEmail.length > 0 && (
                <span className={`text-[11px] font-bold ${isEmailAcceptable && isEmailFormatValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {isDummyEmail
                    ? '✗ Email dummy/percobaan tidak diizinkan'
                    : isEmailFormatValid
                    ? '✓ Format email valid'
                    : '✗ Format email tidak sah'}
                </span>
              )}
            </div>
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
                placeholder="peneliti@apps.ipb.ac.id"
                className={`w-full rounded-xl border ${cleanEmail.length > 0 && !isEmailAcceptable ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300 dark:border-white/10'} bg-[#F1F4FD] dark:bg-[#0F172E] py-2 pl-10 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] transition-all font-medium`}
              />
            </div>
            <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300 font-medium">
              Gunakan email institusi / pribadi yang sah (1 akun per email)
            </span>
          </div>

          {/* Kolom Password (Kekuatan Sandi: Min 8 Karakter & Kombinasi Huruf + Angka) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Kata Sandi
              </label>
              {password.length > 0 && (
                <span className={`text-[11px] font-bold ${password.length >= 8 && hasLetter && hasNumber ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {password.length >= 8 && hasLetter && hasNumber ? '✓ Sandi kuat' : '✗ Min. 8 karakter (huruf & angka)'}
                </span>
              )}
            </div>
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
                placeholder="Minimal 8 karakter kombinasi huruf & angka"
                className={`w-full rounded-xl border ${password.length > 0 && !isPasswordValid ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300 dark:border-white/10'} bg-[#F1F4FD] dark:bg-[#0F172E] py-2 pl-10 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] transition-all font-medium`}
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

          {/* Kolom Konfirmasi Password (Dengan Ikon Mata Independen & Real-time Matching) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Konfirmasi Kata Sandi
              </label>
              {confirmPassword.length > 0 && (
                <span className={`text-[11px] font-bold ${password === confirmPassword ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {password === confirmPassword ? '✓ Sandi cocok' : '✗ Tidak cocok'}
                </span>
              )}
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="h-4 w-4" />
              </span>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi"
                className={`w-full rounded-xl border ${confirmPassword.length > 0 && password !== confirmPassword ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300 dark:border-white/10'} bg-[#F1F4FD] dark:bg-[#0F172E] py-2 pl-10 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] transition-all font-medium`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi kata sandi' : 'Tampilkan konfirmasi kata sandi'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Tombol Submit Registrasi (Figma Primary CTA #5B4DFE) */}
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
                <span>Daftar Akun Sekarang</span>
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
            <span>Gunakan Akun Peneliti Demo di Layar Masuk &rarr;</span>
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
    </div>
  );
}
