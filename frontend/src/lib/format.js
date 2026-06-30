// Money is stored on the backend as an integer in the smallest currency unit
// (e.g. cents). Convert to a localized currency string for display.
export function formatMoney(amountInMinorUnits, currency = 'USD') {
  const value = (Number(amountInMinorUnits) || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
    }).format(value);
  } catch {
    // Unknown currency code — fall back to plain number with code prefix.
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
