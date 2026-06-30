export default function Input({
  label,
  error,
  className = "",
  ...props
}) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      <input
        className={`
          w-full
          px-4
          py-3

          rounded-lg
          border
          border-gray-300
          dark:border-slate-600

          bg-white
          dark:bg-slate-700

          text-gray-900
          dark:text-white

          placeholder-gray-400

          focus:outline-none
          focus:ring-2
          focus:ring-blue-500
          focus:border-transparent

          transition-all

          ${className}
        `}
        {...props}
      />

      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}