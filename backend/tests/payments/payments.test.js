import { describe, it, expect } from 'vitest';
import { registerUser, createSentInvoice } from '../helpers/api.js';
import { getPool } from '../helpers/testDb.js';
import stripeMock, { __calls } from '../mocks/stripe.mock.js';

/**
 * Every Stripe interaction is mocked. These tests assert the *shape* of what we
 * ask Stripe to do — amounts, currency, and which account the charge lands on —
 * because that is what determines whether the right person gets paid.
 */
describe('POST /payments/stripe/checkout', () => {
  it('creates a checkout session for a sent invoice', async () => {
    // Arrange
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    // Act
    const res = await agent.post('/payments/stripe/checkout').send({ invoiceId });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data.url).toMatch(/^https:\/\/checkout\.stripe\.test\//);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });

  it('charges the invoice total in the invoice currency', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent, { currency: 'INR' });

    await agent.post('/payments/stripe/checkout').send({ invoiceId });

    const { params } = __calls.checkoutSessions[0];
    const lineItem = params.line_items[0];
    expect(lineItem.price_data.currency.toUpperCase()).toBe('INR');
    expect(lineItem.price_data.unit_amount).toBe(500000);
  });

  it('never sends card data through our API', async () => {
    // PCI scope: card details must go directly from the browser to Stripe.
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    await agent.post('/payments/stripe/checkout').send({ invoiceId });

    const serialised = JSON.stringify(__calls.checkoutSessions[0]);
    expect(serialised).not.toMatch(/card_number|cvc|4242424242424242/i);
  });

  it('rejects a checkout for another user\'s invoice', async () => {
    const owner = await registerUser();
    const attacker = await registerUser();
    const { invoiceId } = await createSentInvoice(owner.agent);

    const res = await attacker.agent.post('/payments/stripe/checkout').send({ invoiceId });

    expect(res.status).toBe(404);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown invoice', async () => {
    const { agent } = await registerUser();

    const res = await agent
      .post('/payments/stripe/checkout')
      .send({ invoiceId: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    const res = await (await import('../helpers/api.js')).client()
      .post('/payments/stripe/checkout')
      .send({ invoiceId });

    expect(res.status).toBe(401);
  });
});

describe('GET /payments', () => {
  it('lists payments for the requesting user only', async () => {
    const userA = await registerUser();
    const userB = await registerUser();
    const a = await createSentInvoice(userA.agent);
    await userA.agent.post(`/invoices/${a.invoiceId}/mark-paid`).send({ method: 'CASH' });
    const b = await createSentInvoice(userB.agent);
    await userB.agent.post(`/invoices/${b.invoiceId}/mark-paid`).send({ method: 'CASH' });

    const res = await userA.agent.get('/payments');

    expect(res.status).toBe(200);
    const payments = res.body.data.payments ?? res.body.data;
    expect(Array.isArray(payments)).toBe(true);
    expect(payments).toHaveLength(1);
  });

  it('returns an empty list when nothing has been paid', async () => {
    const { agent } = await registerUser();

    const res = await agent.get('/payments');

    expect(res.status).toBe(200);
    const payments = res.body.data.payments ?? res.body.data;
    expect(payments).toEqual([]);
  });
});

describe('manual payment methods', () => {
  it.each([
    ['CASH', 'MANUAL'],
    ['BANK_TRANSFER', 'MANUAL'],
    ['UPI', 'MANUAL'],
  ])('%s creates a %s payment record with the full amount', async (method, provider) => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method });

    const { rows } = await getPool().query(
      'SELECT provider, status, amount, currency FROM payments WHERE invoice_id = $1',
      [invoiceId]
    );
    expect(rows[0].provider).toBe(provider);
    expect(rows[0].status).toBe('SUCCESS');
    expect(Number(rows[0].amount)).toBe(500000);
    expect(rows[0].currency).toBe('INR');
  });

  it('does not contact Stripe for a manual payment', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' });

    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    expect(stripeMock.paymentIntents.create).not.toHaveBeenCalled();
  });
});

describe('payment data integrity', () => {
  it('enforces one payment row per invoice', async () => {
    // A UNIQUE constraint is what stops a double-settlement race from
    // recording two payments for the same invoice.
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);
    await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' });

    await expect(
      getPool().query(
        `INSERT INTO payments (invoice_id, provider, status, amount, currency)
         VALUES ($1, 'MANUAL', 'SUCCESS', 1, 'INR')`,
        [invoiceId]
      )
    ).rejects.toThrow();
  });

  it('rejects a negative payment amount at the database level', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    await expect(
      getPool().query(
        `INSERT INTO payments (invoice_id, provider, status, amount, currency)
         VALUES ($1, 'MANUAL', 'SUCCESS', -100, 'INR')`,
        [invoiceId]
      )
    ).rejects.toThrow();
  });

  it('rejects an unknown payment provider', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    await expect(
      getPool().query(
        `INSERT INTO payments (invoice_id, provider, status, amount, currency)
         VALUES ($1, 'BITCOIN', 'SUCCESS', 100, 'INR')`,
        [invoiceId]
      )
    ).rejects.toThrow();
  });

  it('deletes payments when the parent invoice is deleted', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);
    await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' });

    await getPool().query('DELETE FROM invoices WHERE id = $1', [invoiceId]);

    const { rows } = await getPool().query(
      'SELECT count(*)::int AS n FROM payments WHERE invoice_id = $1',
      [invoiceId]
    );
    expect(rows[0].n).toBe(0);
  });
});
