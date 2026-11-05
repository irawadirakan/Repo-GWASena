import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  LogOut,
  User as UserIcon,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Menu,
  X,
  Wifi,
  WifiOff,
  UserPlus,
  Settings,
  ShieldCheck,
  Check,
} from 'lucide-react';
import BrandLogo from '../components/common/BrandLogo.jsx';
import FigmaThemeToggle from '../components/common/FigmaThemeToggle.jsx';
import GoogleAuthModal from '../components/common/GoogleAuthModal.jsx';
import { useAuthStore } from '../store/useAuthStore.js';
import { analysisService } from '../services/analysisService.js';

/**
 * AppLayout - Layout Aplikasi Terproteksi Sesuai Desain Figma & Google Account Switcher
 * Menyediakan navigasi utama, status bar sistem real-time, dan dropdown akun ala Google Chrome solid.
 */
export default function AppLayout() {
  const navigate = useNavigate();
  const { user, logout, switchAccount } = useAuthStore();

  const [health, setHealth] = useState(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState([]);

  const accountMenuRef = useRef(null);

  // Close account menu on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pantau status konektivitas internet real-time (navigator.onLine)
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Periksa status kesehatan backend secara berkala (setiap 15 detik)
  useEffect(() => {
    let isMounted = true;
    async function fetchHealth() {
      try {
        const data = await analysisService.checkHealth();
        if (isMounted) setHealth(data);
      } catch {
        if (isMounted) setHealth({ status: 'disconnected', components: {} });
      }
    }
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Muat akun tersimpan dari localStorage saat dropdown dibuka
  useEffect(() => {
    if (accountMenuOpen) {
      try {
        const raw = localStorage.getItem('gwasena_saved_accounts');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            setSavedAccounts(list);
            return;
          }
        }
      } catch (e) {
        console.warn('Gagal membaca akun tersimpan:', e);
      }
      setSavedAccounts([]);
    }
  }, [accountMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSelectAccountToSwitch = (acc) => {
    if (acc.email === user?.email) return;
    switchAccount(acc);
    setAccountMenuOpen(false);
  };

  const handleGoogleSuccess = () => {
    setIsGoogleModalOpen(false);
    setAccountMenuOpen(false);
    navigate('/dashboard');
  };

  // Indikator aktif bila internet online dan status backend ok
  const isBackendOk = health?.status === 'ok';
  const isDegraded = health?.status === 'degraded';
  const isSystemActive = isOnline && isBackendOk;

  return (
    <div className="relative z-10 min-h-screen bg-transparent text-slate-900 dark:text-white flex flex-col font-sans antialiased">
      {/* ── App Topbar / Header (Floating Liquid Glass) ── */}
      <header className="sticky top-0 z-40 glass-navbar px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between h-16">
          {/* Sisi Kiri: Logo Resmi GWASena */}
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="focus:outline-none transition-transform hover:scale-[1.02]">
              <BrandLogo size="md" />
            </Link>

            {/* Navigasi Utama di Tengah */}
            <nav className="hidden md:flex items-center gap-6" aria-label="Navigasi Utama">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `text-sm font-semibold tracking-tight transition-all ${
                    isActive
                      ? 'text-[#5B4DFE] dark:text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                Dashboard
              </NavLink>

              <NavLink
                to="/history"
                className={({ isActive }) =>
                  `text-sm font-semibold tracking-tight transition-all ${
                    isActive
                      ? 'text-[#5B4DFE] dark:text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                Riwayat Analisis
              </NavLink>
            </nav>
          </div>

          {/* Sisi Kanan: Status Website ("Sistem Aktif"), Theme Switch Pill, & User Dropdown */}
          <div className="hidden md:flex items-center gap-4">
            {/* Status Website Indicator Real-Time */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsHealthOpen(!isHealthOpen)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all duration-100 cursor-pointer active:scale-95 ${
                  isSystemActive
                    ? 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60'
                    : 'border-rose-300 dark:border-rose-500/30 bg-rose-50/90 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60'
                }`}
                title="Status Koneksi & Layanan Sistem"
              >
                <span className="relative flex h-2 w-2">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isSystemActive ? 'bg-emerald-500 animate-ping' : 'bg-rose-500 animate-pulse'
                    }`}
                  />
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${
                      isSystemActive ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                </span>
                <span className="hidden xl:inline font-semibold">
                  {isSystemActive ? 'Sistem Aktif • Siap Analisis' : 'Koneksi Terputus • Analisis Nonaktif'}
                </span>
                {isSystemActive ? (
                  <Wifi className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                )}
              </button>

              {/* Popover Detail Status Sistem */}
              {isHealthOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 p-4 z-[100] origin-top-right rounded-2xl animate-dropdown-in text-xs text-slate-800 dark:text-slate-200 shadow-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-2.5 font-bold text-slate-900 dark:text-white">
                    <span className="flex items-center gap-1.5">
                      <Activity className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                      <span>Status Layanan GWASena</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsHealthOpen(false)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Jaringan Internet:</span>
                      <span className="flex items-center gap-1 font-semibold">
                        {isOnline ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Online (Terhubung)
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" /> Offline
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Server Komputasi:</span>
                      <span className="flex items-center gap-1 font-semibold">
                        {isBackendOk ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Siap / Online
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" /> Tidak Terjangkau
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Basis Data & Storage:</span>
                      <span className="flex items-center gap-1 font-semibold">
                        {health?.components?.database?.ok || isBackendOk ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Terhubung (PostgreSQL)
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" /> Siaga Lokal
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle Pill */}
            <FigmaThemeToggle />

            {/* User Button Pill & Dropdown Ala Google Account Switcher */}
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                className="flex items-center gap-2 rounded-full border border-slate-300 dark:border-white/10 bg-white dark:bg-[#162142]/80 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-[#1E2C58] active:scale-95 transition-all duration-100 shadow-sm cursor-pointer"
                aria-expanded={accountMenuOpen}
              >
                {/* Avatar Bulat Bergradien */}
                <span className="h-6 w-6 rounded-full bg-gradient-to-tr from-[#38BDF8] via-[#6366F1] to-[#818CF8] flex items-center justify-center text-white text-xs font-bold shadow-inner">
                  {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </span>

                <span className="text-sm font-bold text-slate-900 dark:text-white max-w-[120px] truncate">
                  {user?.username || 'Pengguna'}
                </span>

                {accountMenuOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </button>

              {/* Account Dropdown Menu Ala Google Chrome / Switcher (Solid Peat & Z-100) */}
              {accountMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 p-4 z-[100] origin-top-right rounded-3xl animate-dropdown-in text-sm shadow-2xl border border-slate-200 dark:border-slate-700">
                  {/* Bagian Atas: Avatar Besar, Username, Email, & Badge Peran */}
                  <div className="flex flex-col items-center text-center pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl font-extrabold shadow-md mb-2">
                      {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                    </div>

                    <h4 className="font-bold text-base text-slate-900 dark:text-white max-w-[240px] truncate">
                      {user?.username || 'Pengguna Analisis'}
                    </h4>

                    <p className="text-xs text-slate-600 dark:text-slate-400 max-w-[240px] truncate font-sans">
                      {user?.email || 'user@email.com'}
                    </p>

                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-3 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      <ShieldCheck className="h-3 w-3" />
                      <span>{user?.role === 'administrator' ? 'Administrator' : 'Pengguna Analisis'}</span>
                    </span>
                  </div>

                  {/* Bagian Tengah: Daftar Akun di Perangkat Ini */}
                  <div className="py-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
                      Akun di Perangkat Ini
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {savedAccounts.length > 0 ? (
                        savedAccounts.map((acc, i) => {
                          const isCurrent = acc.email === user?.email;
                          const name = acc.name || acc.username || acc.email;
                          const initial = name.charAt(0).toUpperCase();
                          return (
                            <button
                              key={acc.email + i}
                              type="button"
                              onClick={() => handleSelectAccountToSwitch(acc)}
                              className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all ${
                                isCurrent
                                  ? 'bg-slate-100 dark:bg-slate-800 font-semibold cursor-default'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer active:scale-[0.98]'
                              }`}
                            >
                              <span className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                                {initial}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {name}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {acc.email}
                                </p>
                              </div>
                              {isCurrent ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <Check className="h-3 w-3" /> Aktif
                                </span>
                              ) : (
                                <span className="text-[10px] text-blue-600 dark:text-cyan-400 font-semibold">
                                  Pindah
                                </span>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                          Belum ada akun lain yang tersimpan.
                        </p>
                      )}
                    </div>

                    {/* Tombol + Tambah Akun Lain */}
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setIsGoogleModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-xs font-bold text-blue-600 dark:text-cyan-400 transition-all cursor-pointer"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>+ Tambah Akun Lain</span>
                    </button>
                  </div>

                  {/* Bagian Bawah: Tombol Kelola Akun dan Logout */}
                  <div className="pt-2.5 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        navigate('/dashboard');
                      }}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5 text-slate-400" />
                      <span>Kelola Akun & Ruang Kerja</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tombol Menu Mobile Hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <FigmaThemeToggle />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#162142] p-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Drawer Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-white/10 py-3 space-y-2 text-xs bg-white dark:bg-[#121634] px-2 rounded-b-2xl shadow-lg">
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              Dashboard
            </Link>
            <Link
              to="/history"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              Riwayat Analisis
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full text-left rounded-lg px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
            >
              Keluar (Logout)
            </button>
          </div>
        )}
      </header>

      {/* ── Main Content Container ── */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* ── Footer Institusi ── */}
      <footer className="border-t border-slate-200/80 dark:border-white/5 bg-white/50 dark:bg-[#121634]/40 px-4 py-3 text-center font-sans text-sm font-medium tracking-normal text-slate-500 dark:text-slate-400">
        Platform GWAS · Program Studi Bioinformatika IPB University
      </footer>

      {/* Modal Google Auth Instan */}
      <GoogleAuthModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onSuccess={handleGoogleSuccess}
      />
    </div>
  );
}
