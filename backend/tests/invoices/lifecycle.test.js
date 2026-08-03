import { describe, it, expect, vi } from 'vitest';
import { registerUser, createInvoice, createSentInvoice } from '../helpers/api.js';
import { fakeInvoice } from '../fixtures/index.js';
import { getPool } from '../helpers/testDb.js';
import { __outbox, failNext } from '../mocks/email.mock.js';

// External services are mocked here rather than in a setup file: vi.mock() is
// hoisted to the top of the file it appears in, so it must be declared per test
// file to apply to this module graph.
vi.mock('../../src/utils/email.js', () => import('../mocks/email.mock.js'));
vi.mock('../../src/payments/stripe.js', () => import('../mocks/stripe.mock.js'));


const statusOf = async (invoiceId) => {
  const { rows } = await getPool().query('SELECT status FROM invoices WHERE id = $1', [invoiceId]);
  return rows[0]?.status;
};

describe('POST /invoices/:id/send', () => {
  it('moves a draft to SENT and emails the client with a PDF', async () => {
    // Arrange
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent, { client_email: 'billing@acme.test' });

    // Act
    const res = await agent.post(`/invoices/${invoiceId}/send`);

    // Assert
    expect(res.status).toBe(200);
    expect(await statusOf(invoiceId)).toBe('SENT');

    const sent = __outbox.filter((m) => m.type === 'invoice');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('billing@acme.test');
    expect(sent[0].hasPdf).toBe(true);
  });

  it('sends from the business identity with replies routed to the business', async () => {
    // Clients must see the business, not the platform, and replies must reach
    // the business owner.
    const { agent } = await registerUser();
    await agent.put('/business').send({
      business_name: 'Priya Bakery',
      business_email: 'priya@bakery.test',
    });
    const { invoiceId } = await createInvoice(agent);

    await agent.post(`/invoices/${invoiceId}/send`);

    const [message] = __outbox.filter((m) => m.type === 'invoice');
    expect(message.fromName).toBe('Priya Bakery');
    expect(message.replyTo).toBe('priya@bakery.test');
  });

  it('records the invoice as sent even when email delivery fails', async () => {
    // Email is best-effort: a provider outage must not lose the state change.
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);
    failNext(new Error('provider down'));

    const res = await agent.post(`/invoices/${invoiceId}/send`);

    expect(res.status).toBe(200);
    expect(await statusOf(invoiceId)).toBe('SENT');
  });

  it('refuses to send an already-sent invoice', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    const res = await agent.post(`/invoices/${invoiceId}/send`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('cannot send another user\'s invoice', async () => {
    const owner = await registerUser();
    const attacker = await registerUser();
    const { invoiceId } = await createInvoice(owner.agent);

    const res = await attacker.agent.post(`/invoices/${invoiceId}/send`);

    expect(res.status).toBe(404);
    expect(await statusOf(invoiceId)).toBe('DRAFT');
  });
});

describe('POST /invoices/:id/resend', () => {
  it('re-emails a sent invoice without changing its status', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    const res = await agent.post(`/invoices/${invoiceId}/resend`);

    expect(res.status).toBe(200);
    expect(await statusOf(invoiceId)).toBe('SENT');
    expect(__outbox.filter((m) => m.type === 'invoice')).toHaveLength(2);
  });

  it('refuses to resend a draft', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);

    const res = await agent.post(`/invoices/${invoiceId}/resend`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('refuses to resend a paid invoice', async () => {
    // Resending a paid invoice would tell the client to pay again.
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);
    await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' });

    const res = await agent.post(`/invoices/${invoiceId}/resend`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });
});

describe('POST /invoices/:id/mark-paid', () => {
  it('marks a sent invoice as PAID and stamps paid_at', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    const res = await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' });

    expect(res.status).toBe(200);

    const { rows } = await getPool().query(
      'SELECT status, paid_at FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(rows[0].status).toBe('PAID');
    expect(rows[0].paid_at).toBeInstanceOf(Date);
  });

  it('writes a MANUAL payment record', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'BANK_TRANSFER' });

    const { rows } = await getPool().query(
      'SELECT provider, status, amount FROM payments WHERE invoice_id = $1',
      [invoiceId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe('MANUAL');
    expect(rows[0].status).toBe('SUCCESS');
    expect(Number(rows[0].amount)).toBe(500000);
  });

  it.each(['CASH', 'BANK_TRANSFER', 'UPI'])('accepts the %s method', async (method) => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    const res = await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method });

    expect(res.status).toBe(200);
    expect(await statusOf(invoiceId)).toBe('PAID');
  });

  it('emails a payment confirmation, matching the webhook path', async () => {
    // A manual mark-paid must notify the client just like an online payment.
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' });

    expect(__outbox.filter((m) => m.type === 'thankyou')).toHaveLength(1);
  });

  it('refuses to mark a draft as paid', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);

    const res = await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('is idempotent — a second mark-paid does not double-record', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);
    await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' });

    const second = await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' });

    expect(second.status).toBe(400);
    const { rows } = await getPool().query(
      'SELECT count(*)::int AS n FROM payments WHERE invoice_id = $1',
      [invoiceId]
    );
    expect(rows[0].n).toBe(1);
  });

  it('cannot mark another user\'s invoice as paid', async () => {
    const owner = await registerUser();
    const attacker = await registerUser();
    const { invoiceId } = await createSentInvoice(owner.agent);

    const res = await attacker.agent
      .post(`/invoices/${invoiceId}/mark-paid`)
      .send({ method: 'CASH' });

    expect(res.status).toBe(404);
    expect(await statusOf(invoiceId)).toBe('SENT');
  });
});

describe('GET /invoices/:id/pdf', () => {
  it('returns a PDF for a sent invoice', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    const res = await agent.get(`/invoices/${invoiceId}/pdf`).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('names the download after the invoice number, not the record id', async () => {
    const { agent } = await registerUser();
    const { invoiceId, invoiceNumber } = await createSentInvoice(agent);

    const res = await agent.get(`/invoices/${invoiceId}/pdf`);

    expect(res.headers['content-disposition']).toContain(`${invoiceNumber}.pdf`);
    expect(res.headers['content-disposition']).not.toContain(invoiceId);
  });

  it('refuses to render a draft', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);

    const res = await agent.get(`/invoices/${invoiceId}/pdf`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('renders a paid invoice', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);
    await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' });

    const res = await agent.get(`/invoices/${invoiceId}/pdf`);

    expect(res.status).toBe(200);
  });

  it('renders the rupee symbol without crashing on the embedded font', async () => {
    // Regression: the built-in PDF font has no glyph for ₹ and printed blank.
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent, { currency: 'INR' });

    const res = await agent.get(`/invoices/${invoiceId}/pdf`);

    expect(res.status).toBe(200);
  });

  it('cannot fetch another user\'s PDF', async () => {
    const owner = await registerUser();
    const attacker = await registerUser();
    const { invoiceId } = await createSentInvoice(owner.agent);

    const res = await attacker.agent.get(`/invoices/${invoiceId}/pdf`);

    expect(res.status).toBe(404);
  });
});

describe('invoice status transitions', () => {
  it('follows DRAFT -> SENT -> PAID', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);
    expect(await statusOf(invoiceId)).toBe('DRAFT');

    await agent.post(`/invoices/${invoiceId}/send`);
    expect(await statusOf(invoiceId)).toBe('SENT');

    await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' });
    expect(await statusOf(invoiceId)).toBe('PAID');
  });

  it('only accepts statuses the schema permits', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);

    // A CHECK constraint is the last line of defence if a bug bypasses the API.
    await expect(
      getPool().query('UPDATE invoices SET status = $1 WHERE id = $2', ['NONSENSE', invoiceId])
    ).rejects.toThrow();
  });

  it('rejects an unknown status through the list filter without a 500', async () => {
    const { agent } = await registerUser();

    const res = await agent.get('/invoices?status=NOT_A_STATUS');

    expect(res.status).not.toBe(500);
  });
});
