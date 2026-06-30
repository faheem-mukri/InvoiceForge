/**
 * Authoritative invoice pricing engine. The backend is the source of truth for
 * all money math; the frontend's figures are only for live display.
 *
 * All money values are integers in the smallest currency unit (cents).
 * Rates (discount % / tax %) are decimals, e.g. 18 means 18%.
 * For a FIXED discount, `discountValue` is interpreted as a cents amount.
 */
function round(n) {
  return Math.round(n);
}

function computeItemTotal(item) {
  const qty = parseInt(item.quantity, 10) || 0;
  const unitPrice = parseInt(item.unit_price, 10) || 0;
  const discount = parseInt(item.discount, 10) || 0;
  const tax = parseInt(item.tax, 10) || 0;
  return Math.max(0, qty * unitPrice - discount + tax);
}

function computeTotals(input) {
  const {
    items = [],
    discountType = "NONE",
    discountValue = 0,
    taxType = "NONE",
    taxRate = 0,
    shippingAmount = 0,
    handlingAmount = 0,
    roundOff = 0,
  } = input;

  const subtotal = items.reduce((sum, item) => {
    const qty = parseInt(item.quantity, 10) || 0;
    const unitPrice = parseInt(item.unit_price, 10) || 0;
    return sum + qty * unitPrice;
  }, 0);

  let discountAmount = 0;
  if (discountType === "PERCENTAGE") {
    discountAmount = round((subtotal * Number(discountValue || 0)) / 100);
  } else if (discountType === "FIXED") {
    discountAmount = round(Number(discountValue || 0));
  }
  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));

  const taxable = Math.max(0, subtotal - discountAmount);

  let taxAmount = 0;
  if (taxType && taxType !== "NONE") {
    taxAmount = round((taxable * Number(taxRate || 0)) / 100);
  }
  taxAmount = Math.max(0, taxAmount);

  const shipping = Math.max(0, parseInt(shippingAmount, 10) || 0);
  const handling = Math.max(0, parseInt(handlingAmount, 10) || 0);
  const rounding = parseInt(roundOff, 10) || 0;

  const totalAmount = Math.max(
    0,
    subtotal - discountAmount + taxAmount + shipping + handling + rounding
  );

  return {
    subtotal,
    discountAmount,
    taxAmount,
    shippingAmount: shipping,
    handlingAmount: handling,
    roundOff: rounding,
    totalAmount,
  };
}

module.exports = { computeTotals, computeItemTotal };
