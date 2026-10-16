import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

/* ═══════════════════════════════════════════════════
   ToastContainer — Accessible live toast notifications (B5)
   ═══════════════════════════════════════════════════ */

export default function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success';

        return (
          <div
            key={toast.id}
            role={isError ? 'alert' : 'status'}
            className={`
              pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl
              border shadow-card-hover backdrop-blur-md transition-all duration-300
              ${
                isError
                  ? 'bg-[var(--card)]/95 border-rose-500/30 text-[var(--text-primary)]'
                  : isSuccess
                    ? 'bg-[var(--card)]/95 border-emerald-500/30 text-[var(--text-primary)]'
                    : 'bg-[var(--card)]/95 border-[var(--border)] text-[var(--text-primary)]'
              }
            `}
          >
            <div className="shrink-0 mt-0.5">
              {isError && <AlertCircle size={16} className="text-rose-500" aria-hidden="true" />}
              {isSuccess && (
                <CheckCircle2 size={16} className="text-emerald-500" aria-hidden="true" />
              )}
              {!isError && !isSuccess && (
                <Info size={16} className="text-[var(--accent-start)]" aria-hidden="true" />
              )}
            </div>

            <div className="flex-1 text-[12px] font-medium leading-relaxed">{toast.message}</div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0 transition-colors p-0.5"
              aria-label="Dismiss notification"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
