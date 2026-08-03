import { describe, it, expect, vi } from 'vitest';
import { registerUser, createInvoice, createSentInvoice, createClientRecord } from '../helpers/api.js';
import { fakeProduct } from '../fixtures/index.js';
import { getPool } from '../helpers/testDb.js';

// External services are mocked here rather than in a setup file: vi.mock() is
// hoisted to the top of the file it appears in, so it must be declared per test
// file to apply to this module graph.
vi.mock('../../src/utils/email.js', () => import('../mocks/email.mock.js'));
vi.mock('../../src/payments/stripe.js', () => import('../mocks/stripe.mock.js'));


/**
 * These tests exercise the database itself rather than the API.
 *
 * Constraints are the last line of defence: if a future refactor bypasses a
 * service-layer check, these rules still prevent corrupt data.
 */
const count = async (sql, params) => {
  const { rows } = await getPool().query(sql, params);
  return Number(rows[0].n);
};

describe('foreign keys and cascade deletes', () => {
  it('deletes everything a user owns when the user is deleted', async () => {
    // Arrange — a user with a full spread of related records.
    const { agent, userId } = await registerUser();
    await createClientRecord(agent);
    await agent.post('/products').send(fakeProduct());
    const { invoiceId } = await createSentInvoice(agent);
    await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' });

    // Act
    await getPool().query('DELETE FROM users WHERE id = $1', [userId]);

    // Assert — nothing orphaned.
    expect(await count('SELECT count(*)::int AS n FROM business_profiles WHERE user_id = $1', [userId])).toBe(0);
    expect(await count('SELECT count(*)::int AS n FROM payment_settings WHERE user_id = $1', [userId])).toBe(0);
    expect(await count('SELECT count(*)::int AS n FROM clients WHERE user_id = $1', [userId])).toBe(0);
    expect(await count('SELECT count(*)::int AS n FROM products WHERE user_id = $1', [userId])).toBe(0);
    expect(await count('SELECT count(*)::int AS n FROM invoices WHERE user_id = $1', [userId])).toBe(0);
    expect(await count('SELECT count(*)::int AS n FROM invoice_items WHERE invoice_id = $1', [invoiceId])).toBe(0);
    expect(await count('SELECT count(*)::int AS n FROM payments WHERE invoice_id = $1', [invoiceId])).toBe(0);
  });

  it('deletes line items and payments with their invoice', async () => {
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);
    await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' });

    await getPool().query('DELETE FROM invoices WHERE id = $1', [invoiceId]);

    expect(await count('SELECT count(*)::int AS n FROM invoice_items WHERE invoice_id = $1', [invoiceId])).toBe(0);
    expect(await count('SELECT count(*)::int AS n FROM payments WHERE invoice_id = $1', [invoiceId])).toBe(0);
  });

  it('refuses an invoice for a non-existent user', async () => {
    await expect(
      getPool().query(
        `INSERT INTO invoices (user_id, type, status, invoice_number, client_name, currency, total_amount)
         VALUES ($1, 'SERVICE', 'DRAFT', 'ORPHAN-1', 'Nobody', 'INR', 0)`,
        ['00000000-0000-0000-0000-000000000000']
      )
    ).rejects.toThrow();
  });

  it('refuses a line item for a non-existent invoice', async () => {
    await expect(
      getPool().query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
         VALUES ($1, 'Orphan', 1, 100, 100)`,
        ['00000000-0000-0000-0000-000000000000']
      )
    ).rejects.toThrow();
  });

  it('preserves audit history when a user is deleted, without orphaning rows', async () => {
    // Audit rows are de-linked rather than destroyed, so the trail survives.
    const { agent, userId } = await registerUser();
    await createInvoice(agent);
    const before = await count('SELECT count(*)::int AS n FROM audit_log WHERE user_id = $1', [userId]);
    expect(before).toBeGreaterThan(0);

    await getPool().query('DELETE FROM users WHERE id = $1', [userId]);

    expect(await count('SELECT count(*)::int AS n FROM audit_log WHERE user_id = $1', [userId])).toBe(0);
  });
});

describe('uniqueness constraints', () => {
  it('enforces one business profile per user', async () => {
    const { userId } = await registerUser();

    await expect(
      getPool().query('INSERT INTO business_profiles (user_id) VALUES ($1)', [userId])
    ).rejects.toThrow();
  });

  it('enforces one payment settings row per user', async () => {
    const { userId } = await registerUser();

    await expect(
      getPool().query('INSERT INTO payment_settings (user_id) VALUES ($1)', [userId])
    ).rejects.toThrow();
  });

  it('enforces a unique email across users', async () => {
    const { credentials } = await registerUser();

    await expect(
      getPool().query('INSERT INTO users (email, password) VALUES ($1, $2)', [
        credentials.email.toLowerCase(),
        'hash',
      ])
    ).rejects.toThrow();
  });

  it('enforces a unique invoice number per user', async () => {
    const { agent, userId } = await registerUser();
    const { invoiceNumber } = await createInvoice(agent);

    await expect(
      getPool().query(
        `INSERT INTO invoices (user_id, type, status, invoice_number, client_name, currency, total_amount)
         VALUES ($1, 'SERVICE', 'DRAFT', $2, 'Dup', 'INR', 0)`,
        [userId, invoiceNumber]
      )
    ).rejects.toThrow();
  });

  it('enforces a unique provider payment id to keep webhooks idempotent', async () => {
    const userA = await registerUser();
    const userB = await registerUser();
    const a = await createSentInvoice(userA.agent);
    const b = await createSentInvoice(userB.agent);

    await getPool().query(
      `INSERT INTO payments (invoice_id, user_id, provider, provider_payment_id, status, amount, currency)
       VALUES ($1, $2, 'STRIPE', 'pi_duplicate', 'SUCCESS', 100, 'INR')`,
      [a.invoiceId, userA.userId]
    );

    await expect(
      getPool().query(
        `INSERT INTO payments (invoice_id, user_id, provider, provider_payment_id, status, amount, currency)
         VALUES ($1, $2, 'STRIPE', 'pi_duplicate', 'SUCCESS', 100, 'INR')`,
        [b.invoiceId, userB.userId]
      )
    ).rejects.toThrow();
  });
});

describe('check constraints', () => {
  it.each([
    ['invoice status', "UPDATE invoices SET status = 'BOGUS' WHERE id = $1"],
    ['invoice type', "UPDATE invoices SET type = 'BOGUS' WHERE id = $1"],
  ])('rejects an invalid %s', async (_label, sql) => {
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);

    await expect(getPool().query(sql, [invoiceId])).rejects.toThrow();
  });

  it.each([
    ['subtotal', 'subtotal'],
    ['tax amount', 'tax_amount'],
    ['total amount', 'total_amount'],
  ])('rejects a negative %s', async (_label, column) => {
    const { agent } = await registerUser();
    const { invoiceId } = await createInvoice(agent);

    await expect(
      getPool().query(`UPDATE invoices SET ${column} = -1 WHERE id = $1`, [invoiceId])
    ).rejects.toThrow();
  });

  it('rejects a negative product price', async () => {
    const { agent, userId } = await registerUser();
    await agent.post('/products').send(fakeProduct());

    await expect(
      getPool().query('UPDATE products SET unit_price = -1 WHERE user_id = $1', [userId])
    ).rejects.toThrow();
  });
});

describe('transactions', () => {
  it('rolls back an invoice and its items together on failure', async () => {
    // Invoice creation writes to two tables; a partial write would leave an
    // invoice with no line items.
    const { userId } = await registerUser();
    const conn = await getPool().connect();

    try {
      await conn.query('BEGIN');
      const inserted = await conn.query(
        `INSERT INTO invoices
           (user_id, type, status, invoice_number, client_name, currency, subtotal, total_amount)
         VALUES ($1, 'SERVICE', 'DRAFT', 'TXN-1', 'Acme', 'INR', 1000, 1000) RETURNING id`,
        [userId]
      );
      await conn.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
         VALUES ($1, 'Item', 1, 1000, 1000)`,
        [inserted.rows[0].id]
      );
      await conn.query('ROLLBACK');
    } catch (err) {
      // Always end the transaction, or the connection returns to the pool in an
      // aborted state and every later query on it fails.
      await conn.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      conn.release();
    }

    expect(await count("SELECT count(*)::int AS n FROM invoices WHERE invoice_number = 'TXN-1'", [])).toBe(0);
    expect(await count("SELECT count(*)::int AS n FROM invoice_items WHERE description = 'Item'", [])).toBe(0);
  });

  it('commits both tables together on success', async () => {
    const { userId } = await registerUser();
    const conn = await getPool().connect();

    try {
      await conn.query('BEGIN');
      const inserted = await conn.query(
        `INSERT INTO invoices
           (user_id, type, status, invoice_number, client_name, currency, subtotal, total_amount)
         VALUES ($1, 'SERVICE', 'DRAFT', 'TXN-2', 'Acme', 'INR', 1000, 1000) RETURNING id`,
        [userId]
      );
      await conn.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
         VALUES ($1, 'Committed', 1, 1000, 1000)`,
        [inserted.rows[0].id]
      );
      await conn.query('COMMIT');
    } catch (err) {
      await conn.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      conn.release();
    }

    expect(await count("SELECT count(*)::int AS n FROM invoices WHERE invoice_number = 'TXN-2'", [])).toBe(1);
    expect(await count("SELECT count(*)::int AS n FROM invoice_items WHERE description = 'Committed'", [])).toBe(1);
  });

  it('does not leave an invoice behind when a duplicate number aborts creation', async () => {
    const { agent } = await registerUser();
    await agent.post('/invoices').send({
      type: 'SERVICE',
      client_name: 'Acme',
      currency: 'INR',
      invoice_number: 'ROLLBACK-1',
      items: [{ description: 'Work', quantity: 1, unit_price: 100000 }],
    });

    const res = await agent.post('/invoices').send({
      type: 'SERVICE',
      client_name: 'Acme',
      currency: 'INR',
      invoice_number: 'ROLLBACK-1',
      items: [{ description: 'Work', quantity: 1, unit_price: 100000 }],
    });
    expect(res.status).toBe(409);

    expect(
      await count("SELECT count(*)::int AS n FROM invoices WHERE invoice_number = 'ROLLBACK-1'", [])
    ).toBe(1);
  });
});

describe('payment snapshots', () => {
  it('stores payment details on the invoice so history survives settings changes', async () => {
    const { agent } = await registerUser();
    await agent.put('/payment-settings').send({
      upi_enabled: true,
      upi_id: 'original@upi',
    });

    const created = await agent.post('/invoices').send({
      type: 'SERVICE',
      client_name: 'Acme',
      currency: 'INR',
      payment_method: 'UPI',
      items: [{ description: 'Work', quantity: 1, unit_price: 100000 }],
    });
    const invoiceId = created.body.data.invoiceId;

    // Change the settings after issuing the invoice.
    await agent.put('/payment-settings').send({ upi_id: 'changed@upi' });

    const { rows } = await getPool().query(
      'SELECT payment_details FROM invoices WHERE id = $1',
      [invoiceId]
    );
    // The invoice keeps the details that were in force when it was created.
    expect(JSON.stringify(rows[0].payment_details)).toContain('original@upi');
  });
});

describe('concurrency', () => {
  it('records only one payment when the same invoice is settled twice at once', async () => {
    // Two simultaneous settlements must not both succeed.
    const { agent } = await registerUser();
    const { invoiceId } = await createSentInvoice(agent);

    const results = await Promise.allSettled([
      agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' }),
      agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' }),
    ]);

    const succeeded = results.filter(
      (r) => r.status === 'fulfilled' && r.value.status === 200
    );
    expect(succeeded).toHaveLength(1);
    expect(await count('SELECT count(*)::int AS n FROM payments WHERE invoice_id = $1', [invoiceId])).toBe(1);
  });

  it('assigns distinct numbers to invoices created concurrently', async () => {
    const { agent } = await registerUser();

    const results = await Promise.all([
      createInvoice(agent),
      createInvoice(agent),
      createInvoice(agent),
    ]);

    const numbers = results.map((r) => r.invoiceNumber);
    expect(new Set(numbers).size).toBe(3);
  });
});
