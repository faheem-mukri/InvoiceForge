'use client';

// CSS-only tooltip on hover/focus. Wraps its children.
export default function Tooltip({ content, children, side = 'top' }) {
  if (!content) return children;

  const position = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span className="relative inline-flex group">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-gray-900 dark:bg-slate-700 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity ${position[side] || position.top}`}
      >
        {content}
      </span>
    </span>
  );
}
