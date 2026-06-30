'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV, isNavItemActive, BrandMark } from '@/components/layout/dashboardNav';

// Hamburger button + slide-in navigation drawer. Only rendered on small
// screens (md:hidden); the desktop sidebar takes over from md up.
export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll and allow Escape-to-close while the drawer is open.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 animate-[overlayIn_0.15s_ease-out]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <aside className="absolute inset-y-0 left-0 w-64 max-w-[80%] flex flex-col bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 shadow-xl animate-[drawerIn_0.2s_ease-out]">
            <div className="h-16 flex items-center justify-between px-5 border-b border-gray-200 dark:border-slate-800">
              <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                <BrandMark />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = isNavItemActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
