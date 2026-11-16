import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { analysisService } from '../services/analysisService.js';
import { ANALYSIS_STATUSES } from '../constants/defaultParams.js';
import { useAuthStore } from '../store/useAuthStore.js';
import ErrorMessageArea from '../components/common/ErrorMessageArea.jsx';
import AccessDeniedState from '../components/common/AccessDeniedState.jsx';

/**
 * AdminPage - Panel Pemantauan Sistem & Pengguna Administrator (FR-13)
 * Terhubung ke endpoint /api/admin/ringkasan, /api/admin/users, dan /api/admin/analyses
 */
export default function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [statusFilter, setStatusFilter] = useState('aktif');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  async function loadAdminData(selectedStatus = statusFilter) {
    setIsLoading(true);
    setError(null);
    setIsAccessDenied(false);

    try {
      const [ringkasanRes, usersRes, analysesRes] = await Promise.all([
        analysisService.getAdminSummary(),
        analysisService.getAdminUsers(),
        analysisService.getAdminAnalyses(selectedStatus),
      ]);
      setSummary(ringkasanRes || {});
      setUsers(Array.isArray(usersRes) ? usersRes : []);
      setAnalyses(Array.isArray(analysesRes) ? analysesRes : []);
    } catch (err) {
      if (err?.status === 403) {
        setIsAccessDenied(true);
      } else {
        setError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (user && user.role !== 'administrator') {
      setIsAccessDenied(true);
      setIsLoading(false);
      return;
    }
    loadAdminData(statusFilter);
  }, [statusFilter, user?.role]);

  if (isAccessDenied) {
    return <AccessDeniedState />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5B4DFE]/15 text-[#5B4DFE] dark:text-[#06B6D4]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Panel Administrator GWASena
            </h1>
            <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300 font-medium">
              Pemantauan antrean komputasi aktif, statistik sistem, dan manajemen peneliti terdaftar.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadAdminData(statusFilter)}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/10 bg-white/90 dark:bg-[#162142] px-4 py-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E2C58] disabled:opacity-50 shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      <ErrorMessageArea error={error} onDismiss={() => setError(null)} />

      {/* Ringkasan Statistik */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="figma-card p-4 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-[#5B4DFE]" />
            <span>Total Pengguna</span>
          </span>
          <div className="font-serif text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {summary?.total_pengguna ?? '—'}
          </div>
        </div>

        <div className="figma-card p-4 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-[#06B6D4]" />
            <span>Total Analisis</span>
          </span>
          <div className="font-serif text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {summary?.total_analisis ?? '—'}
          </div>
        </div>

        <div className="figma-card p-4 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            <span>Komputasi Aktif</span>
          </span>
          <div className="font-serif text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {summary?.analisis_aktif ?? '—'}
          </div>
        </div>

        <div className="figma-card p-4 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Selesai</span>
          </span>
          <div className="font-serif text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {summary?.analisis_selesai ?? '—'}
          </div>
        </div>

        <div className="figma-card p-4 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5" />
            <span>Gagal</span>
          </span>
          <div className="font-serif text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
            {summary?.analisis_gagal ?? '—'}
          </div>
        </div>
      </div>

      {/* Tabel Analisis Lintas Pengguna */}
      <div className="figma-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3.5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Daftar Sesi Analisis Pengguna
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Menampilkan {analyses.length} sesi dengan filter status saat ini.
            </p>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter status analisis admin"
            className="rounded-xl border border-slate-300 dark:border-white/10 bg-[#F1F4FD] dark:bg-[#0F172E] py-2 px-3 text-xs font-semibold text-slate-900 dark:text-white focus:border-[#5B4DFE] focus:outline-none cursor-pointer"
          >
            <option value="aktif">Aktif (Antre &amp; Berjalan)</option>
            <option value="">Semua Status</option>
            <option value="selesai">Selesai</option>
            <option value="gagal">Gagal</option>
            <option value="tervalidasi">Tervalidasi</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        {isLoading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-[#06B6D4] mx-auto mb-2" />
            <p className="text-xs text-slate-500">Memuat daftar analisis sistem...</p>
          </div>
        ) : analyses.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Tidak ada sesi analisis pada filter status &ldquo;{statusFilter || 'Semua'}&rdquo;.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-white/10 bg-slate-100/95 dark:bg-[#0B132C]/90 text-xs font-bold uppercase text-slate-700 dark:text-slate-200">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Nama Analisis</th>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Organisme</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {analyses.map((a) => {
                  const stCfg = ANALYSIS_STATUSES[String(a.status || 'draft').toLowerCase()] || ANALYSIS_STATUSES.draft;
                  return (
                    <tr key={a.analysis_id} className="hover:bg-slate-50/80 dark:hover:bg-white/5">
                      <td className="py-3 px-4 font-mono font-bold text-[#0284C7] dark:text-[#06B6D4]">
                        #{a.analysis_id}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {a.analysis_name}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {a.username}
                      </td>
                      <td className="py-3 px-4 font-serif italic text-slate-700 dark:text-slate-300">
                        {a.organism || 'Allium sativum'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${stCfg.badgeClass}`}>
                          {stCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/analyses/${a.analysis_id}`)}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/10 bg-white dark:bg-[#162142] px-3 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 hover:border-[#0284C7] cursor-pointer"
                        >
                          <span>Tinjau</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daftar Pengguna Terdaftar */}
      <div className="figma-card p-5 sm:p-6 space-y-4">
        <div className="border-b border-slate-200 dark:border-white/10 pb-3.5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Daftar Pengguna Terdaftar ({users.length})
          </h2>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-white/10 bg-slate-100/95 dark:bg-[#0B132C]/90 text-xs font-bold uppercase text-slate-700 dark:text-slate-200">
              <tr>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Peran</th>
                <th className="py-3 px-4 text-right">Jumlah Sesi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {users.map((u) => (
                <tr key={u.user_id} className="hover:bg-slate-50/80 dark:hover:bg-white/5">
                  <td className="py-3 px-4 font-mono text-xs text-slate-500">#{u.user_id}</td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{u.username}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">{u.email}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                        u.role === 'administrator'
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-[#5B4DFE]/20 dark:text-[#A5B4FC] dark:border-[#5B4DFE]/40'
                          : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-white/5 dark:text-slate-300 dark:border-white/10'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {u.jumlah_analisis ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
