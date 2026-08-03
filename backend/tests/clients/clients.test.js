import { describe, it, expect, vi } from 'vitest';
import { client, registerUser, createClientRecord } from '../helpers/api.js';
import { fakeClient } from '../fixtures/index.js';
import { getPool } from '../helpers/testDb.js';

// External services are mocked here rather than in a setup file: vi.mock() is
// hoisted to the top of the file it appears in, so it must be declared per test
// file to apply to this module graph.
vi.mock('../../src/utils/email.js', () => import('../mocks/email.mock.js'));
vi.mock('../../src/payments/stripe.js', () => import('../mocks/stripe.mock.js'));


describe('POST /clients', () => {
  it('creates a client', async () => {
    // Arrange
    const { agent } = await registerUser();
    const payload = fakeClient({ client_name: 'Acme Ltd' });

    // Act
    const res = await agent.post('/clients').send(payload);

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.data.client_name).toBe('Acme Ltd');
    expect(res.body.data.id).toBeTruthy();
  });

  it('rejects a missing client name with 422', async () => {
    const { agent } = await registerUser();

    const res = await agent.post('/clients').send(fakeClient({ client_name: '' }));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a whitespace-only client name', async () => {
    const { agent } = await registerUser();

    const res = await agent.post('/clients').send(fakeClient({ client_name: '   ' }));

    expect(res.status).toBe(422);
  });

  it('allows two clients with the same name', async () => {
    // Real businesses legitimately have duplicate contact names.
    const { agent } = await registerUser();
    await agent.post('/clients').send(fakeClient({ client_name: 'Same Name' }));

    const res = await agent.post('/clients').send(fakeClient({ client_name: 'Same Name' }));

    expect(res.status).toBe(201);
  });

  it('scopes the client to the creating user', async () => {
    const { agent, userId } = await registerUser();

    const res = await agent.post('/clients').send(fakeClient());

    const { rows } = await getPool().query('SELECT user_id FROM clients WHERE id = $1', [
      res.body.data.id,
    ]);
    expect(rows[0].user_id).toBe(userId);
  });

  it('requires authentication', async () => {
    const res = await client().post('/clients').send(fakeClient());

    expect(res.status).toBe(401);
  });
});

describe('GET /clients', () => {
  it('lists only the requesting user\'s clients', async () => {
    const userA = await registerUser();
    const userB = await registerUser();
    await createClientRecord(userA.agent);
    await createClientRecord(userA.agent);
    await createClientRecord(userB.agent);

    const res = await userA.agent.get('/clients');

    expect(res.status).toBe(200);
    expect(res.body.data.clients).toHaveLength(2);
  });

  it('returns an empty list for a new user', async () => {
    const { agent } = await registerUser();

    const res = await agent.get('/clients');

    expect(res.body.data.clients).toEqual([]);
  });

  it('searches by name', async () => {
    const { agent } = await registerUser();
    await createClientRecord(agent, { client_name: 'Findable Industries' });
    await createClientRecord(agent, { client_name: 'Unrelated Co' });

    const res = await agent.get('/clients?q=Findable');

    expect(res.body.data.clients).toHaveLength(1);
  });

  it('searches case-insensitively', async () => {
    const { agent } = await registerUser();
    await createClientRecord(agent, { client_name: 'MixedCase Corp' });

    const res = await agent.get('/clients?q=mixedcase');

    expect(res.body.data.clients).toHaveLength(1);
  });

  it('searches by email', async () => {
    const { agent } = await registerUser();
    await createClientRecord(agent, { email: 'searchable@example.test' });

    const res = await agent.get('/clients?q=searchable');

    expect(res.body.data.clients).toHaveLength(1);
  });

  it('returns no matches rather than an error for an unmatched search', async () => {
    const { agent } = await registerUser();
    await createClientRecord(agent);

    const res = await agent.get('/clients?q=zzzznotfound');

    expect(res.status).toBe(200);
    expect(res.body.data.clients).toEqual([]);
  });

  it('paginates', async () => {
    const { agent } = await registerUser();
    for (let i = 0; i < 3; i++) await createClientRecord(agent);

    const res = await agent.get('/clients?page=1&limit=2');

    expect(res.body.data.clients).toHaveLength(2);
  });

  it('caps an excessive page size', async () => {
    // Prevents a client requesting the entire table in one call.
    const { agent } = await registerUser();
    await createClientRecord(agent);

    const res = await agent.get('/clients?limit=100000');

    expect(res.status).toBe(200);
  });
});

describe('GET /clients/:id', () => {
  it('returns the client', async () => {
    const { agent } = await registerUser();
    const created = await createClientRecord(agent, { client_name: 'Readable Co' });

    const res = await agent.get(`/clients/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.client_name).toBe('Readable Co');
  });

  it('returns 404 for another user\'s client', async () => {
    const owner = await registerUser();
    const attacker = await registerUser();
    const created = await createClientRecord(owner.agent);

    const res = await attacker.agent.get(`/clients/${created.id}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for an unknown id', async () => {
    const { agent } = await registerUser();

    const res = await agent.get('/clients/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
  });
});

describe('PUT /clients/:id', () => {
  it('updates the client', async () => {
    const { agent } = await registerUser();
    const created = await createClientRecord(agent);

    const res = await agent
      .put(`/clients/${created.id}`)
      .send({ client_name: 'Updated Name', phone: '+91 11111 11111' });

    expect(res.status).toBe(200);
    expect(res.body.data.client_name).toBe('Updated Name');
  });

  it('cannot update another user\'s client', async () => {
    const owner = await registerUser();
    const attacker = await registerUser();
    const created = await createClientRecord(owner.agent, { client_name: 'Protected' });

    const res = await attacker.agent.put(`/clients/${created.id}`).send({ client_name: 'Hacked' });

    expect(res.status).toBe(404);
    const { rows } = await getPool().query('SELECT client_name FROM clients WHERE id = $1', [
      created.id,
    ]);
    expect(rows[0].client_name).toBe('Protected');
  });
});

describe('DELETE /clients/:id', () => {
  it('deletes the client', async () => {
    const { agent } = await registerUser();
    const created = await createClientRecord(agent);

    const res = await agent.delete(`/clients/${created.id}`);

    expect(res.status).toBe(200);
    expect((await agent.get(`/clients/${created.id}`)).status).toBe(404);
  });

  it('cannot delete another user\'s client', async () => {
    const owner = await registerUser();
    const attacker = await registerUser();
    const created = await createClientRecord(owner.agent);

    const res = await attacker.agent.delete(`/clients/${created.id}`);

    expect(res.status).toBe(404);
    expect((await owner.agent.get(`/clients/${created.id}`)).status).toBe(200);
  });

  it('returns 404 on a second delete', async () => {
    const { agent } = await registerUser();
    const created = await createClientRecord(agent);
    await agent.delete(`/clients/${created.id}`);

    const res = await agent.delete(`/clients/${created.id}`);

    expect(res.status).toBe(404);
  });

  it('leaves existing invoices intact after the client is deleted', async () => {
    // Invoices snapshot client details, so history must survive.
    const { agent } = await registerUser();
    const created = await createClientRecord(agent, { client_name: 'Historic Client' });
    const invoice = await agent
      .post('/invoices')
      .send({
        type: 'SERVICE',
        client_id: created.id,
        client_name: 'Historic Client',
        currency: 'INR',
        items: [{ description: 'Work', quantity: 1, unit_price: 100000 }],
      });
    expect(invoice.status).toBe(201);

    await agent.delete(`/clients/${created.id}`);

    const res = await agent.get(`/invoices/${invoice.body.data.invoiceId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.invoice.client_name).toBe('Historic Client');
  });
});
