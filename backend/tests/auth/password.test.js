import { describe, it, expect, vi } from 'vitest';
import { client, registerUser } from '../helpers/api.js';
import { getPool } from '../helpers/testDb.js';
import { __outbox } from '../helpers/outbox.js';

/**
 * Password reset is the most attacked flow in most applications: it hands out a
 * credential over email. These cover token single-use, expiry, hashing at rest
 * and the deliberate refusal to reveal whether an address is registered.
 */
async function requestReset(email) {
  const res = await client().post('/auth/forgot-password').send({ email });
  expect(res.status).toBe(200);

  // The email is dispatched inside the request, but assert via the outbox.
  await vi.waitFor(
    () => {
      expect(__outbox.filter((m) => m.type === 'passwordReset').length).toBeGreaterThan(0);
    },
    { timeout: 5000, interval: 50 }
  );

  const message = __outbox.filter((m) => m.type === 'passwordReset').pop();
  const token = /token=([a-f0-9]+)/.exec(message.text || message.html || '')?.[1];
  expect(token).toBeTruthy();
  return token;
}

describe('POST /auth/forgot-password', () => {
  it('emails a reset link to a registered address', async () => {
    const { credentials } = await registerUser();

    const token = await requestReset(credentials.email);

    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('stores only a hash of the token', async () => {
    // A leaked database must not yield usable reset links.
    const { credentials } = await registerUser();

    const token = await requestReset(credentials.email);

    const { rows } = await getPool().query('SELECT token_hash FROM password_resets');
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toBe(token);
    expect(rows[0].token_hash).toHaveLength(64);
  });

  it('sets an expiry on the token', async () => {
    const { credentials } = await registerUser();
    await requestReset(credentials.email);

    const { rows } = await getPool().query('SELECT expires_at FROM password_resets');
    expect(rows[0].expires_at.getTime()).toBeGreaterThan(Date.now());
  });

  it('gives the same response for an unknown address', async () => {
    // Differing responses would let an attacker enumerate registered users.
    const known = await registerUser();
    const forKnown = await client()
      .post('/auth/forgot-password')
      .send({ email: known.credentials.email });

    const forUnknown = await client()
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.test' });

    expect(forUnknown.status).toBe(forKnown.status);
    expect(forUnknown.body).toEqual(forKnown.body);
  });

  it('sends no email for an unknown address', async () => {
    await client().post('/auth/forgot-password').send({ email: 'nobody@example.test' });

    expect(__outbox.filter((m) => m.type === 'passwordReset')).toHaveLength(0);
  });

  it('accepts a differently-cased address', async () => {
    const { credentials } = await registerUser({ email: 'Reset.Case@example.test' });

    await requestReset(credentials.email.toUpperCase());

    const { rows } = await getPool().query('SELECT count(*)::int AS n FROM password_resets');
    expect(rows[0].n).toBe(1);
  });

  it('succeeds without an email in the body rather than erroring', async () => {
    const res = await client().post('/auth/forgot-password').send({});

    expect(res.status).toBe(200);
  });
});

describe('POST /auth/reset-password', () => {
  it('sets a new password that can be used to log in', async () => {
    const { credentials } = await registerUser();
    const token = await requestReset(credentials.email);

    const res = await client()
      .post('/auth/reset-password')
      .send({ token, newPassword: 'BrandNewPass123' });

    expect(res.status).toBe(200);

    const login = await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: 'BrandNewPass123' });
    expect(login.status).toBe(200);
  });

  it('invalidates the old password', async () => {
    const { credentials } = await registerUser();
    const token = await requestReset(credentials.email);
    await client().post('/auth/reset-password').send({ token, newPassword: 'BrandNewPass123' });

    const login = await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expect(login.status).toBe(401);
  });

  it('consumes the token so a leaked link cannot be replayed', async () => {
    const { credentials } = await registerUser();
    const token = await requestReset(credentials.email);
    await client().post('/auth/reset-password').send({ token, newPassword: 'FirstReset123' });

    const second = await client()
      .post('/auth/reset-password')
      .send({ token, newPassword: 'SecondReset123' });

    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects an expired token', async () => {
    const { credentials } = await registerUser();
    const token = await requestReset(credentials.email);
    await getPool().query(
      "UPDATE password_resets SET expires_at = now() - interval '1 hour'"
    );

    const res = await client()
      .post('/auth/reset-password')
      .send({ token, newPassword: 'BrandNewPass123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects an unknown token', async () => {
    const res = await client()
      .post('/auth/reset-password')
      .send({ token: 'a'.repeat(64), newPassword: 'BrandNewPass123' });

    expect(res.status).toBe(400);
  });

  it('rejects a weak new password', async () => {
    const { credentials } = await registerUser();
    const token = await requestReset(credentials.email);

    const res = await client().post('/auth/reset-password').send({ token, newPassword: 'abc' });

    expect(res.status).toBe(422);
  });

  it('stores the new password hashed', async () => {
    const { credentials } = await registerUser();
    const token = await requestReset(credentials.email);

    await client().post('/auth/reset-password').send({ token, newPassword: 'BrandNewPass123' });

    const { rows } = await getPool().query('SELECT password FROM users WHERE email = $1', [
      credentials.email.toLowerCase(),
    ]);
    expect(rows[0].password).not.toBe('BrandNewPass123');
    expect(rows[0].password).toMatch(/^\$2[aby]\$/);
  });
});

describe('POST /auth/change-password', () => {
  it('changes the password when the current one is correct', async () => {
    const { agent, credentials } = await registerUser();

    const res = await agent
      .post('/auth/change-password')
      .send({ currentPassword: credentials.password, newPassword: 'ChangedPass123' });

    expect(res.status).toBe(200);

    const login = await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: 'ChangedPass123' });
    expect(login.status).toBe(200);
  });

  it('rejects an incorrect current password', async () => {
    const { agent } = await registerUser();

    const res = await agent
      .post('/auth/change-password')
      .send({ currentPassword: 'WrongPassword123', newPassword: 'ChangedPass123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects a weak new password', async () => {
    const { agent, credentials } = await registerUser();

    const res = await agent
      .post('/auth/change-password')
      .send({ currentPassword: credentials.password, newPassword: 'abc' });

    expect(res.status).toBe(422);
  });

  it.each([
    ['missing current', { newPassword: 'ChangedPass123' }],
    ['missing new', { currentPassword: 'CorrectHorse123' }],
    ['empty body', {}],
  ])('rejects a malformed request (%s)', async (_label, body) => {
    const { agent } = await registerUser();

    const res = await agent.post('/auth/change-password').send(body);

    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await client()
      .post('/auth/change-password')
      .send({ currentPassword: 'a', newPassword: 'b' });

    expect(res.status).toBe(401);
  });
});
