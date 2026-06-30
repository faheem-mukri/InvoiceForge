const {
  createStripePayment,
  createCheckoutSession,
} = require("../services/payment.service");

function handlePaymentError(res, err) {
  if (err.message === "INVOICE_NOT_FOUND") {
    return res.status(404).json({
      success: false,
      error: { code: "INVOICE_NOT_FOUND", message: "Invoice not found." },
    });
  }

  if (err.message === "INVALID_INVOICE_STATE") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_STATE",
        message: "Only SENT invoices can be paid online.",
      },
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    error: { code: "STRIPE_ERROR", message: "Could not start payment." },
  });
}

// PaymentIntent flow — returns a client secret for Stripe Elements.
async function createPayment(req, res) {
  try {
    const { invoiceId } = req.params;
    const result = await createStripePayment(req.user.id, invoiceId);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handlePaymentError(res, err);
  }
}

// Checkout Session flow — returns a hosted Stripe Checkout URL.
async function createCheckout(req, res) {
  try {
    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELD", message: "invoiceId is required" },
      });
    }

    const result = await createCheckoutSession(req.user.id, invoiceId);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handlePaymentError(res, err);
  }
}

// Payment history for the authenticated user.
async function listPayments(req, res) {
  try {
    const pool = require("../db");
    const result = await pool.query(
      `SELECT p.id, p.invoice_id, p.provider, p.method, p.amount, p.currency,
              p.status, p.paid_at, p.created_at, i.invoice_number, i.client_name
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    return res.json({ success: true, data: { payments: result.rows } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not load payments." },
    });
  }
}

module.exports = { createPayment, createCheckout, listPayments };
