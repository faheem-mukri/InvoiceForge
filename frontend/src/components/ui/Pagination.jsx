'use client';

import Button from './Button';

// Reusable pagination control driven by a { page, totalPages, total,
// hasNextPage, hasPrevPage } object (matches the backend pagination shape).
export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, totalPages, total, hasNextPage, hasPrevPage } = pagination;

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Page {page} of {totalPages}
        {typeof total === 'number' ? ` · ${total} total` : ''}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={!hasPrevPage}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={!hasNextPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
