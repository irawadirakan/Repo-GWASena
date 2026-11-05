import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  Mail,
  ArrowRight,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Send,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore.js';
import ErrorMessageArea from '../components/common/ErrorMessageArea.jsx';
import GoogleAuthModal, { GoogleIcon } from '../components/common/GoogleAuthModal.jsx';

const DUMMY_PREFIXES = ['blablabla', 'test', 'dummy', 'abc', '123', 'asdf', 'user'];
const DISPOSABLE_DOMAINS = ['mailinator.com', 'tempmail.com', 'example.com', 'throwaway.com', 'guerrillamail.com'];

/**
 * RegisterPage (Pendaftaran Akun Pengguna - Figma Aligned)
 * Memenuhi Bagian 2: Validasi real-time Bahasa Indonesia, checklist password, ikon mata ganda,
 * deteksi email dummy, dan modal verifikasi kode 6-digit.
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
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);

  // State untuk Modal Verifikasi Kode 6-Digit
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [verifyError, setVerifyError] = useState(null);
  const [showSimulatedEmailToast, setShowSimulatedEmailToast] = useState(false);

  // Kriteria Kata Sandi Real-time
  const passwordCriteria = useMemo(() => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: (password.match(/\d/g) || []).length >= 2,
    };
  }, [password]);

  const isPasswordValid =
    passwordCriteria.length &&
    passwordCriteria.uppercase &&
    passwordCriteria.lowercase &&
    passwordCriteria.numbers;

  // Validasi Username Real-time
  const usernameError = useMemo(() => {
    if (!username) return null;
    const clean = username.trim();
    if (clean.length < 3) return 'Username minimal 3 karakter.';
    if (clean.length > 50) return 'Username maksimal 50 karakter.';
    if (!/^[A-Za-z0-9_.-]+$/.test(clean)) {
      return 'Hanya boleh berisi huruf, angka, garis bawah (_), titik (.), atau strip (-).';
    }
    return null;
  }, [username]);

  // Validasi Email Real-time (termasuk pola dummy)
  const emailError = useMemo(() => {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    const parts = clean.split('@');
    if (parts.length !== 2 || !parts[1].includes('.')) {
      return 'Format alamat email belum valid (contoh: nama@instansi.ac.id).';
    }
    const prefix = parts[0];
    const domain = parts[1];

    for (const p of DUMMY_PREFIXES) {
      if (
        prefix === p ||
        prefix.startsWith(`${p}_`) ||
        prefix.startsWith(`${p}.`) ||
        prefix.startsWith(`${p}1`) ||
        prefix.startsWith(`${p}2`)
      ) {
        return 'Alamat email dummy atau percobaan tidak diizinkan. Gunakan email institusi atau email resmi.';
      }
    }

    for (const d of DISPOSABLE_DOMAINS) {
      if (domain === d || domain.endsWith('.' + d)) {
        return 'Domain email sementara/disposable tidak diizinkan. Gunakan email aktif yang sah.';
      }
    }

    return null;
  }, [email]);

  // Validasi Konfirmasi Sandi Real-time
  const confirmPasswordError = useMemo(() => {
    if (!confirmPassword) return null;
    if (confirmPassword !== password) {
      return 'Konfirmasi kata sandi belum cocok dengan kata sandi di atas.';
    }
    return null;
  }, [confirmPassword, password]);

  const canSubmit =
    username.trim().length >= 3 &&
    !usernameError &&
    email.trim() &&
    !emailError &&
    isPasswordValid &&
    confirmPassword &&
    !confirmPasswordError;

  // Inisiasi langkah verifikasi kode
  const handleInitiateRegister = (e) => {
    e.preventDefault();
    setError(null);

    if (usernameError || emailError || confirmPasswordError) {
      setError('Mohon perbaiki isian formulir yang belum sesuai sebelum mendaftar.');
      return;
    }
    if (!isPasswordValid) {
      setError('Kata sandi belum memenuhi seluruh kriteria keamanan.');
      return;
    }

    // Bangkitkan kode verifikasi 6 digit acak
    const generatedCode = String(Math.floor(100000 + Math.random() * 900000));
    setVerificationCode(generatedCode);
    setInputCode('');
    setVerifyError(null);
    setIsVerifyModalOpen(true);
    setShowSimulatedEmailToast(true);
  };

  // Konfirmasi kode verifikasi dan eksekusi registrasi ke backend
  const handleVerifyAndSubmit = async (e) => {
    e.preventDefault();
    setVerifyError(null);

    if (inputCode.trim() !== verificationCode) {
      setVerifyError('Kode verifikasi yang Anda masukkan tidak cocok. Silakan periksa kembali.');
      return;
    }

    try {
      await register(username.trim(), email.trim().toLowerCase(), password);

      // Tandai intro selesai dan arahkan ke login dengan membawa banner sukses
      localStorage.setItem('gwasena_intro_completed', 'true');
      setIsVerifyModalOpen(false);
      navigate('/login', {
        state: { registered: true, username: username.trim() },
        replace: true,
      });
    } catch (err) {
      setVerifyError(err?.message || 'Gagal mendaftarkan akun. Silakan coba kembali.');
    }
  };

  const handleGoogleSuccess = () => {
    setIsGoogleModalOpen(false);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="w-full max-w-md animate-fade-in py-2">
      {/* Toast Simulasi Kotak Masuk Email Verifikasi */}
      {showSimulatedEmailToast && (
        <div className="fixed top-5 right-5 z-[100] max-w-sm rounded-2xl border border-blue-300 dark:border-blue-500/40 bg-white dark:bg-slate-900 p-4 shadow-2xl animate-dropdown-in">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-cyan-400">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-600 dark:text-cyan-400">
                  Simulasi Email GWASena
                </span>
                <button
                  type="button"
                  onClick={() => setShowSimulatedEmailToast(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ×
                </button>
              </div>
              <p className="mt-0.5 text-xs text-slate-800 dark:text-slate-200 font-semibold truncate">
                Kepada: {email}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Kode verifikasi pendaftaran akun Anda adalah:{' '}
                <strong className="font-mono text-sm tracking-wider text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  {verificationCode}
                </strong>
              </p>
            </div>
          </div>
        </div>
      )}

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

        {/* Kotak Galat Pesan */}
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
        <form onSubmit={handleInitiateRegister} className="space-y-3.5">
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
                className={`w-full rounded-xl border py-2 pl-10 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 transition-all font-medium ${
                  usernameError
                    ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] focus:border-[#5B4DFE] focus:ring-[#5B4DFE]'
                }`}
              />
            </div>
            {usernameError ? (
              <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400 font-medium">
                {usernameError}
              </span>
            ) : (
              <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300 font-medium">
                Wajib 3–50 karakter (huruf, angka, _, ., -)
              </span>
            )}
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
                placeholder="nama@instansi.ac.id atau nama@gmail.com"
                className={`w-full rounded-xl border py-2 pl-10 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 transition-all font-medium ${
                  emailError
                    ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] focus:border-[#5B4DFE] focus:ring-[#5B4DFE]'
                }`}
              />
            </div>
            {emailError ? (
              <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400 font-medium">
                {emailError}
              </span>
            ) : (
              <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300 font-medium">
                Gunakan alamat email valid dan aktif (contoh: nama@apps.ipb.ac.id atau nama@gmail.com)
              </span>
            )}
          </div>

          {/* Kolom Password & Checklist Indikator Real-time */}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2 pl-10 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Checklist Indikator Kriteria Kata Sandi Real-time */}
            <div className="mt-2 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 space-y-1 text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 font-sans">
                Kriteria Keamanan Kata Sandi:
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div
                  className={`flex items-center gap-1.5 font-medium ${
                    passwordCriteria.length
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {passwordCriteria.length ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-400 inline-block shrink-0" />
                  )}
                  <span>Min. 8 karakter</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 font-medium ${
                    passwordCriteria.uppercase
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {passwordCriteria.uppercase ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-400 inline-block shrink-0" />
                  )}
                  <span>Min. 1 huruf besar</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 font-medium ${
                    passwordCriteria.lowercase
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {passwordCriteria.lowercase ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-400 inline-block shrink-0" />
                  )}
                  <span>Min. 1 huruf kecil</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 font-medium ${
                    passwordCriteria.numbers
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {passwordCriteria.numbers ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-400 inline-block shrink-0" />
                  )}
                  <span>Min. 2 angka</span>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Konfirmasi Password dengan Ikon Mata */}
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
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi"
                className={`w-full rounded-xl border py-2 pl-10 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 transition-all font-medium ${
                  confirmPasswordError
                    ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] focus:border-[#5B4DFE] focus:ring-[#5B4DFE]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi sandi' : 'Tampilkan konfirmasi sandi'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPasswordError ? (
              <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400 font-medium">
                {confirmPasswordError}
              </span>
            ) : (
              <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300 font-medium">
                Harus cocok persis dengan kata sandi di atas
              </span>
            )}
          </div>

          {/* Tombol Submit Registrasi */}
          <button
            type="submit"
            disabled={isLoading || !canSubmit}
            className="w-full mt-2 figma-btn-primary py-3 text-sm sm:text-base cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Mendaftarkan akun...</span>
              </>
            ) : (
              <>
                <span>Lanjutkan ke Verifikasi Kode</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
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

      {/* Modal Verifikasi Kode Akun Instan 6 Digit */}
      {isVerifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md figma-card p-6 sm:p-7 shadow-2xl space-y-4 animate-modal-in border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121634]">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-cyan-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-sans">
                Verifikasi Alamat Email
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-serif">
                Masukkan 6 digit kode verifikasi yang telah dikirimkan ke:{' '}
                <strong className="text-slate-900 dark:text-white block font-sans">{email}</strong>
              </p>
            </div>

            {verifyError && (
              <div className="p-3 rounded-xl border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/20 text-xs text-rose-700 dark:text-rose-400 font-medium">
                {verifyError}
              </div>
            )}

            <form onSubmit={handleVerifyAndSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="------"
                  className="w-full text-center tracking-[0.5em] font-mono text-2xl font-bold rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#0F172E] py-3 text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                <div className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                  Periksa notifikasi simulasi email di pojok kanan atas layar.
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowSimulatedEmailToast(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Kirim Ulang Kode</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsVerifyModalOpen(false)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || inputCode.length !== 6}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    <span>Konfirmasi & Buat Akun</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pemilih Akun Google Interaktif */}
      <GoogleAuthModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onSuccess={handleGoogleSuccess}
      />
    </div>
  );
}
