'use client';

import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function AuthLayout({ children }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          InvoiceForge
        </span>

        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-57px)]">
        {children}
      </div>

    </div>
  );
}