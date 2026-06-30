'use client';

import { useState } from 'react';

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// Password input with a show/hide toggle. Matches the Input component's styling.
export default function PasswordInput({ label, error, className = '', ...props }) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className={`
            w-full px-4 py-3 pr-11 rounded-lg border
            border-gray-300 dark:border-slate-600
            bg-white dark:bg-slate-700
            text-gray-900 dark:text-white
            placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            transition-all
            ${className}
          `}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label={show ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          <EyeIcon open={show} />
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
