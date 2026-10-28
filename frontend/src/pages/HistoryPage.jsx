import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  History,
  Search,
  Filter,
  PlusCircle,
  ArrowRight,
  RefreshCw,
  FolderOpen,
  Calendar,
  Loader2,
  FileText,
} from 'lucide-react';
import { analysisService } from '../services/analysisService.js';
import { ANALYSIS_STATUSES } from '../constants/defaultParams.js';
import ErrorMessageArea from '../components/common/ErrorMessageArea.jsx';
import AccessDeniedState from '../components/common/AccessDeniedState.jsx';

/**
 * S-10: HistoryPage (Riwayat Analisis Pengguna - Figma Aligned)
 * Acuan: 10 — Riwayat Analisis.png, 10b — Riwayat_ Kosong.png, 10c — Riwayat_ Akses Ditolak.png
 */
export default function HistoryPage() {
  const navigate = useNavigate();

  const [analyses, setAnalyses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  async function loadHistory() {
    setIsLoading(true);
    setError(null);
    setIsAccessDenied(false);

    try {
      const data = await analysisService.listAnalyses();
      setAnalyses(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.status === 403) {
        setIsAccessDenied(true);
      } else {
        setError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  // Filter data berdasarkan search query & status
  const filteredAnalyses = useMemo(() => {
    return analyses.filter((a) => {
      const matchesSearch =
        (a.analysis_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(a.analysis_id).includes(searchQuery);

      const matchesStatus =
        statusFilter === 'ALL' || (a.status || '').toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [analyses, searchQuery, statusFilter]);

  if (isAccessDenied) {
    return <AccessDeniedState />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Header Halaman ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5B4DFE]/15 text-[#5B4DFE] dark:text-[#06B6D4]">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Riwayat Analisis GWAS
              </h1>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Daftar seluruh sesi komputasi dan eksplorasi asosiasi genomik milik akun Anda (FR-12).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadHistory}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#162142] px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1E2C58] hover:-translate-y-[1px] active:scale-[0.97] active:brightness-95 transition-all duration-100 disabled:opacity-50"
            title="Muat Ulang Riwayat"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#5B4DFE] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#5B4DFE]/30 hover:bg-[#4F46E5] hover:-translate-y-[1px] hover:shadow-xl active:scale-[0.97] active:brightness-95 transition-all duration-100"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Analisis Baru</span>
          </Link>
        </div>
      </div>

      <ErrorMessageArea error={error} onDismiss={() => setError(null)} />

      {/* ── Toolbar Pencarian & Filter (Figma Aligned) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 figma-card p-3.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nama analisis atau ID sesi..."
            className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2 pl-10 pr-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] font-medium transition-all"
          />
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2 px-3 text-xs font-medium text-slate-900 dark:text-white focus:border-[#5B4DFE] focus:outline-none focus:ring-1 focus:ring-[#5B4DFE] cursor-pointer font-sans"
          >
            <option value="ALL">Semua Status ({analyses.length})</option>
            <option value="selesai">Selesai</option>
            <option value="berjalan">Sedang Berjalan</option>
            <option value="antre">Dalam Antrean</option>
            <option value="tervalidasi">Tervalidasi (Siap QC)</option>
            <option value="draft">Draft (Belum Upload)</option>
            <option value="gagal">Gagal</option>
          </select>
        </div>
      </div>

      {/* ── Konten Tabel / Loading / Empty State ── */}
      {isLoading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center figma-card p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#06B6D4] mb-2" />
          <p className="text-xs text-slate-600 dark:text-slate-400 font-sans">Memuat daftar riwayat analisis...</p>
        </div>
      ) : filteredAnalyses.length === 0 ? (
        /* Empty State (Figma 10b — Riwayat_ Kosong.png) */
        <div className="flex min-h-[340px] flex-col items-center justify-center figma-card p-8 text-center animate-fade-in border-dashed">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 dark:bg-[#162142] text-slate-400 mb-4 shadow-inner">
            <FolderOpen className="h-8 w-8 text-[#5B4DFE] dark:text-[#06B6D4]" />
          </div>

          <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans tracking-tight">
            {analyses.length === 0
              ? 'Belum Ada Sesi Analisis'
              : 'Tidak Ditemukan Analisis yang Cocok'}
          </h3>

          <p className="mt-1.5 max-w-sm text-xs font-serif text-slate-600 dark:text-slate-400 leading-relaxed">
            {analyses.length === 0
              ? 'Anda belum pernah menjalankan analisis GWAS. Mulai sesi pertama Anda dengan mengunggah dataset genotipe dan fenotipe.'
              : 'Cobalah sesuaikan kata kunci pencarian atau ubah filter status yang Anda pilih.'}
          </p>

          {analyses.length === 0 && (
            <Link
              to="/dashboard"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#5B4DFE] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#5B4DFE]/30 hover:bg-[#4F46E5] active:scale-[0.99] transition-all font-sans"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Mulai Analisis Pertama</span>
            </Link>
          )}
        </div>
      ) : (
        /* Tabel Riwayat (Figma 10 — Riwayat Analisis.png) */
        <div className="overflow-hidden figma-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-white/10 bg-slate-100/95 dark:bg-[#0F172E]/90 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider font-sans">
                <tr>
                  <th className="py-3.5 px-4 w-20">ID</th>
                  <th className="py-3.5 px-4">Nama Sesi Analisis</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Organisme</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">Waktu Sesi</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredAnalyses.map((item) => {
                  const statusConfig =
                    ANALYSIS_STATUSES[item.status?.toLowerCase()] || ANALYSIS_STATUSES.draft;

                  const formattedDate = item.analysis_time
                    ? new Date(item.analysis_time).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—';

                  return (
                    <tr
                      key={item.analysis_id}
                      className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                    >
                      {/* ID Sesi */}
                      <td className="py-3.5 px-4 font-mono font-bold text-[#5B4DFE] dark:text-[#06B6D4] tabular-nums">
                        #{item.analysis_id}
                      </td>

                      {/* Nama Analisis */}
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="font-semibold text-sm group-hover:text-[#5B4DFE] dark:group-hover:text-[#06B6D4] transition-colors line-clamp-1 font-sans">
                            {item.analysis_name}
                          </span>
                        </div>
                      </td>

                      {/* Organisme (Neuton Serif Italic) */}
                      <td className="py-3.5 px-4 hidden md:table-cell text-slate-700 dark:text-slate-300 font-serif italic text-sm">
                        {item.organism || 'Allium sativum L.'}
                      </td>

                      {/* Organisme */}
                      <td className="py-3.5 px-4 hidden md:table-cell italic text-slate-600 dark:text-slate-400">
                        {item.organism || 'Allium sativum'}
                      </td>

                      {/* Waktu Sesi */}
                      <td className="py-3.5 px-4 hidden sm:table-cell text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{formattedDate}</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusConfig.badgeClass}`}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: statusConfig.color }}
                          />
                          {statusConfig.label}
                        </span>
                      </td>

                      {/* Tombol Aksi */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/analyses/${item.analysis_id}`)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#162142] px-3.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-[#5B4DFE] hover:text-[#5B4DFE] dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1E2C58] hover:-translate-y-[1px] active:scale-[0.97] active:brightness-95 transition-all duration-100"
                        >
                          <span>Buka Analisis</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
