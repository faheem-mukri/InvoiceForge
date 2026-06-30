export default function Alert({
  children,
  variant = "error",
}) {
  const variants = {
    error:
      "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300",

    success:
      "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300",

    warning:
      "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300",
  };

  return (
    <div
      className={`
        border
        rounded-lg
        px-4
        py-3
        text-sm
        ${variants[variant]}
      `}
    >
      {children}
    </div>
  );
}