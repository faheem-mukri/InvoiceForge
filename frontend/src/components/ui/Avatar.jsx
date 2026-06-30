// Initials avatar. Derives initials from a name or email when no image is set.
function initialsFrom(value) {
  if (!value) return 'U';
  const str = String(value).trim();
  if (str.includes('@')) return str[0].toUpperCase();
  const parts = str.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZES = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

export default function Avatar({ name, src, size = 'md', className = '' }) {
  const sizeClass = SIZES[size] || SIZES.md;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external avatar URLs (e.g. Google) aren't on a configured next/image domain
      <img
        src={src}
        alt={name || 'User'}
        className={`${sizeClass} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold select-none ${className}`}
      title={name}
    >
      {initialsFrom(name)}
    </div>
  );
}
