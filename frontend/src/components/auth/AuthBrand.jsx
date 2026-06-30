export default function AuthBrand({ subtitle }) {
  return (
    <div className="mb-8 text-center">
      {/* Logo */}
      <div className="flex items-center justify-center mb-4">
        <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
        InvoiceForge
      </h1>

      {subtitle && (
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}