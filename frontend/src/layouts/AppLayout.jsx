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
} from 'lucide-react';
import BrandLogo from '../components/common/BrandLogo.jsx';
import FigmaThemeToggle from '../components/common/FigmaThemeToggle.jsx';
import { useAuthStore } from '../store/useAuthStore.js';
import { analysisService } from '../services/analysisService.js';

/**
 * AppLayout - Layout Aplikasi Terproteksi Sesuai Desain Figma (S-03 s.d. S-10)
 * Acuan: frontend/screens/03 — Dashboard (Pengguna Analisis).png & 03c — Dashboard_ Menu Akun Terbuka.png
 */
export default function AppLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [health, setHealth] = useState(null);
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-[#E8EEFA] via-[#F1F5FD] to-[#E5EAFC] dark:from-[#080D24] dark:via-[#111A3E] dark:to-[#1B1240] text-slate-900 dark:text-white flex flex-col font-sans antialiased">
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
                      ? 'text-[#5B4DFE] dark:text-white font-bold drop-shadow-[0_0_8px_rgba(91,77,254,0.3)]'
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
                      ? 'text-[#5B4DFE] dark:text-white font-bold drop-shadow-[0_0_8px_rgba(91,77,254,0.3)]'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                Riwayat Analisis
              </NavLink>
            </nav>
          </div>

          {/* Sisi Kanan: Health Indicator, Theme Switch Pill, & User Button Pill */}
          <div className="hidden md:flex items-center gap-4">
            {/* Health Indicator Ringkas */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsHealthOpen(!isHealthOpen)}
                className="flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/10 bg-white/95 dark:bg-[#162142]/80 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E2C58] active:scale-95 transition-all duration-100 shadow-sm"
                title="Status Koneksi Backend"
              >
                <span className="relative flex h-2 w-2">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                      isHealthy ? 'bg-status-success' : isDegraded ? 'bg-status-warning' : 'bg-status-error'
                    }`}
                  />
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${
                      isHealthy ? 'bg-status-success' : isDegraded ? 'bg-status-warning' : 'bg-status-error'
                    }`}
                  />
                </span>
                <span className="hidden xl:inline font-medium">
                  {isHealthy ? 'Siap' : isDegraded ? 'Degradasi' : 'Offline'}
                </span>
                <Activity className="h-3 w-3 text-slate-400" />
              </button>

              {/* Popover Detail Kesehatan Sistem */}
              {isHealthOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 figma-card p-4 z-50 origin-top-right animate-dropdown-in text-xs text-slate-800 dark:text-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2 mb-2 font-semibold text-slate-900 dark:text-white">
                    <span>Status Komponen Backend</span>
                    <button
                      type="button"
                      onClick={() => setIsHealthOpen(false)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">FastAPI</span>
                      <span className="flex items-center gap-1 text-status-success font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {isHealthy ? 'Aktif' : 'Simulasi UI'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">PostgreSQL</span>
                      <span className="flex items-center gap-1 text-slate-400 font-medium">
                        {health?.components?.database?.ok ? (
                          <span className="text-status-success flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Terhubung
                          </span>
                        ) : (
                          <span className="text-status-warning flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" /> Standby
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle Pill Sesuai Figma */}
            <FigmaThemeToggle />

            {/* User Button Pill & Menu Dropdown Sesuai Figma */}
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                className="flex items-center gap-2 rounded-full border border-slate-300 dark:border-white/10 bg-white dark:bg-[#162142]/80 px-3 py-1.5 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-[#1E2C58] active:scale-95 transition-all duration-100 shadow-sm"
                aria-expanded={accountMenuOpen}
              >
                {/* Avatar Bulat Bergradien (Figma Style) */}
                <span className="h-6 w-6 rounded-full bg-gradient-to-tr from-[#38BDF8] via-[#6366F1] to-[#818CF8] flex items-center justify-center text-white text-[11px] font-bold shadow-inner">
                  {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </span>

                <span className="text-xs font-semibold text-slate-800 dark:text-white">
                  {user?.username || '[User]'}
                </span>

                {accountMenuOpen ? (
                  <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                )}
              </button>

              {/* Account Dropdown Menu Sesuai 03c — Dashboard_ Menu Akun Terbuka.png */}
              {accountMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 figma-card p-3 z-50 origin-top-right animate-dropdown-in text-xs">
                  <div className="px-2 py-1.5">
                    <p className="font-bold text-slate-900 dark:text-white truncate">
                      {user?.username || '[User]'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {user?.email || 'peneliti@apps.ipb.ac.id'}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-[#5B4DFE]/15 dark:bg-[#5B4DFE]/20 px-2 py-0.5 text-[10px] font-semibold text-[#5B4DFE] dark:text-[#818CF8]">
                      {user?.role === 'administrator' ? 'Administrator' : 'Pengguna Analisis'}
                    </span>
                  </div>

                  <div className="border-t border-slate-200 dark:border-white/10 my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      navigate('/dashboard');
                    }}
                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white active:scale-[0.98] transition-all duration-100"
                  >
                    <UserIcon className="h-3.5 w-3.5" />
                    <span>Akun</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 active:scale-[0.98] transition-all duration-100"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Logout</span>
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
