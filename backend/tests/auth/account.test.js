import { describe, it, expect } from 'vitest';
import { client, registerUser, createInvoice } from '../helpers/api.js';
import { getPool } from '../helpers/testDb.js';

/**
 * Account deletion is a soft delete with a 30-day grace period. The valuable
 * property is that "deleted" means *inaccessible but recoverable* — data must
 * survive the window, the user must be locked out during it, and logging back in
 * must restore everything. Getting this wrong either loses customer data or
 * leaves a supposedly-deleted account usable.
 */
const userRow = async (userId) => {
  const { rows } = await getPool().query('SELECT deleted_at FROM users WHERE id = $1', [userId]);
  return rows[0];
};

describe('DELETE /auth/account', () => {
  it('soft-deletes rather than removing the row', async () => {
    const { agent, credentials, userId } = await registerUser();

    const res = await agent.delete('/auth/account').send({ password: credentials.password });

    expect(res.status).toBe(200);
    const row = await userRow(userId);
    expect(row).toBeDefined();
    expect(row.deleted_at).toBeInstanceOf(Date);
  });

  it('retains the user\'s data during the grace period', async () => {
    // Recovery is only possible if nothing was actually deleted.
    const { agent, credentials, userId } = await registerUser();
    await createInvoice(agent);

    await agent.delete('/auth/account').send({ password: credentials.password });

    const { rows } = await getPool().query(
      'SELECT count(*)::int AS n FROM invoices WHERE user_id = $1',
      [userId]
    );
    expect(rows[0].n).toBe(1);
  });

  it('ends the session', async () => {
    const { agent, credentials } = await registerUser();

    await agent.delete('/auth/account').send({ password: credentials.password });

    expect((await agent.get('/auth/me')).status).toBe(401);
  });

  it('locks the account out of authenticated routes', async () => {
    const { agent, credentials, userId } = await registerUser();
    await agent.delete('/auth/account').send({ password: credentials.password });

    // Even with a freshly minted valid token, the account must be unusable.
    const jwt = (await import('jsonwebtoken')).default;
    const token = jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

    const res = await client().get('/auth/me').set('Cookie', `access_token=${token}`);

    expect(res.status).toBe(404);
  });

  it('requires the correct password', async () => {
    const { agent, userId } = await registerUser();

    const res = await agent.delete('/auth/account').send({ password: 'WrongPassword123' });

    expect(res.status).toBe(401);
    expect((await userRow(userId)).deleted_at).toBeNull();
  });

  it('requires a password to be supplied', async () => {
    const { agent, userId } = await registerUser();

    const res = await agent.delete('/auth/account').send({});

    expect(res.status).toBe(401);
    expect((await userRow(userId)).deleted_at).toBeNull();
  });

  it('requires authentication', async () => {
    const res = await client().delete('/auth/account').send({ password: 'x' });

    expect(res.status).toBe(401);
  });
});

describe('account recovery', () => {
  it('restores the account when the user logs in within the grace period', async () => {
    const { agent, credentials, userId } = await registerUser();
    await agent.delete('/auth/account').send({ password: credentials.password });

    const res = await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expect(res.status).toBe(200);
    expect(res.body.data.restored).toBe(true);
    expect((await userRow(userId)).deleted_at).toBeNull();
  });

  it('gives access back to the user\'s data after restoring', async () => {
    const { agent, credentials } = await registerUser();
    const { invoiceId } = await createInvoice(agent);
    await agent.delete('/auth/account').send({ password: credentials.password });

    const restored = client();
    await restored
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    const me = client();
    const login = await me
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    expect(login.status).toBe(200);

    const res = await me.get(`/invoices/${invoiceId}`);
    expect(res.status).toBe(200);
  });

  it('reports restored: false for an ordinary login', async () => {
    const { credentials } = await registerUser();

    const res = await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expect(res.body.data.restored).toBe(false);
  });

  it('still requires the correct password to recover', async () => {
    const { agent, credentials, userId } = await registerUser();
    await agent.delete('/auth/account').send({ password: credentials.password });

    const res = await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: 'WrongPassword123' });

    expect(res.status).toBe(401);
    expect((await userRow(userId)).deleted_at).toBeInstanceOf(Date);
  });
});

describe('purge after the grace period', () => {
  it('permanently deletes the account on a login attempt once the window has passed', async () => {
    const { agent, credentials, userId } = await registerUser();
    await agent.delete('/auth/account').send({ password: credentials.password });
    await getPool().query(
      "UPDATE users SET deleted_at = now() - interval '31 days' WHERE id = $1",
      [userId]
    );

    const res = await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expect(res.status).toBe(401);
    const { rows } = await getPool().query('SELECT count(*)::int AS n FROM users WHERE id = $1', [
      userId,
    ]);
    expect(rows[0].n).toBe(0);
  });

  it('cascades the purge to the user\'s data', async () => {
    const { agent, credentials, userId } = await registerUser();
    await createInvoice(agent);
    await agent.delete('/auth/account').send({ password: credentials.password });
    await getPool().query(
      "UPDATE users SET deleted_at = now() - interval '31 days' WHERE id = $1",
      [userId]
    );

    await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    const { rows } = await getPool().query(
      'SELECT count(*)::int AS n FROM invoices WHERE user_id = $1',
      [userId]
    );
    expect(rows[0].n).toBe(0);
  });

  it('frees the email address for re-registration once purged', async () => {
    const { agent, credentials, userId } = await registerUser();
    await agent.delete('/auth/account').send({ password: credentials.password });
    await getPool().query(
      "UPDATE users SET deleted_at = now() - interval '31 days' WHERE id = $1",
      [userId]
    );
    await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    const res = await client().post('/auth/register').send(credentials);

    expect(res.status).toBe(201);
  });
});

describe('GET /users/me', () => {
  it('returns the current user', async () => {
    const { agent, credentials } = await registerUser();

    const res = await agent.get('/users/me');

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain(credentials.email.toLowerCase());
  });

  it('requires authentication', async () => {
    const res = await client().get('/users/me');

    expect(res.status).toBe(401);
  });
});

describe('PUT /users/me', () => {
  it('updates the profile', async () => {
    const { agent } = await registerUser();

    const res = await agent.put('/users/me').send({ firstName: 'Updated', lastName: 'Name' });

    expect(res.status).toBe(200);

    const me = await agent.get('/auth/me');
    expect(me.body.data.firstName).toBe('Updated');
  });

  it('requires authentication', async () => {
    const res = await client().put('/users/me').send({ firstName: 'X' });

    expect(res.status).toBe(401);
  });
});
