/**
 * Email mock.
 *
 * Replaces src/utils/email.js. Captures the messages the app tried to send so
 * tests can assert recipient, subject, Reply-To and attachments without a
 * provider account or network access.
 */
import { vi } from 'vitest';

export const __outbox = [];

// Lets a test simulate a provider outage. Email is best-effort in this app — a
// failed send must never roll back an invoice — so this proves that contract.
let failNextWith = null;
export function failNext(error = new Error('Simulated email provider failure')) {
  failNextWith = error;
}

function record(type, message) {
  if (failNextWith) {
    const err = failNextWith;
    failNextWith = null;
    throw err;
  }
  __outbox.push({ type, ...message });
  return { sent: true };
}

export const sendMail = vi.fn(async (message) => record('raw', message));

export const sendInvoiceEmail = vi.fn(
  async ({ invoice, business, payUrl, pdfBuffer, subject, message }) =>
    record('invoice', {
      to: invoice?.client_email,
      subject: subject || `Invoice ${invoice?.invoice_number}`,
      invoiceNumber: invoice?.invoice_number,
      payUrl,
      message,
      replyTo: business?.business_email,
      fromName: business?.business_name,
      hasPdf: Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0,
    })
);

export const sendThankYouEmail = vi.fn(async ({ invoice, business, pdfBuffer }) =>
  record('thankyou', {
    to: invoice?.client_email,
    subject: `Payment received — invoice ${invoice?.invoice_number}`,
    invoiceNumber: invoice?.invoice_number,
    replyTo: business?.business_email,
    hasPdf: Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0,
  })
);

export function resetEmailMock() {
  __outbox.length = 0;
  failNextWith = null;
  sendMail.mockClear();
  sendInvoiceEmail.mockClear();
  sendThankYouEmail.mockClear();
}

/** Convenience helpers for assertions. */
export const findByRecipient = (email) => __outbox.filter((m) => m.to === email);
export const lastMessage = () => __outbox[__outbox.length - 1];

export default { sendMail, sendInvoiceEmail, sendThankYouEmail };
