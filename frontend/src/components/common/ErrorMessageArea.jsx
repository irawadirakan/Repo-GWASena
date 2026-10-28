import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

/**
 * ErrorMessageArea - Message Banner Standar GWASena 2.0 (Figma Design Aligned)
 * Acuan: frontend/assets/Message Banner/ & 01b — Login_ Kredensial Salah.png
 * Mendukung tipe error, warning, dan info serta normalisasi error 422 { message, details: [] }
 */
export default function ErrorMessageArea({
  error,
  type = 'error',
  onDismiss,
  className = '',
}) {
  if (!error) return null;

  let message = '';
  let details = [];

  if (typeof error === 'string') {
    message = error;
  } else if (typeof error === 'object') {
    message = error.message || error.pesan || 'Terjadi kesalahan pada sistem.';
    if (Array.isArray(error.details) && error.details.length > 0) {
      details = error.details;
    } else if (Array.isArray(error.rincian) && error.rincian.length > 0) {
      details = error.rincian;
    }
  }

  // Tentukan styling berdasarkan type
  const isWarning = type === 'warning';
  const isInfo = type === 'info';

  const containerStyles = isWarning
    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-[#2E200F]/85 dark:border-[#F59E0B]/40 dark:text-[#FCD34D]'
    : isInfo
    ? 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:bg-[#0F2238]/85 dark:border-[#06B6D4]/40 dark:text-[#7DD3FC]'
    : 'border-rose-300 bg-rose-50 text-rose-950 dark:bg-[#2D1520]/85 dark:border-[#EF4444]/40 dark:text-[#FCA5A5]';

  const IconComponent = isWarning ? AlertTriangle : isInfo ? Info : AlertCircle;

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur-md animate-fade-in ${containerStyles} ${className}`}
    >
      <IconComponent className="mt-0.5 h-5 w-5 shrink-0" />

      <div className="flex-1 text-sm leading-relaxed">
        <p className="font-semibold">{message}</p>

        {details.length > 0 && (
          <div className="mt-2.5 rounded-xl bg-black/5 dark:bg-black/35 p-3 border border-black/10 dark:border-white/10">
            <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
              Rincian Masalah ({details.length}):
            </span>
            <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto pl-4 text-xs font-mono opacity-90 list-disc">
              {details.map((detail, idx) => (
                <li key={idx} className="break-all">
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1.5 opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-all"
          aria-label="Tutup pesan"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
