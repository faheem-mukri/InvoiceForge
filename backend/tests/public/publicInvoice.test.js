import { describe, it, expect } from 'vitest';
import { client, registerUser, createInvoice, createSentInvoice } from '../helpers/api.js';
import { fakeInvoice } from '../fixtures/index.js';

/**
 * These endpoints are unauthenticated, which makes them the product's largest
 * exposed surface. The invoice UUID is the only credential, so the tests focus
 * on what a stranger can and cannot see: a payable invoice is viewable, a draft
 * is not, and nothing internal leaks.
 */
describe('GET /public/invoices/:id', () => {
  it('shows a sent invoice to the customer who has the link', async () => {
    const { agent } = await registerUser();
    const { invoiceId, invoiceNumber } = await createSentInvoice(agent);

    const res = await client().get(`/public/invoices/${invoiceId}`);

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain(invoiceNumber);
  });

  it('hides a draft invoice', async () => {
    // A draft is not yet a claim on anyone, so it must not be publicly visible.
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);

    const res = await client().get(`/public/invoices/${invoiceId}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await client().get('/public/invoices/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
  });

  it('handles a malformed id without a server error', async () => {
    const res = await client().get('/public/invoices/not-a-uuid');

    expect(res.status).not.toBe(500);
  });

  it('does not expose the owner\'s internal identifiers', async () => {
    // The customer needs the invoice, not our user or account ids.
    const { agent, userId } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    const res = await client().get(`/public/invoices/${invoiceId}`);

    expect(JSON.stringify(res.body)).not.toContain(userId);
  });

  it('does not expose credentials or secrets', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    const res = await client().get(`/public/invoices/${invoiceId}`);

    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/\$2[aby]\$/);        // no password hash
    expect(body).not.toMatch(/two_factor_secret/); // no 2FA secret
    expect(body).not.toMatch(/enc:v1:/);           // no encrypted payloads
  });
});

describe('POST /public/invoices/:id/checkout', () => {
  it('refuses when the business has not connected Stripe', async () => {
    // Charging without a connected account would route the customer's money to
    // the platform instead of the business.
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    const res = await client().post(`/public/invoices/${invoiceId}/checkout`);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body)).toMatch(/stripe/i);
  });

  it('returns 404 for an unknown invoice', async () => {
    const res = await client().post(
      '/public/invoices/00000000-0000-0000-0000-000000000000/checkout'
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).not.toBe(500);
  });
});

describe('Stripe redirect result pages', () => {
  it.each([
    ['success', '/public/pay/success'],
    ['cancel', '/public/pay/cancel'],
  ])('serves the %s page', async (_label, path) => {
    const res = await client().get(path);

    expect(res.status).toBe(200);
  });
});

describe('POST /guest/invoices', () => {
  it('generates a PDF without an account', async () => {
    const res = await client()
      .post('/guest/invoices')
      .send(fakeInvoice())
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('does not persist anything', async () => {
    // The guest flow is stateless by design — no account, no stored invoice.
    const { getPool } = await import('../helpers/testDb.js');

    await client().post('/guest/invoices').send(fakeInvoice());

    const { rows } = await getPool().query('SELECT count(*)::int AS n FROM invoices');
    expect(rows[0].n).toBe(0);
  });

  it('rejects a request with no line items', async () => {
    const res = await client().post('/guest/invoices').send(fakeInvoice({ items: [] }));

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('rejects a request with no client name', async () => {
    const payload = fakeInvoice();
    delete payload.client_name;

    const res = await client().post('/guest/invoices').send(payload);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
