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
import AnalysisWizardPage from './pages/AnalysisWizardPage.jsx';
import { useAuthStore } from './store/useAuthStore.js';

/**
 * Root Gatekeeper (Logika Hybrid Onboarding & Sesi)
 * Acuan: docs/gwasena-v2/USER_FLOW.md Bagian 2
 */
function RootGatekeeper() {
  const { isAuthenticated, isInitialized } = useAuthStore();

  if (!isInitialized) return null;

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const introCompleted = localStorage.getItem('gwasena_intro_completed') === 'true';
  if (!introCompleted) {
    return <Navigate to="/welcome" replace />;
  }

  return <Navigate to="/login" replace />;
}

export default function App() {
  const { checkSession } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <BrowserRouter>
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
          <Route path="/analyses/:id" element={<AnalysisWizardPage />} />
        </Route>

        {/* ── Wildcard Fallback ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
