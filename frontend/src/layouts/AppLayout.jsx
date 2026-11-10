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
  UserPlus,
  Wifi,
  WifiOff,
  ShieldCheck,
} from 'lucide-react';
import BrandLogo from '../components/common/BrandLogo.jsx';
import FigmaThemeToggle from '../components/common/FigmaThemeToggle.jsx';
import { useAuthStore } from '../store/useAuthStore.js';
import { analysisService } from '../services/analysisService.js';

/**
 * AppLayout - Layout Aplikasi Terproteksi Sesuai Desain Figma
 * Menyediakan navigasi utama, status bar sistem, dan menu akun.
 */
export default function AppLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [health, setHealth] = useState(null);
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Pantau status koneksi jaringan riil (Evaluasi Tester Poin 7)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  // Periksa status kesehatan sistem saat mount
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
    const interval = setInterval(fetchHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isHealthy = health?.status === 'ok';
  const isDegraded = health?.status === 'degraded';

  return (
    <div className="relative z-10 min-h-screen bg-transparent text-slate-900 dark:text-white flex flex-col font-sans antialiased">
      {/* ── App Topbar / Header Sesuai Figma (Floating Liquid Glass) ── */}
      <header className="sticky top-0 z-40 glass-navbar px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between h-16">
          {/* Sisi Kiri: Logo Resmi GWASena */}
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="focus:outline-none transition-transform hover:scale-[1.02]">
              <BrandLogo size="md" />
            </Link>

            {/* Navigasi Utama di Tengah (Figma) */}
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

              {user?.role === 'administrator' && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight transition-all ${
                      isActive
                        ? 'text-[#5B4DFE] dark:text-[#06B6D4] font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`
                  }
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Panel Admin</span>
                </NavLink>
              )}
            </nav>
          </div>

          {/* Sisi Kanan: Health Indicator, Theme Switch Pill, & User Button Pill */}
          <div className="hidden md:flex items-center gap-4">
            {/* Health Indicator & Status Koneksi Sistem (Evaluasi Tester Poin 7) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsHealthOpen(!isHealthOpen)}
                title={
                  isOnline && isHealthy
                    ? 'Sinyal Terhubung • Siap Menjalankan Analisis'
                    : 'Koneksi Terputus • Analisis Tidak Dapat Dijalankan'
                }
                className="group flex items-center gap-2 rounded-full border border-slate-300 dark:border-white/10 bg-white/95 dark:bg-[#162142]/80 px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E2C58] active:scale-95 transition-all duration-100 shadow-sm cursor-pointer"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isOnline && (isHealthy || health === null)
                        ? 'bg-emerald-500 animate-ping'
                        : 'bg-rose-500'
                    }`}
                  />
                  <span
                    className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                      isOnline && (isHealthy || health === null)
                        ? 'bg-emerald-500'
                        : 'bg-rose-500'
                    }`}
                  />
                </span>
                <span className="font-bold text-xs">
                  {isOnline && (isHealthy || health === null) ? 'Sistem Aktif' : 'Koneksi Terputus'}
                </span>
                {isOnline && (isHealthy || health === null) ? (
                  <Wifi className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-rose-500" />
                )}
              </button>

              {/* Popover Detail Kesehatan Sistem dengan Status Nyata */}
              {isHealthOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 figma-card p-4 z-50 origin-top-right animate-dropdown-in text-xs text-slate-800 dark:text-slate-200 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2.5 mb-2.5 font-bold text-slate-900 dark:text-white">
                    <span className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-[#06B6D4]" />
                      <span>Status Sistem & Konektivitas</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsHealthOpen(false)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Banner Status Nyata */}
                  <div
                    className={`rounded-xl p-3 mb-3 border font-sans font-semibold text-xs flex items-center gap-2.5 ${
                      isOnline && (isHealthy || health === null)
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-900 dark:text-rose-300'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0 bg-current" />
                    <span>
                      {isOnline && (isHealthy || health === null)
                        ? 'Sinyal Terhubung • Siap Menjalankan Analisis'
                        : 'Koneksi Terputus • Analisis Tidak Dapat Dijalankan'}
                    </span>
                  </div>

                  <div className="space-y-2 font-medium">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Jaringan Internet:</span>
                      <span className={`font-bold flex items-center gap-1 ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                        {isOnline ? 'Online (Terhubung)' : 'Offline (Terputus)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">FastAPI Pipeline Engine:</span>
                      <span className={`flex items-center gap-1 font-bold ${isHealthy || isDegraded ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                        {isHealthy || isDegraded ? (
                          <><CheckCircle2 className="h-3.5 w-3.5" /> Aktif</>
                        ) : (
                          <><AlertTriangle className="h-3.5 w-3.5" /> Offline</>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Database Storage:</span>
                      <span className={`flex items-center gap-1 font-bold ${health?.postgres === 'ok' || isHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                        {health?.postgres === 'ok' || isHealthy ? (
                          <><CheckCircle2 className="h-3.5 w-3.5" /> Terhubung</>
                        ) : (
                          <><AlertTriangle className="h-3.5 w-3.5" /> Terputus</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle Pill Sesuai Figma */}
            <FigmaThemeToggle />

            {/* User Button Pill & Google-Style Account Dropdown (Evaluasi Tester Poin 4) */}
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                className="flex items-center gap-2 rounded-full border border-slate-300 dark:border-white/10 bg-white dark:bg-[#162142]/80 px-3 py-1.5 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-[#1E2C58] active:scale-95 transition-all duration-100 shadow-sm cursor-pointer"
                aria-expanded={accountMenuOpen}
              >
                {/* Avatar Bulat Bergradien (Google-Style) */}
                <span className="h-6 w-6 rounded-full bg-gradient-to-tr from-[#38BDF8] via-[#5B4DFE] to-[#818CF8] flex items-center justify-center text-white text-xs font-bold shadow-inner">
                  {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </span>

                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {user?.username || '[User]'}
                </span>

                {accountMenuOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </button>

              {/* Menu Profil Akun Bergaya Google (Google Account Menu) */}
              {accountMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 figma-card p-5 z-50 origin-top-right animate-dropdown-in shadow-2xl text-center rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-[#0F172E]/95 backdrop-blur-2xl">
                  {/* Lingkaran Avatar Besar di Tengah Atas */}
                  <div className="relative mx-auto mb-3 h-16 w-16 rounded-full bg-gradient-to-tr from-[#38BDF8] via-[#5B4DFE] to-[#818CF8] flex items-center justify-center text-white text-2xl font-black shadow-lg">
                    {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                  </div>

                  {/* Nama Pengguna & Email */}
                  <h3 className="text-base font-bold text-slate-900 dark:text-white truncate font-sans">
                    {user?.username || 'Peneliti GWAS'}
                  </h3>
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate mt-0.5">
                    {user?.email || 'peneliti@apps.ipb.ac.id'}
                  </p>

                  {/* Badge Role */}
                  <div className="mt-2.5">
                    <span className="inline-block rounded-full bg-[#5B4DFE]/15 dark:bg-[#5B4DFE]/25 border border-[#5B4DFE]/30 px-3 py-0.5 text-xs font-bold text-[#5B4DFE] dark:text-[#A5B4FC]">
                      {user?.role === 'administrator' ? 'Administrator' : 'Pengguna Analisis'}
                    </span>
                  </div>

                  <div className="border-t border-slate-200 dark:border-white/10 my-4" />

                  {/* Aksi Tambah / Ganti Akun Lain */}
                  <div className="space-y-1 text-left font-sans text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        navigate('/login');
                      }}
                      className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <UserPlus className="h-4 w-4 text-[#06B6D4]" />
                      <span>Beralih / Tambah Akun Lain</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        navigate('/history');
                      }}
                      className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <UserIcon className="h-4 w-4 text-[#5B4DFE]" />
                      <span>Kelola Aktivitas Sesi Saya</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-200 dark:border-white/10 my-3" />

                  {/* Tombol Logout Rapi */}
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Keluar (Logout)</span>
                  </button>
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
              className="rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#162142] p-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Drawer Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-white/10 py-3 space-y-2 text-xs bg-white dark:bg-[#121634] px-2 rounded-b-2xl shadow-lg dark:shadow-none">
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
            {user?.role === 'administrator' && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-3 py-2 font-semibold text-[#5B4DFE] dark:text-[#06B6D4] hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Panel Admin
              </Link>
            )}
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

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200/80 dark:border-white/5 bg-white/50 dark:bg-[#121634]/40 px-4 py-3 text-center text-xs text-slate-600 dark:text-slate-400">
        Platform GWAS · Program Studi Bioinformatika IPB University
      </footer>
    </div>
  );
}
