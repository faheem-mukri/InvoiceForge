'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Sun, Moon, Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#how', label: 'How it works' },
  { href: '#faq', label: 'FAQ' },
];

export default function LandingNav() {
  const { token, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const authed = !loading && token;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors ${
        scrolled
          ? 'bg-white/85 dark:bg-slate-950/85 backdrop-blur border-b border-gray-100 dark:border-slate-800'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 h-[72px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="InvoiceForge home">
          <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <FileText size={18} />
          </span>
          <span className="font-bold text-gray-900 dark:text-white">InvoiceForge</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm text-gray-600 dark:text-gray-300">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-gray-900 dark:hover:text-white transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="hidden sm:flex items-center gap-2">
            {authed ? (
              <Link href="/dashboard" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white">
                  Login
                </Link>
                <Link href="/register" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setOpen((o) => !o)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="md:hidden border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 py-4 space-y-3">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block text-sm text-gray-600 dark:text-gray-300"
            >
              {l.label}
            </a>
          ))}
          <div className="flex gap-2 pt-2">
            {authed ? (
              <Link href="/dashboard" className="flex-1 text-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="flex-1 text-center px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 text-sm font-medium">Login</Link>
                <Link href="/register" className="flex-1 text-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
