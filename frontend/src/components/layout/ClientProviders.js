'use client';

import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';

export default function ClientProviders({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
