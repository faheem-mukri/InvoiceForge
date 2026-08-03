import { describe, it, expect, vi } from 'vitest';
import { client, registerUser, createSentInvoice } from '../helpers/api.js';
import { getPool } from '../helpers/testDb.js';
import { __outbox } from '../helpers/outbox.js';

/**
 * Webhooks are the source of truth for online payments: the browser redirect can
 * be closed, faked or lost. That makes this endpoint both critical and exposed,
 * so these tests focus on signature verification, settlement and idempotency.
 *
 * Two details of the real flow matter here:
 *
 *  1. Settlement UPDATES an existing payment row — the PENDING row written when
 *     the checkout session was created. A webhook for an invoice that was never
 *     checked out correctly no-ops, so these tests create the session first.
 *  2. The body must be sent as a raw string. Handing supertest a Buffer makes it
 *     serialise to {"type":"Buffer","data":[…]}, which parses as valid JSON with
 *     the wrong shape — the endpoint then acknowledges an event it can't act on.
 */
const statusOf = async (invoiceId) => {
  const { rows } = await getPool().query('SELECT status FROM invoices WHERE id = $1', [invoiceId]);
  return rows[0]?.status;
};

const paymentCount = async (invoiceId) => {
  const { rows } = await getPool().query(
    'SELECT count(*)::int AS n FROM payments WHERE invoice_id = $1',
    [invoiceId]
  );
  return rows[0].n;
};

/** Posts a raw Stripe-style event. The route needs the unparsed body. */
function postWebhook(event, signature = 'valid-test-signature') {
  const req = client().post('/webhooks/stripe').set('Content-Type', 'application/json');

  if (signature !== null) req.set('stripe-signature', signature);

  // A string, deliberately — see the note above.
  return req.send(JSON.stringify(event));
}

const checkoutCompleted = (invoiceId, overrides = {}) => ({
  id: 'evt_test_1',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_1',
      payment_intent: 'pi_test_1',
      amount_total: 500000,
      currency: 'inr',
      metadata: { invoiceId },
      ...overrides,
    },
  },
});

/**
 * Reproduces the real customer journey: a sent invoice that the customer has
 * begun paying, so a PENDING payment row exists for the webhook to settle.
 */
async function createInvoiceAwaitingPayment() {
  const { agent } = await registerUser();
  const { invoiceId } = await createSentInvoice(agent);

  const checkout = await agent.post('/payments/stripe/checkout').send({ invoiceId });
  expect(checkout.status).toBe(200);

  return { agent, invoiceId };
}

describe('POST /webhooks/stripe', () => {
  describe('signature verification', () => {
    it('rejects a request with no signature header', async () => {
      const res = await postWebhook(checkoutCompleted('irrelevant'), null);

      expect(res.status).toBe(400);
    });

    it('rejects an invalid signature', async () => {
      // Without this, anyone could mark any invoice paid by POSTing JSON.
      const res = await postWebhook(checkoutCompleted('irrelevant'), 'invalid');

      expect(res.status).toBe(400);
    });

    it('does not settle an invoice when the signature is invalid', async () => {
      const { invoiceId } = await createInvoiceAwaitingPayment();

      await postWebhook(checkoutCompleted(invoiceId), 'invalid');

      expect(await statusOf(invoiceId)).toBe('SENT');
    });

    it('rejects a body that is not valid JSON', async () => {
      const res = await client()
        .post('/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'valid-test-signature')
        .send('this is not json');

      expect(res.status).toBe(400);
    });
  });

  describe('checkout.session.completed', () => {
    it('marks the invoice paid', async () => {
      const { invoiceId } = await createInvoiceAwaitingPayment();

      const res = await postWebhook(checkoutCompleted(invoiceId));

      expect(res.status).toBe(200);
      expect(await statusOf(invoiceId)).toBe('PAID');
    });

    it('settles the payment and stores the Stripe reference', async () => {
      const { invoiceId } = await createInvoiceAwaitingPayment();

      await postWebhook(checkoutCompleted(invoiceId));

      const { rows } = await getPool().query(
        'SELECT provider, status, provider_payment_id, paid_at FROM payments WHERE invoice_id = $1',
        [invoiceId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].provider).toBe('STRIPE');
      expect(rows[0].status).toBe('SUCCESS');
      expect(rows[0].provider_payment_id).toBe('pi_test_1');
      expect(rows[0].paid_at).toBeInstanceOf(Date);
    });

    it('emails a payment confirmation', async () => {
      const { invoiceId } = await createInvoiceAwaitingPayment();

      await postWebhook(checkoutCompleted(invoiceId));

      // Notifications are dispatched without being awaited so Stripe can be
      // acknowledged immediately, so wait for delivery.
      await vi.waitFor(
        () => {
          expect(__outbox.filter((m) => m.type === 'thankyou')).toHaveLength(1);
        },
        { timeout: 5000, interval: 50 }
      );
    });

    it('is idempotent — Stripe retries must not double-record', async () => {
      // Stripe redelivers events, so the handler must be safe to run twice.
      const { invoiceId } = await createInvoiceAwaitingPayment();

      const first = await postWebhook(checkoutCompleted(invoiceId));
      const second = await postWebhook(checkoutCompleted(invoiceId));

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(await paymentCount(invoiceId)).toBe(1);
      expect(await statusOf(invoiceId)).toBe('PAID');
    });

    it('no-ops for an invoice that was never checked out', async () => {
      // Settlement updates the PENDING row created at checkout. With no such
      // row there is nothing to settle, and the event is acknowledged so Stripe
      // stops retrying.
      const { agent } = await registerUser();
      const { invoiceId } = await createSentInvoice(agent);

      const res = await postWebhook(checkoutCompleted(invoiceId));

      expect(res.status).toBe(200);
      expect(await statusOf(invoiceId)).toBe('SENT');
      expect(await paymentCount(invoiceId)).toBe(0);
    });

    it('acknowledges an event for an unknown invoice instead of retrying forever', async () => {
      const res = await postWebhook(checkoutCompleted('00000000-0000-0000-0000-000000000000'));

      expect(res.status).toBe(200);
    });

    it('acknowledges an event with no invoice metadata', async () => {
      const event = checkoutCompleted('x');
      delete event.data.object.metadata;

      const res = await postWebhook(event);

      expect(res.status).toBe(200);
    });

    it('ignores an unrelated event type', async () => {
      const { invoiceId } = await createInvoiceAwaitingPayment();

      const res = await postWebhook({
        id: 'evt_x',
        type: 'customer.subscription.created',
        data: { object: { metadata: { invoiceId } } },
      });

      expect(res.status).toBe(200);
      expect(await statusOf(invoiceId)).toBe('SENT');
    });

    it('does not mark a draft invoice paid', async () => {
      // A payment for an invoice that was never sent indicates a bug or an
      // attack; it must not silently transition.
      const { agent } = await registerUser();
      const created = await agent.post('/invoices').send({
        type: 'SERVICE',
        client_name: 'Acme',
        currency: 'INR',
        items: [{ description: 'Work', quantity: 1, unit_price: 100000 }],
      });
      const invoiceId = created.body.data.invoiceId;

      await postWebhook(checkoutCompleted(invoiceId));

      expect(await statusOf(invoiceId)).toBe('DRAFT');
    });
  });

  describe('payment_intent.succeeded', () => {
    it('settles the invoice for the Elements flow', async () => {
      const { invoiceId } = await createInvoiceAwaitingPayment();

      const res = await postWebhook({
        id: 'evt_pi',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_elements_1', metadata: { invoiceId } } },
      });

      expect(res.status).toBe(200);
      expect(await statusOf(invoiceId)).toBe('PAID');
    });
  });
});
