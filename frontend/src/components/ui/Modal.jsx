'use client';

import { useEffect } from 'react';

// Accessible-ish modal: overlay click + Escape to close, body scroll lock.
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}) {
  useEffect(() => {
    if (!open) return undefined;

    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }

    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    '2xl': 'max-w-3xl',
    '3xl': 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 animate-[overlayIn_0.15s_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${sizes[size] || sizes.md} bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 animate-[modalIn_0.18s_ease-out]`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        <div className="px-6 py-2 text-sm text-gray-600 dark:text-gray-300">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 pt-3 pb-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
