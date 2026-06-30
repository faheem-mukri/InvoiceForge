export default function Card({
  children,
  className = "",
}) {
  return (
    <div
      className={`
        bg-white
        dark:bg-slate-900
        border
        border-gray-200
        dark:border-slate-800
        rounded-xl
        shadow-sm
        p-8
        ${className}
      `}
    >
      {children}
    </div>
  );
}