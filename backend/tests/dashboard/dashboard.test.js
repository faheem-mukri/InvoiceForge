import { describe, it, expect } from 'vitest';
import { client, registerUser, createInvoice, createSentInvoice } from '../helpers/api.js';

/**
 * The dashboard is pure aggregation, which makes it easy to get subtly wrong:
 * counting another tenant's invoices, or summing mixed currencies as if they
 * were the same unit. Both would be believable-looking but wrong numbers.
 */
describe('GET /dashboard', () => {
  it('returns zeroed figures for a new account', async () => {
    const { agent } = await registerUser();

    const res = await agent.get('/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.data.counts.total).toBe(0);
    expect(res.body.data.revenue.totalBilled).toBe(0);
    expect(res.body.data.recentInvoices).toEqual([]);
  });

  it('counts invoices by status', async () => {
    const { agent } = await registerUser();
    await createInvoice(agent);            // DRAFT
    await createSentInvoice(agent);        // SENT
    const paid = await createSentInvoice(agent);
    await agent.post(`/invoices/${paid.invoiceId}/mark-paid`).send({ method: 'CASH' });

    const res = await agent.get('/dashboard');

    const { counts } = res.body.data;
    expect(counts.DRAFT).toBe(1);
    expect(counts.SENT).toBe(1);
    expect(counts.PAID).toBe(1);
    expect(counts.total).toBe(3);
  });

  it('separates billed, collected and outstanding revenue', async () => {
    const { agent } = await registerUser();
    const paid = await createSentInvoice(agent);       // 5000.00
    await agent.post(`/invoices/${paid.invoiceId}/mark-paid`).send({ method: 'CASH' });
    await createSentInvoice(agent);                    // 5000.00 outstanding

    const res = await agent.get('/dashboard');

    const { revenue } = res.body.data;
    expect(revenue.totalBilled).toBe(1000000);
    expect(revenue.collected).toBe(500000);
    expect(revenue.outstanding).toBe(500000);
  });

  it('excludes drafts from outstanding revenue', async () => {
    // A draft has not been billed to anyone, so it cannot be owed.
    const { agent } = await registerUser();
    await createInvoice(agent);

    const res = await agent.get('/dashboard');

    expect(res.body.data.revenue.outstanding).toBe(0);
  });

  it('counts only the requesting user\'s invoices', async () => {
    const userA = await registerUser();
    const userB = await registerUser();
    await createInvoice(userA.agent);
    await createInvoice(userB.agent);
    await createInvoice(userB.agent);

    const res = await userA.agent.get('/dashboard');

    expect(res.body.data.counts.total).toBe(1);
  });

  it('reports revenue in the business base currency', async () => {
    const { agent } = await registerUser();
    await agent.put('/business').send({ default_currency: 'INR' });

    const res = await agent.get('/dashboard');

    expect(res.body.data.revenue.currency).toBe('INR');
  });

  it('does not flag mixed currency when every invoice matches the base', async () => {
    const { agent } = await registerUser();
    await agent.put('/business').send({ default_currency: 'INR' });
    await createSentInvoice(agent, { currency: 'INR' });

    const res = await agent.get('/dashboard');

    expect(res.body.data.revenue.mixedCurrency).toBe(false);
  });

  it('normalises a foreign-currency invoice into the base currency', async () => {
    // Summing 100 USD and 100 INR as 200 would be badly misleading.
    const { agent } = await registerUser();
    await agent.put('/business').send({ default_currency: 'INR' });
    await createSentInvoice(agent, { currency: 'USD' });

    const res = await agent.get('/dashboard');

    const { revenue } = res.body.data;
    expect(revenue.currency).toBe('INR');
    expect(revenue.mixedCurrency).toBe(true);
    // 5000 USD converts to substantially more than 5000 INR.
    expect(revenue.totalBilled).toBeGreaterThan(500000);
  });

  it('still returns figures when the rate service is unavailable', async () => {
    // The FX provider is unreachable in tests, so this exercises the fallback:
    // the dashboard must render rather than error.
    const { agent } = await registerUser();
    await agent.put('/business').send({ default_currency: 'INR' });
    await createSentInvoice(agent, { currency: 'USD' });

    const res = await agent.get('/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.data.revenue.totalBilled).toBeGreaterThan(0);
  });

  it('lists the most recent invoices', async () => {
    const { agent } = await registerUser();
    await createInvoice(agent, { client_name: 'Older Client' });
    await createInvoice(agent, { client_name: 'Newer Client' });

    const res = await agent.get('/dashboard');

    expect(res.body.data.recentInvoices.length).toBe(2);
    expect(res.body.data.recentInvoices[0].client_name).toBe('Newer Client');
  });

  it('caps the recent lists so the payload stays small', async () => {
    const { agent } = await registerUser();
    for (let i = 0; i < 7; i++) await createInvoice(agent);

    const res = await agent.get('/dashboard');

    expect(res.body.data.recentInvoices.length).toBeLessThanOrEqual(5);
  });

  it('requires authentication', async () => {
    const res = await client().get('/dashboard');

    expect(res.status).toBe(401);
  });
});

describe('GET /invoices/summary', () => {
  it('returns aggregate figures for the current user', async () => {
    const { agent } = await registerUser();
    await createSentInvoice(agent);

    const res = await agent.get('/invoices/summary');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('requires authentication', async () => {
    const res = await client().get('/invoices/summary');

    expect(res.status).toBe(401);
  });
});
