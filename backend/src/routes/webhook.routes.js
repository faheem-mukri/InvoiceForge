const express = require("express");
const stripe = require("../payments/stripe");
const pool = require("../db");
const { recordAudit } = require("../utils/audit");
const { sendPaymentNotifications } = require("../utils/paymentNotifications");

const router = express.Router();

/**
 * Settle a Stripe payment for an invoice inside a transaction:
 * mark the payment SUCCESS and transition the invoice SENT -> PAID.
 * Idempotent: re-delivered events that find nothing to update simply no-op.
 */
async function settleInvoicePayment(invoiceId, providerPaymentId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const paymentResult = await client.query(
      `UPDATE payments
       SET status = 'SUCCESS',
           provider_payment_id = COALESCE($2, provider_payment_id),
           paid_at = now(),
           updated_at = now()
       WHERE invoice_id = $1
       RETURNING id`,
      [invoiceId, providerPaymentId || null]
    );

    if (paymentResult.rowCount === 0) {
      console.error("Webhook: no payment record found for invoice:", invoiceId);
      await client.query("ROLLBACK");
      return;
    }

    const invoiceResult = await client.query(
      `UPDATE invoices
       SET status = 'PAID', paid_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'SENT'
       RETURNING id, user_id`,
      [invoiceId]
    );

    if (invoiceResult.rowCount === 0) {
      // Already paid or not in SENT state — payment row is still recorded.
      console.error(
        "Webhook: invoice not found or not in SENT state. invoiceId:",
        invoiceId
      );
      await client.query("COMMIT");
      return;
    }

    await recordAudit(client, {
      userId: invoiceResult.rows[0].user_id,
      entityType: "PAYMENT",
      entityId: invoiceId,
      action: "PAYMENT_SUCCEEDED",
      metadata: { provider: "STRIPE", providerPaymentId },
    });

    await client.query("COMMIT");
    console.log(`Webhook: invoice ${invoiceId} marked PAID.`);

    // Automatic payment emails (best-effort, outside the transaction).
    sendPaymentNotifications(invoiceId, invoiceResult.rows[0].user_id).catch((e) =>
      console.error("Payment notification failed:", e.message)
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    // Step 1 — Verify the webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      // Step 2 — Handle relevant events
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const invoiceId = session.metadata?.invoiceId;
        const providerPaymentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

        if (!invoiceId) {
          console.error("Webhook: checkout.session.completed missing invoiceId");
          return res.json({ received: true });
        }

        await settleInvoicePayment(invoiceId, providerPaymentId);
      } else if (event.type === "payment_intent.succeeded") {
        const intent = event.data.object;
        const invoiceId = intent.metadata?.invoiceId;

        if (!invoiceId) {
          console.error("Webhook: payment_intent.succeeded missing invoiceId");
          return res.json({ received: true });
        }

        await settleInvoicePayment(invoiceId, intent.id);
      }
    } catch (err) {
      console.error("Webhook: processing failed:", err);
      // Return 500 so Stripe retries the webhook
      return res.status(500).json({ error: "Internal server error" });
    }

    res.json({ received: true });
  }
);

module.exports = router;
