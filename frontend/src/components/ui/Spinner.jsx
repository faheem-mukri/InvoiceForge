export default function Spinner({
  size = 18,
}) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        opacity="0.25"
      />

      <path
        fill="currentColor"
        opacity="0.75"
        d="M4 12a8 8 0 018-8V0
        C5.37 0 0 5.37 0 12h4z"
      />
    </svg>
  );
}