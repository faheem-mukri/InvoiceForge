// Mirrors backend/src/utils/pricing.js for live display. The backend remains
// the source of truth; these figures are only for the editor's summary.
// All money values here are integers in minor units (cents).

export function toMinorUnits(value) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function computeTotals({
  items = [],
  discountType = 'NONE',
  discountValue = 0, // percent (PERCENTAGE) or cents (FIXED)
  taxType = 'NONE',
  taxRate = 0, // percent
  shippingAmount = 0, // cents
  handlingAmount = 0, // cents
  roundOff = 0, // cents
}) {
  const subtotal = items.reduce((sum, item) => {
    const qty = parseInt(item.quantity, 10) || 0;
    const unit = parseInt(item.unitPriceCents, 10) || 0;
    return sum + qty * unit;
  }, 0);

  let discountAmount = 0;
  if (discountType === 'PERCENTAGE') {
    discountAmount = Math.round((subtotal * Number(discountValue || 0)) / 100);
  } else if (discountType === 'FIXED') {
    discountAmount = Math.round(Number(discountValue || 0));
  }
  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));

  const taxable = Math.max(0, subtotal - discountAmount);
  let taxAmount = 0;
  if (taxType && taxType !== 'NONE') {
    taxAmount = Math.round((taxable * Number(taxRate || 0)) / 100);
  }

  const shipping = Math.max(0, shippingAmount || 0);
  const handling = Math.max(0, handlingAmount || 0);
  const rounding = roundOff || 0;

  const total = Math.max(
    0,
    subtotal - discountAmount + taxAmount + shipping + handling + rounding
  );

  return { subtotal, discountAmount, taxAmount, total };
}
