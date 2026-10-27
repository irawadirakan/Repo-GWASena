import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

/**
 * AccessDeniedState - Layar Akses Ditolak (403 Forbidden - BR-04, AC-12.1)
 * Ditampilkan saat pengguna mencoba mengakses sesi analisis milik peneliti lain
 */
export default function AccessDeniedState({ analysisId }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-status-error/15 text-status-error mb-4 shadow-lg shadow-status-error/10">
        <ShieldAlert className="h-8 w-8" />
      </div>

      <h1 className="text-2xl font-bold text-text-primary tracking-tight">
        Akses Ditolak (403 Forbidden)
      </h1>

      <p className="mt-2 max-w-md text-sm text-text-secondary leading-relaxed">
        Anda tidak memiliki izin untuk melihat atau memodifikasi sesi analisis{' '}
        {analysisId && <span className="font-mono text-accent-cyan">#{analysisId}</span>}. Demi
        keamanan dan privasi data riset genomik, setiap peneliti hanya dapat mengakses analisis
        miliknya sendiri (Aturan Bisnis BR-04).
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-accent-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-primary/90 focus:outline-none focus:ring-2 focus:ring-accent-primary/50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Dashboard
        </Link>
        <Link
          to="/history"
          className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-elevated transition-colors"
        >
          Buka Riwayat Analisis Saya
        </Link>
      </div>
    </div>
  );
}
