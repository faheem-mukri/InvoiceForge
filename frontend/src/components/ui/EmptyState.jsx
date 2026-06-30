import Link from 'next/link';

export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      {icon && (
        <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500 mb-4">
          {icon}
        </div>
      )}

      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>

      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          {description}
        </p>
      )}

      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
