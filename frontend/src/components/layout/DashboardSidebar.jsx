'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV, isNavItemActive, BrandMark } from '@/components/layout/dashboardNav';

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800">
      {/* Brand */}
      <div className="h-16 flex items-center gap-2 px-5 border-b border-gray-200 dark:border-slate-800">
        <BrandMark />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isNavItemActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
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
  );
}
