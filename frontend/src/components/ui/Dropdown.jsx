'use client';

import { useState, useRef, useEffect } from 'react';

// Lightweight dropdown menu. `trigger` is the clickable element; children are
// the menu contents (use Dropdown.Item for rows).
export default function Dropdown({ trigger, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center">
        {trigger}
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-2 min-w-[180px] rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg py-1.5 animate-[toastIn_0.15s_ease-out] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Item({ children, onClick, variant = 'default' }) {
  const styles =
    variant === 'danger'
      ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-2 text-sm transition-colors ${styles}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="my-1.5 border-t border-gray-100 dark:border-slate-800" />;
}

function Label({ children }) {
  return (
    <div className="px-4 py-1.5 text-xs text-gray-400 dark:text-gray-500 truncate">
      {children}
    </div>
  );
}

Dropdown.Item = Item;
Dropdown.Divider = Divider;
Dropdown.Label = Label;
