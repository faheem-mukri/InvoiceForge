export default function Button({
  children,
  type = "button",
  variant = "primary",
  disabled = false,
  className = "",
  ...props
}) {
  const variants = {
    primary:
      "bg-blue-600 hover:bg-blue-700 text-white",

    secondary:
      "bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white",

    danger:
      "bg-red-600 hover:bg-red-700 text-white",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center
        px-4 py-2.5
        rounded-lg
        font-medium
        transition-all duration-200

        disabled:opacity-50
        disabled:cursor-not-allowed

        ${variants[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}