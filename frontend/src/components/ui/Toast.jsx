'use client';

function IconSuccess() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconError() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

const VARIANTS = {
  success: {
    icon: IconSuccess,
    accent: 'text-green-600 dark:text-green-400',
    ring: 'border-green-200 dark:border-green-900',
  },
  error: {
    icon: IconError,
    accent: 'text-red-600 dark:text-red-400',
    ring: 'border-red-200 dark:border-red-900',
  },
  info: {
    icon: IconInfo,
    accent: 'text-blue-600 dark:text-blue-400',
    ring: 'border-gray-200 dark:border-slate-700',
  },
};

// Presentational toast stack. State lives in ToastContext.
export default function ToastViewport({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm">
      {toasts.map((t) => {
        const variant = VARIANTS[t.variant] || VARIANTS.info;
        const Icon = variant.icon;
        return (
          <div
            key={t.id}
            role="status"
            className={`flex items-start gap-3 rounded-xl border bg-white dark:bg-slate-900 shadow-lg px-4 py-3 ${variant.ring} animate-[toastIn_0.2s_ease-out]`}
          >
            <span className={`shrink-0 mt-0.5 ${variant.accent}`}>
              <Icon />
            </span>
            <p className="flex-1 text-sm text-gray-700 dark:text-gray-200">{t.message}</p>
            <button
              onClick={() => onDismiss(t.id)}
              className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Dismiss"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
