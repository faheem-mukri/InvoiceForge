import { describe, it, expect } from 'vitest';
import { client, registerUser, createSentInvoice } from '../helpers/api.js';
import { getPool } from '../helpers/testDb.js';
import { __outbox } from '../mocks/email.mock.js';

/**
 * Webhooks are the source of truth for online payments: the browser redirect can
 * be closed, faked or lost. That makes this endpoint both critical and exposed,
 * so these tests focus on signature verification and idempotency.
 */
const statusOf = async (invoiceId) => {
  const { rows } = await getPool().query('SELECT status FROM invoices WHERE id = $1', [invoiceId]);
  return rows[0]?.status;
};

/** Posts a raw Stripe-style event. The route needs the unparsed body. */
function postWebhook(event, signature = 'valid-test-signature') {
  const req = client()
    .post('/webhooks/stripe')
    .set('Content-Type', 'application/json');

  if (signature !== null) req.set('stripe-signature', signature);

  return req.send(Buffer.from(JSON.stringify(event)));
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

    it('does not mark an invoice paid when the signature is invalid', async () => {
      const { agent } = await registerUser();
      const { invoiceId } = await createSentInvoice(agent);

      await postWebhook(checkoutCompleted(invoiceId), 'invalid');

      expect(await statusOf(invoiceId)).toBe('SENT');
    });
  });

  describe('checkout.session.completed', () => {
    it('marks the invoice paid', async () => {
      const { agent } = await registerUser();
      const { invoiceId } = await createSentInvoice(agent);

      const res = await postWebhook(checkoutCompleted(invoiceId));

      expect(res.status).toBe(200);
      expect(await statusOf(invoiceId)).toBe('PAID');
    });

    it('records a STRIPE payment with the provider reference', async () => {
      const { agent } = await registerUser();
      const { invoiceId } = await createSentInvoice(agent);

      await postWebhook(checkoutCompleted(invoiceId));

      const { rows } = await getPool().query(
        'SELECT provider, status, provider_payment_id FROM payments WHERE invoice_id = $1',
        [invoiceId]
      );
      expect(rows[0].provider).toBe('STRIPE');
      expect(rows[0].status).toBe('SUCCESS');
      expect(rows[0].provider_payment_id).toBeTruthy();
    });

    it('emails a payment confirmation', async () => {
      const { agent } = await registerUser();
      const { invoiceId } = await createSentInvoice(agent);

      await postWebhook(checkoutCompleted(invoiceId));

      expect(__outbox.filter((m) => m.type === 'thankyou')).toHaveLength(1);
    });

    it('is idempotent — Stripe retries must not double-record', async () => {
      // Stripe redelivers events, so the handler must be safe to run twice.
      const { agent } = await registerUser();
      const { invoiceId } = await createSentInvoice(agent);

      const first = await postWebhook(checkoutCompleted(invoiceId));
      const second = await postWebhook(checkoutCompleted(invoiceId));

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const { rows } = await getPool().query(
        'SELECT count(*)::int AS n FROM payments WHERE invoice_id = $1',
        [invoiceId]
      );
      expect(rows[0].n).toBe(1);
      expect(await statusOf(invoiceId)).toBe('PAID');
    });

    it('acknowledges an event for an unknown invoice instead of retrying forever', async () => {
      const res = await postWebhook(
        checkoutCompleted('00000000-0000-0000-0000-000000000000')
      );

      expect(res.status).toBe(200);
    });

    it('acknowledges an event with no invoice metadata', async () => {
      const event = checkoutCompleted('x');
      delete event.data.object.metadata;

      const res = await postWebhook(event);

      expect(res.status).toBe(200);
    });

    it('ignores an unrelated event type', async () => {
      const { agent } = await registerUser();
      const { invoiceId } = await createSentInvoice(agent);

      const res = await postWebhook({
        id: 'evt_x',
        type: 'customer.subscription.created',
        data: { object: { metadata: { invoiceId } } },
      });

      expect(res.status).toBe(200);
      expect(await statusOf(invoiceId)).toBe('SENT');
    });

    it('does not resurrect a draft invoice', async () => {
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

      expect(await statusOf(invoiceId)).not.toBe('PAID');
    });
  });

  describe('body parsing', () => {
    it('reads the raw body, since JSON parsing would break signature checks', async () => {
      const { agent } = await registerUser();
      const { invoiceId } = await createSentInvoice(agent);

      const res = await postWebhook(checkoutCompleted(invoiceId));

      expect(res.status).toBe(200);
    });

    it('rejects a body that is not valid JSON', async () => {
      const res = await client()
        .post('/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'valid-test-signature')
        .send(Buffer.from('this is not json'));

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });
});
