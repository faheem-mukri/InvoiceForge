'use client';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/ui/Avatar';
import Dropdown from '@/components/ui/Dropdown';
import Tooltip from '@/components/ui/Tooltip';
import MobileNav from '@/components/layout/MobileNav';

export default function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const displayName = user?.email || user?.name || null;

  return (
    <header className="relative z-30 h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
      <MobileNav />

      <div className="flex items-center gap-2 ml-auto">
        {/* Theme toggle */}
        <Tooltip content={theme === 'dark' ? 'Light mode' : 'Dark mode'} side="bottom">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>
        </Tooltip>

        <div className="w-px h-5 bg-gray-200 dark:bg-slate-700 mx-1" />

        {/* User menu */}
        <Dropdown
          trigger={
            <span className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
              <Avatar name={displayName} />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-400">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          }
        >
          <Dropdown.Label>{displayName || 'Signed in'}</Dropdown.Label>
          <Dropdown.Divider />
          <Dropdown.Item variant="danger" onClick={logout}>
            Sign out
          </Dropdown.Item>
        </Dropdown>
      </div>
    </header>
  );
}
