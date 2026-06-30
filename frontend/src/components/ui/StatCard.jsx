export default function StatCard({
  title,
  value,
  icon,
  trend,
  variant = 'default',
}) {
  const iconStyles = {
    default:
      'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    success:
      'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    warning:
      'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
    danger:
      'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </span>
        {icon && (
          <span
            className={`w-9 h-9 flex items-center justify-center rounded-lg ${iconStyles[variant] || iconStyles.default}`}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
          {value}
        </p>
        {trend && (
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}
