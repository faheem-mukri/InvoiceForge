import { describe, it, expect } from 'vitest';
import { client, registerUser, createInvoice } from '../helpers/api.js';
import { fakeInvoice, fakeItem } from '../fixtures/index.js';
import { getPool } from '../helpers/testDb.js';

describe('POST /invoices', () => {
  it('creates a draft invoice with a generated number', async () => {
    // Arrange
    const { agent } = await registerUser();

    // Act
    const res = await agent.post('/invoices').send(fakeInvoice());

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.data.invoiceId).toBeTruthy();
    expect(res.body.data.invoiceNumber).toBeTruthy();

    const { rows } = await getPool().query('SELECT status FROM invoices WHERE id = $1', [
      res.body.data.invoiceId,
    ]);
    expect(rows[0].status).toBe('DRAFT');
  });

  it('computes totals server-side and ignores client-supplied amounts', async () => {
    // The frontend must never be trusted for money math.
    const { agent } = await registerUser();

    const res = await agent.post('/invoices').send(
      fakeInvoice({
        items: [fakeItem({ quantity: 2, unit_price: 250000 })],
        total_amount: 1, // attempt to underpay
        subtotal: 1,
      })
    );

    const { rows } = await getPool().query(
      'SELECT subtotal, total_amount FROM invoices WHERE id = $1',
      [res.body.data.invoiceId]
    );
    expect(Number(rows[0].subtotal)).toBe(500000);
    expect(Number(rows[0].total_amount)).toBe(500000);
  });

  it('applies discount and tax in the correct order', async () => {
    const { agent } = await registerUser();

    const res = await agent.post('/invoices').send(
      fakeInvoice({
        items: [fakeItem({ quantity: 1, unit_price: 100000 })],
        discount_type: 'PERCENTAGE',
        discount_value: 10,
        tax_type: 'GST',
        tax_rate: 18,
      })
    );

    const { rows } = await getPool().query(
      'SELECT discount_amount, tax_amount, total_amount FROM invoices WHERE id = $1',
      [res.body.data.invoiceId]
    );
    expect(Number(rows[0].discount_amount)).toBe(10000);
    expect(Number(rows[0].tax_amount)).toBe(16200); // 18% of 90000
    expect(Number(rows[0].total_amount)).toBe(106200);
  });

  it('persists line items with their ordering', async () => {
    const { agent } = await registerUser();

    const res = await agent.post('/invoices').send(
      fakeInvoice({
        items: [
          fakeItem({ description: 'First' }),
          fakeItem({ description: 'Second' }),
          fakeItem({ description: 'Third' }),
        ],
      })
    );

    const { rows } = await getPool().query(
      'SELECT description FROM invoice_items WHERE invoice_id = $1 ORDER BY position ASC',
      [res.body.data.invoiceId]
    );
    expect(rows.map((r) => r.description)).toEqual(['First', 'Second', 'Third']);
  });

  it('increments the invoice number for successive invoices', async () => {
    const { agent } = await registerUser();

    const first = await createInvoice(agent);
    const second = await createInvoice(agent);

    expect(first.invoiceNumber).not.toBe(second.invoiceNumber);
  });

  it('accepts a caller-supplied invoice number', async () => {
    const { agent } = await registerUser();

    const res = await agent.post('/invoices').send(fakeInvoice({ invoice_number: 'CUSTOM-001' }));

    expect(res.body.data.invoiceNumber).toBe('CUSTOM-001');
  });

  it('rejects a duplicate invoice number with 409', async () => {
    const { agent } = await registerUser();
    await agent.post('/invoices').send(fakeInvoice({ invoice_number: 'DUP-001' }));

    const res = await agent.post('/invoices').send(fakeInvoice({ invoice_number: 'DUP-001' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_INVOICE_NUMBER');
  });

  it('allows two different users to reuse the same invoice number', async () => {
    // Numbering is per business, not global.
    const userA = await registerUser();
    const userB = await registerUser();
    await userA.agent.post('/invoices').send(fakeInvoice({ invoice_number: 'SHARED-1' }));

    const res = await userB.agent.post('/invoices').send(fakeInvoice({ invoice_number: 'SHARED-1' }));

    expect(res.status).toBe(201);
  });

  describe('validation', () => {
    it('rejects a missing invoice type', async () => {
      const { agent } = await registerUser();
      const payload = fakeInvoice();
      delete payload.type;

      const res = await agent.post('/invoices').send(payload);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects an unknown invoice type', async () => {
      const { agent } = await registerUser();

      const res = await agent.post('/invoices').send(fakeInvoice({ type: 'SUBSCRIPTION' }));

      expect(res.status).toBe(422);
    });

    it('rejects a missing client', async () => {
      const { agent } = await registerUser();
      const payload = fakeInvoice();
      delete payload.client_name;

      const res = await agent.post('/invoices').send(payload);

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/client/i);
    });

    it.each([
      ['empty array', []],
      ['not an array', 'nope'],
      ['missing', undefined],
    ])('rejects items that are %s', async (_label, items) => {
      const { agent } = await registerUser();

      const res = await agent.post('/invoices').send(fakeInvoice({ items }));

      expect(res.status).toBe(422);
    });

    it('rejects a zero quantity', async () => {
      const { agent } = await registerUser();

      const res = await agent
        .post('/invoices')
        .send(fakeInvoice({ items: [fakeItem({ quantity: 0 })] }));

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/quantity/i);
    });

    it('rejects a negative quantity', async () => {
      const { agent } = await registerUser();

      const res = await agent
        .post('/invoices')
        .send(fakeInvoice({ items: [fakeItem({ quantity: -3 })] }));

      expect(res.status).toBe(422);
    });

    it('rejects a negative unit price', async () => {
      const { agent } = await registerUser();

      const res = await agent
        .post('/invoices')
        .send(fakeInvoice({ items: [fakeItem({ unit_price: -100 })] }));

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/price/i);
    });

    it('accepts a zero unit price, which is a valid free line item', async () => {
      const { agent } = await registerUser();

      const res = await agent
        .post('/invoices')
        .send(fakeInvoice({ items: [fakeItem({ unit_price: 0 })] }));

      expect(res.status).toBe(201);
    });

    it('rejects a due date earlier than the issue date', async () => {
      const { agent } = await registerUser();

      const res = await agent
        .post('/invoices')
        .send(fakeInvoice({ issue_date: '2026-02-01', due_date: '2026-01-01' }));

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/due date/i);
    });
  });

  it('requires authentication', async () => {
    const res = await client().post('/invoices').send(fakeInvoice());

    expect(res.status).toBe(401);
  });
});

describe('GET /invoices', () => {
  it('lists only the requesting user\'s invoices', async () => {
    const userA = await registerUser();
    const userB = await registerUser();
    await createInvoice(userA.agent);
    await createInvoice(userA.agent);
    await createInvoice(userB.agent);

    const res = await userA.agent.get('/invoices');

    expect(res.status).toBe(200);
    expect(res.body.data.invoices).toHaveLength(2);
  });

  it('returns an empty list for a new user rather than an error', async () => {
    const { agent } = await registerUser();

    const res = await agent.get('/invoices');

    expect(res.status).toBe(200);
    expect(res.body.data.invoices).toEqual([]);
  });

  it('filters by status', async () => {
    const { agent } = await registerUser();
    const draft = await createInvoice(agent);
    const toSend = await createInvoice(agent);
    await agent.post(`/invoices/${toSend.invoiceId}/send`);

    const res = await agent.get('/invoices?status=DRAFT');

    const ids = res.body.data.invoices.map((i) => i.id);
    expect(ids).toContain(draft.invoiceId);
    expect(ids).not.toContain(toSend.invoiceId);
  });

  it('searches by client name', async () => {
    const { agent } = await registerUser();
    await createInvoice(agent, { client_name: 'Findable Corp' });
    await createInvoice(agent, { client_name: 'Other Corp' });

    const res = await agent.get('/invoices?q=Findable');

    expect(res.body.data.invoices).toHaveLength(1);
    expect(res.body.data.invoices[0].client_name).toBe('Findable Corp');
  });

  it('paginates', async () => {
    const { agent } = await registerUser();
    for (let i = 0; i < 3; i++) await createInvoice(agent);

    const res = await agent.get('/invoices?page=1&limit=2');

    expect(res.body.data.invoices).toHaveLength(2);
  });
});

describe('GET /invoices/:id', () => {
  it('returns the invoice with its items and business details', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);

    const res = await agent.get(`/invoices/${invoiceId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.invoice.id).toBe(invoiceId);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data).toHaveProperty('business');
  });

  it('returns 404 for another user\'s invoice', async () => {
    // Ownership must be enforced server-side, not by hiding the id.
    const owner = await registerUser();
    const attacker = await registerUser();
    const { invoiceId } = await createInvoice(owner.agent);

    const res = await attacker.agent.get(`/invoices/${invoiceId}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-existent id', async () => {
    const { agent } = await registerUser();

    const res = await agent.get('/invoices/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
  });

  it('handles a malformed uuid without a 500', async () => {
    const { agent } = await registerUser();

    // Regression: this previously reached Postgres as an invalid uuid cast and
    // surfaced as a 500, leaking a database error for what is a bad request.
    const res = await agent.get('/invoices/not-a-uuid');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('PUT /invoices/:id', () => {
  it('updates a draft invoice and recomputes totals', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);

    const res = await agent.put(`/invoices/${invoiceId}`).send(
      fakeInvoice({
        client_name: 'Renamed Client',
        items: [fakeItem({ quantity: 4, unit_price: 100000 })],
      })
    );

    expect(res.status).toBe(200);
    const { rows } = await getPool().query(
      'SELECT client_name, total_amount FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(rows[0].client_name).toBe('Renamed Client');
    expect(Number(rows[0].total_amount)).toBe(400000);
  });

  it('replaces line items rather than appending', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);

    await agent
      .put(`/invoices/${invoiceId}`)
      .send(fakeInvoice({ items: [fakeItem({ description: 'Only item' })] }));

    const { rows } = await getPool().query(
      'SELECT description FROM invoice_items WHERE invoice_id = $1',
      [invoiceId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe('Only item');
  });

  it('refuses to edit an invoice that has been sent', async () => {
    // Changing a sent invoice would desync the client's copy from ours.
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);
    await agent.post(`/invoices/${invoiceId}/send`);

    const res = await agent.put(`/invoices/${invoiceId}`).send(fakeInvoice());

    // The API reports a disallowed state transition as 400 INVALID_STATE.
    // (409 Conflict would be more precise; changing it is an API decision.)
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('cannot update another user\'s invoice', async () => {
    const owner = await registerUser();
    const attacker = await registerUser();
    const { invoiceId } = await createInvoice(owner.agent);

    const res = await attacker.agent
      .put(`/invoices/${invoiceId}`)
      .send(fakeInvoice({ client_name: 'Hacked' }));

    expect(res.status).toBe(404);

    const { rows } = await getPool().query('SELECT client_name FROM invoices WHERE id = $1', [
      invoiceId,
    ]);
    expect(rows[0].client_name).not.toBe('Hacked');
  });
});

describe('DELETE /invoices/:id', () => {
  it('deletes a draft invoice', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);

    const res = await agent.delete(`/invoices/${invoiceId}`);

    expect(res.status).toBe(200);
    expect((await agent.get(`/invoices/${invoiceId}`)).status).toBe(404);
  });

  it('cannot delete another user\'s invoice', async () => {
    const owner = await registerUser();
    const attacker = await registerUser();
    const { invoiceId } = await createInvoice(owner.agent);

    const res = await attacker.agent.delete(`/invoices/${invoiceId}`);

    expect(res.status).toBe(404);
    expect((await owner.agent.get(`/invoices/${invoiceId}`)).status).toBe(200);
  });

  it('returns 404 when deleting twice', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);
    await agent.delete(`/invoices/${invoiceId}`);

    const res = await agent.delete(`/invoices/${invoiceId}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /invoices/:id/duplicate', () => {
  it('creates an independent draft copy with a new number', async () => {
    const { agent } = await registerUser();
    const original = await createInvoice(agent, { client_name: 'Repeat Client' });

    const res = await agent.post(`/invoices/${original.invoiceId}/duplicate`);

    expect(res.status).toBe(201);
    expect(res.body.data.invoiceId).not.toBe(original.invoiceId);
    expect(res.body.data.invoiceNumber).not.toBe(original.invoiceNumber);

    const copy = await agent.get(`/invoices/${res.body.data.invoiceId}`);
    expect(copy.body.data.invoice.client_name).toBe('Repeat Client');
    expect(copy.body.data.invoice.status).toBe('DRAFT');
    expect(copy.body.data.items).toHaveLength(1);
  });

  it('duplicates a sent invoice back to draft', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);
    await agent.post(`/invoices/${invoiceId}/send`);

    const res = await agent.post(`/invoices/${invoiceId}/duplicate`);

    expect(res.status).toBe(201);
    const copy = await agent.get(`/invoices/${res.body.data.invoiceId}`);
    expect(copy.body.data.invoice.status).toBe('DRAFT');
  });

  it('cannot duplicate another user\'s invoice', async () => {
    const owner = await registerUser();
    const attacker = await registerUser();
    const { invoiceId } = await createInvoice(owner.agent);

    const res = await attacker.agent.post(`/invoices/${invoiceId}/duplicate`);

    expect(res.status).toBe(404);
  });
});

describe('GET /invoices/summary', () => {
  it('is matched as a route, not treated as an invoice id', async () => {
    // Route ordering regression: /summary must precede /:invoiceId.
    const { agent } = await registerUser();

    const res = await agent.get('/invoices/summary');

    expect(res.status).toBe(200);
  });
});
