/**
 * Email capture.
 *
 * The app is CommonJS and destructures its email helpers at require time
 * (`const { sendInvoiceEmail } = require(...)`), so vi.mock cannot intercept
 * them — Node's loader resolves the real module before any mock registry is
 * consulted.
 *
 * Instead we let the real email code run and capture it at the HTTP boundary:
 * envSetup configures the Brevo provider with a fake key, and every outbound
 * request to the Brevo API is intercepted here. That gives a testable outbox
 * *and* exercises the genuine code path — subject building, Reply-To, the
 * "via InvoiceForge" sender name and PDF attachment — rather than a stub of it.
 */
export const __outbox = [];

/** Simulates a provider outage for the next send. */
let failNextWith = null;
export function failNext(error = new Error('Simulated email provider failure')) {
  failNextWith = error;
}

export function resetOutbox() {
  __outbox.length = 0;
  failNextWith = null;
}

/** Classifies a captured message so tests can filter by intent. */
function classify(subject = '') {
  if (/^Payment received/i.test(subject)) return 'thankyou';
  if (/^You got paid/i.test(subject)) return 'ownerNotification';
  if (/^Invoice /i.test(subject)) return 'invoice';
  if (/reset your/i.test(subject)) return 'passwordReset';
  return 'other';
}

/** Records a Brevo API payload as a normalised outbox entry. */
export function recordBrevoPayload(payload) {
  const subject = payload.subject || '';
  __outbox.push({
    type: classify(subject),
    to: payload.to?.[0]?.email,
    subject,
    replyTo: payload.replyTo?.email,
    fromName: payload.sender?.name,
    fromEmail: payload.sender?.email,
    text: payload.textContent,
    html: payload.htmlContent,
    hasPdf: Array.isArray(payload.attachment) && payload.attachment.length > 0,
    attachments: (payload.attachment || []).map((a) => a.name),
  });
}

/**
 * Handles an intercepted Brevo request. Returns a Response-like object, or
 * throws if a failure was queued.
 */
export function handleBrevoRequest(init) {
  if (failNextWith) {
    const err = failNextWith;
    failNextWith = null;
    throw err;
  }

  let payload = {};
  try {
    payload = JSON.parse(init?.body || '{}');
  } catch {
    payload = {};
  }
  recordBrevoPayload(payload);

  return {
    ok: true,
    status: 201,
    text: async () => '{"messageId":"test"}',
    json: async () => ({ messageId: 'test' }),
  };
}

/** Convenience helpers for assertions. */
export const findByRecipient = (email) => __outbox.filter((m) => m.to === email);
export const byType = (type) => __outbox.filter((m) => m.type === type);
export const lastMessage = () => __outbox[__outbox.length - 1];
