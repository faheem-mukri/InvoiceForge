const pool = require("../db");
const stripe = require("../payments/stripe");
const { getPaymentSettings } = require("./paymentSettings.service");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:4000";

// Upsert a single pending STRIPE/ONLINE payment row for an invoice and store the
// provider reference (PaymentIntent id or Checkout Session id).
async function upsertPendingStripePayment(userId, invoice, providerPaymentId) {
  const updated = await pool.query(
    `UPDATE payments
     SET provider = 'STRIPE',
         method = 'ONLINE',
         amount = $2,
         currency = $3,
         status = 'PENDING',
         provider_payment_id = $4,
         updated_at = now()
     WHERE invoice_id = $1
     RETURNING id`,
    [invoice.id, invoice.total_amount, invoice.currency, providerPaymentId]
  );

  if (updated.rowCount === 0) {
    await pool.query(
      `INSERT INTO payments (
         invoice_id, user_id, provider, method,
         amount, currency, status, provider_payment_id
       )
       VALUES ($1, $2, 'STRIPE', 'ONLINE', $3, $4, 'PENDING', $5)`,
      [invoice.id, userId, invoice.total_amount, invoice.currency, providerPaymentId]
    );
  }
}

async function loadSentInvoice(userId, invoiceId) {
  const invoiceResult = await pool.query(
    `SELECT * FROM invoices WHERE id = $1 AND user_id = $2`,
    [invoiceId, userId]
  );

  if (invoiceResult.rows.length === 0) {
    throw new Error("INVOICE_NOT_FOUND");
  }

  const invoice = invoiceResult.rows[0];

  if (invoice.status !== "SENT") {
    throw new Error("INVALID_INVOICE_STATE");
  }

  return invoice;
}

// Public (unauthenticated) load by id only. Used by the customer payment page.
async function loadPayableInvoiceById(invoiceId) {
  const result = await pool.query(
    `SELECT * FROM invoices WHERE id = $1 AND deleted_at IS NULL`,
    [invoiceId]
  );
  if (result.rows.length === 0) throw new Error("INVOICE_NOT_FOUND");

  const invoice = result.rows[0];
  if (invoice.status !== "SENT" && invoice.status !== "OVERDUE") {
    throw new Error("INVALID_INVOICE_STATE");
  }
  return invoice;
}

/**
 * Stripe Checkout Session flow (hosted payment page).
 * Returns a URL the client redirects to. Settlement happens via the
 * checkout.session.completed webhook.
 */
async function createCheckoutSession(userId, invoiceId) {
  const invoice = await loadSentInvoice(userId, invoiceId);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: invoice.currency.toLowerCase(),
          product_data: { name: `Invoice ${invoice.invoice_number}` },
          unit_amount: invoice.total_amount,
        },
        quantity: 1,
      },
    ],
    metadata: { invoiceId: invoice.id, userId },
    payment_intent_data: { metadata: { invoiceId: invoice.id, userId } },
    success_url: `${FRONTEND_URL}/invoices/${invoice.id}?paid=1`,
    cancel_url: `${FRONTEND_URL}/invoices/${invoice.id}?canceled=1`,
  });

  await upsertPendingStripePayment(userId, invoice, session.id);

  return { url: session.url, sessionId: session.id };
}

/**
 * Direct PaymentIntent flow (for clients using Stripe Elements). Returns a
 * client secret. Settlement happens via the payment_intent.succeeded webhook.
 */
async function createStripePayment(userId, invoiceId) {
  const invoice = await loadSentInvoice(userId, invoiceId);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: invoice.total_amount,
    currency: invoice.currency.toLowerCase(),
    metadata: {
      invoiceId: invoice.id,
      userId,
    },
  });

  await upsertPendingStripePayment(userId, invoice, paymentIntent.id);

  return { clientSecret: paymentIntent.client_secret };
}

/**
 * Public Checkout Session — for the customer who received the invoice link.
 * No auth: the invoice is located by its (unguessable) UUID and must be payable.
 *
 * Multi-tenant model: the charge is created DIRECTLY on the business's connected
 * Stripe account, so the money lands in their balance. Online payment is only
 * possible once that business has connected Stripe — otherwise we refuse rather
 * than route funds to the wrong account.
 */
async function createPublicCheckoutSession(invoiceId) {
  const invoice = await loadPayableInvoiceById(invoiceId);

  const settings = await getPaymentSettings(invoice.user_id);
  const connected =
    settings &&
    settings.stripe_connection_status === "CONNECTED" &&
    settings.stripe_account_id;

  if (!connected) {
    throw new Error("STRIPE_NOT_CONNECTED");
  }

  // Optional platform fee (your revenue), e.g. PLATFORM_FEE_PERCENT=1 → 1%.
  const feePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || "0");
  const applicationFeeAmount =
    feePercent > 0 ? Math.round((invoice.total_amount * feePercent) / 100) : 0;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: invoice.currency.toLowerCase(),
            product_data: { name: `Invoice ${invoice.invoice_number}` },
            unit_amount: invoice.total_amount,
          },
          quantity: 1,
        },
      ],
      metadata: { invoiceId: invoice.id, userId: invoice.user_id },
      payment_intent_data: {
        metadata: { invoiceId: invoice.id, userId: invoice.user_id },
        ...(applicationFeeAmount > 0
          ? { application_fee_amount: applicationFeeAmount }
          : {}),
      },
      success_url: `${API_URL}/public/pay/success`,
      cancel_url: `${API_URL}/public/pay/cancel`,
    },
    // Direct charge on the connected account → funds go to the business.
    { stripeAccount: settings.stripe_account_id }
  );

  await upsertPendingStripePayment(invoice.user_id, invoice, session.id);

  return { url: session.url, sessionId: session.id };
}

module.exports = {
  createCheckoutSession,
  createStripePayment,
  createPublicCheckoutSession,
};
