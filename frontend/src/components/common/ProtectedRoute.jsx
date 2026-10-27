import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore.js';
import { Loader2 } from 'lucide-react';

/**
 * ProtectedRoute - Penjaga Akses Terproteksi (AC-01.3)
 * Mengalihkan pengguna tak terautentikasi ke /login dengan mempertahankan URL tujuan
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isInitialized, checkSession } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!isInitialized) {
      checkSession();
    }
  }, [isInitialized, checkSession]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent-cyan" />
          <p className="text-sm text-text-secondary font-medium">Memeriksa sesi riset...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
