import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * ErrorBoundary - Penangkap Galat Runtime Komponen React
 * Mencegah Blank Page saat terjadi unhandled error di sub-komponen
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-3xl figma-card p-6 sm:p-8 border border-red-300 dark:border-red-500/40 bg-red-50/50 dark:bg-red-500/10 text-slate-900 dark:text-white space-y-4 my-4 animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="text-base sm:text-lg font-bold font-sans text-red-950 dark:text-red-200">
                Terjadi Kendala pada Tampilan Komponen
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-serif leading-relaxed">
                Komponen ini mengalami kendala teknis saat memuat data. Sesi analisis Anda tetap tersimpan dengan aman di sistem. Anda dapat mencoba memuat ulang tampilan langkah ini atau kembali ke Dashboard.
              </p>
              {this.state.error?.message && (
                <div className="mt-2 p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-red-200 dark:border-red-500/20 text-xs font-mono text-red-700 dark:text-red-300 break-words">
                  {this.state.error.message}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-red-200/60 dark:border-red-500/20">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 px-4 py-2 text-xs font-sans font-bold text-white shadow-sm transition-all active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Coba Muat Ulang Langkah Ini</span>
            </button>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-[#162142] px-4 py-2 text-xs font-sans font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E2C58] transition-all"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Kembali ke Dashboard</span>
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
