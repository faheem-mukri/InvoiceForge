'use client';

// Pill-style segmented tabs. `tabs` is [{ value, label }]; controlled via
// `value` + `onChange`.
export default function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
