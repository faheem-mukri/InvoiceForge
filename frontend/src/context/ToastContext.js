'use client';

import { createContext, useContext, useCallback, useState } from 'react';
import ToastViewport from '@/components/ui/Toast';

const ToastContext = createContext({});

let idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message, { variant = 'info', duration = 4000 } = {}) => {
      const id = ++idSeq;
      setToasts((prev) => [...prev, { id, message, variant }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  // Convenience helpers
  const toast = {
    show,
    success: (message, opts) => show(message, { ...opts, variant: 'success' }),
    error: (message, opts) => show(message, { ...opts, variant: 'error' }),
    info: (message, opts) => show(message, { ...opts, variant: 'info' }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
