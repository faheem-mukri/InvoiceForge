// Reusable styled select. Matches the Input component's look & dark mode.
// Pass options as [{ value, label }] or render <option> children directly.
export default function Select({
  label,
  error,
  options,
  className = '',
  children,
  ...props
}) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      <div className="relative">
        <select
          className={`
            w-full px-4 py-3 pr-10 rounded-lg border appearance-none
            border-gray-300 dark:border-slate-600
            bg-white dark:bg-slate-700
            text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            transition-all
            ${className}
          `}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>

        {/* Chevron */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
