import { describe, it, expect } from 'vitest';
import * as otplib from 'otplib';
import { client, registerUser } from '../helpers/api.js';
import { getPool } from '../helpers/testDb.js';

/**
 * Two-factor auth is the strongest account protection the product offers, so
 * these cover the full lifecycle: setup, confirmation, the two-phase login it
 * introduces, and disabling. They also assert the secret is encrypted at rest —
 * a stored plaintext secret would make 2FA decorative.
 */
const codeFor = (secret) => otplib.generate({ secret });

async function setupTwoFactor(agent) {
  const res = await agent.post('/auth/2fa/setup');
  expect(res.status).toBe(200);
  return res.body.data; // { secret, otpauthUrl, qr }
}

async function enableTwoFactor(agent) {
  const { secret } = await setupTwoFactor(agent);
  const res = await agent.post('/auth/2fa/enable').send({ code: await codeFor(secret) });
  expect(res.status).toBe(200);
  return secret;
}

describe('POST /auth/2fa/setup', () => {
  it('returns a secret, an otpauth URL and a scannable QR code', async () => {
    const { agent } = await registerUser();

    const data = await setupTwoFactor(agent);

    expect(data.secret).toBeTruthy();
    expect(data.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(data.qr).toMatch(/^data:image\/png;base64,/);
  });

  it('does not enable 2FA until a code is confirmed', async () => {
    // Enabling on setup alone would lock out anyone who never scanned the code.
    const { agent, userId } = await registerUser();

    await setupTwoFactor(agent);

    const { rows } = await getPool().query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );
    expect(rows[0].two_factor_enabled).toBe(false);
  });

  it('stores the secret encrypted, not in plain text', async () => {
    const { agent, userId } = await registerUser();

    const { secret } = await setupTwoFactor(agent);

    const { rows } = await getPool().query(
      'SELECT two_factor_secret FROM users WHERE id = $1',
      [userId]
    );
    expect(rows[0].two_factor_secret).not.toBe(secret);
    expect(rows[0].two_factor_secret).toMatch(/^enc:v1:/);
  });

  it('requires authentication', async () => {
    const res = await client().post('/auth/2fa/setup');

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/2fa/enable', () => {
  it('enables 2FA when the code is correct', async () => {
    const { agent, userId } = await registerUser();
    const { secret } = await setupTwoFactor(agent);

    const res = await agent.post('/auth/2fa/enable').send({ code: await codeFor(secret) });

    expect(res.status).toBe(200);
    const { rows } = await getPool().query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );
    expect(rows[0].two_factor_enabled).toBe(true);
  });

  it('rejects an incorrect code', async () => {
    const { agent } = await registerUser();
    await setupTwoFactor(agent);

    const res = await agent.post('/auth/2fa/enable').send({ code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_2FA_CODE');
  });

  it('rejects enabling before setup has run', async () => {
    const { agent } = await registerUser();

    const res = await agent.post('/auth/2fa/enable').send({ code: '123456' });

    expect(res.status).toBe(400);
  });

  it('is reflected in the user profile', async () => {
    const { agent } = await registerUser();
    await enableTwoFactor(agent);

    const me = await agent.get('/auth/me');

    expect(me.body.data.twoFactorEnabled).toBe(true);
  });
});

describe('login with 2FA enabled', () => {
  it('does not issue a session from the password alone', async () => {
    // The whole point: a stolen password must not be sufficient.
    const { agent, credentials } = await registerUser();
    await enableTwoFactor(agent);

    const res = await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expect(res.status).toBe(200);
    expect(res.body.data.twoFactorRequired).toBe(true);
    expect(res.body.data.mfaToken).toBeTruthy();
    expect(res.body.data.userId).toBeUndefined();

    const cookies = (res.headers['set-cookie'] || []).join(';');
    expect(cookies).not.toMatch(/access_token=[^;]+/);
  });

  it('completes the login with a valid code', async () => {
    const { agent, credentials } = await registerUser();
    const secret = await enableTwoFactor(agent);

    const second = client();
    const first = await second
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    const res = await client()
      .post('/auth/2fa/login')
      .send({ mfaToken: first.body.data.mfaToken, code: await codeFor(secret) });

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBeTruthy();
    expect((res.headers['set-cookie'] || []).join(';')).toMatch(/HttpOnly/i);
  });

  it('rejects an incorrect code', async () => {
    const { agent, credentials } = await registerUser();
    await enableTwoFactor(agent);
    const first = await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    const res = await client()
      .post('/auth/2fa/login')
      .send({ mfaToken: first.body.data.mfaToken, code: '000000' });

    expect(res.status).toBe(401);
  });

  it('rejects a forged interim token', async () => {
    const res = await client()
      .post('/auth/2fa/login')
      .send({ mfaToken: 'not-a-real-token', code: '123456' });

    expect(res.status).toBe(401);
  });

  it('requires both the token and the code', async () => {
    const res = await client().post('/auth/2fa/login').send({ code: '123456' });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/2fa/disable', () => {
  it('disables 2FA with a valid code', async () => {
    const { agent, userId } = await registerUser();
    const secret = await enableTwoFactor(agent);

    const res = await agent.post('/auth/2fa/disable').send({ code: await codeFor(secret) });

    expect(res.status).toBe(200);
    const { rows } = await getPool().query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );
    expect(rows[0].two_factor_enabled).toBe(false);
  });

  it('refuses to disable without a valid code', async () => {
    // Otherwise a hijacked session could strip the second factor.
    const { agent, userId } = await registerUser();
    await enableTwoFactor(agent);

    const res = await agent.post('/auth/2fa/disable').send({ code: '000000' });

    expect(res.status).toBe(400);
    const { rows } = await getPool().query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );
    expect(rows[0].two_factor_enabled).toBe(true);
  });

  it('restores single-factor login once disabled', async () => {
    const { agent, credentials } = await registerUser();
    const secret = await enableTwoFactor(agent);
    await agent.post('/auth/2fa/disable').send({ code: await codeFor(secret) });

    const res = await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expect(res.body.data.twoFactorRequired).toBeUndefined();
    expect(res.body.data.userId).toBeTruthy();
  });

  it('requires authentication', async () => {
    const res = await client().post('/auth/2fa/disable').send({ code: '123456' });

    expect(res.status).toBe(401);
  });
});
