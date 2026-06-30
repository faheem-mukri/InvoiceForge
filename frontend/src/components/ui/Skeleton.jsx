// Animated loading placeholder. Use `Skeleton` for arbitrary blocks and the
// named helpers for common layouts.
export default function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 dark:bg-slate-800 ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

// Card-shaped skeletons, e.g. for dashboard stat cards.
export function SkeletonCards({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-28 mt-4" />
          <Skeleton className="h-3 w-16 mt-2" />
        </div>
      ))}
    </div>
  );
}

// Table skeleton with configurable rows/columns.
export function SkeletonTable({ rows = 5, columns = 5 }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-800">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="divide-y divide-gray-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-3.5">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={`h-3 ${c === 0 ? 'w-24' : c === columns - 1 ? 'w-16 ml-auto' : 'flex-1'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
