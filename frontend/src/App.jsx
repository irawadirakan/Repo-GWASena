import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';
import IntroPage from './pages/IntroPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import AnalysisWizardPage from './pages/AnalysisWizardPage.jsx';
import { useAuthStore } from './store/useAuthStore.js';
import SeamlessVideoBackground from './components/common/SeamlessVideoBackground.jsx';

/**
 * Root Gatekeeper (Logika Kunjungan Awal vs Pengguna Lama & Sesi Aktif)
 * - Sesi login aktif (token valid): langsung ke /dashboard
 * - Pernah login sebelumnya atau menyelesaikan intro: langsung ke /login
 * - Pengunjung baru pertama kali membuka website: langsung ke /welcome (Landing Page / Intro)
 */
function RootGatekeeper() {
  const { isAuthenticated, isInitialized } = useAuthStore();

  if (!isInitialized) return null;

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const hasLoggedInBefore =
    localStorage.getItem('gwasena_has_logged_in') === 'true' ||
    localStorage.getItem('gwasena_intro_completed') === 'true';

  if (hasLoggedInBefore) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/welcome" replace />;
}

export default function App() {
  const { checkSession } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <BrowserRouter>
      {/* ── Global Seamless Looping Live Video Background (Anti Jump-Cut) ── */}
      <SeamlessVideoBackground />

      <Routes>
        {/* ── Root Gatekeeper ── */}
        <Route path="/" element={<RootGatekeeper />} />

        {/* ── Rute Publik (Dibungkus AuthLayout dengan persistent DnaBackdrop) ── */}
        <Route element={<AuthLayout />}>
          <Route path="/welcome" element={<IntroPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* ── Rute Terproteksi (Dibungkus ProtectedRoute & AppLayout) ── */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/analyses/:id" element={<AnalysisWizardPage />} />
          <Route path="/sesi/:id" element={<AnalysisWizardPage />} />
        </Route>

        {/* ── Wildcard Fallback ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
