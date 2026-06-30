// Sends the post-payment emails (customer receipt/thank-you + optional owner
// "you got paid" notification). Shared by the Stripe webhook and the manual
// "Mark as Paid" action so both behave identically. Best-effort.
const pool = require("../db");
const { sendThankYouEmail, sendMail } = require("./email");
const { generateInvoicePdfBuffer } = require("../pdf/invoicePdf");

async function sendPaymentNotifications(invoiceId, userId) {
  const [invRes, itemsRes, bizRes, userRes] = await Promise.all([
    pool.query(`SELECT * FROM invoices WHERE id = $1`, [invoiceId]),
    pool.query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY position ASC NULLS LAST`,
      [invoiceId]
    ),
    pool.query(`SELECT * FROM business_profiles WHERE user_id = $1`, [userId]),
    pool.query(`SELECT email, notify_on_paid FROM users WHERE id = $1`, [userId]),
  ]);
  if (invRes.rows.length === 0) return;

  const invoice = invRes.rows[0];
  const business = bizRes.rows[0] || null;
  const owner = userRes.rows[0] || null;
  const pdfBuffer = await generateInvoicePdfBuffer(invoice, itemsRes.rows, business);

  // Receipt / thank-you to the customer (best-effort — needs a client email).
  if (invoice.client_email) {
    await sendThankYouEmail({ invoice, business, pdfBuffer }).catch((e) =>
      console.error("Thank-you email failed:", e.message)
    );
  }

  // Notify the business owner if they opted in.
  if (owner && owner.notify_on_paid && owner.email) {
    const symbols = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };
    const sym = symbols[invoice.currency] || `${invoice.currency} `;
    const amount = `${sym}${((invoice.total_amount || 0) / 100).toFixed(2)}`;
    await sendMail({
      to: owner.email,
      subject: `You got paid — invoice ${invoice.invoice_number}`,
      text: `Good news! Invoice ${invoice.invoice_number} for ${amount} (${invoice.client_name}) has been paid.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
        <p>Good news!</p>
        <p>Invoice <strong>${invoice.invoice_number}</strong> for <strong>${amount}</strong> from ${invoice.client_name} has been paid.</p>
      </div>`,
    }).catch((e) => console.error("Owner notification failed:", e.message));
  }
}

module.exports = { sendPaymentNotifications };
