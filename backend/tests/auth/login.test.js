import { describe, it, expect } from 'vitest';
import { client, registerUser } from '../helpers/api.js';
import { fakeUser } from '../fixtures/index.js';
import { getPool } from '../helpers/testDb.js';

describe('POST /auth/login', () => {
  it('logs in with correct credentials and sets auth cookies', async () => {
    // Arrange
    const credentials = fakeUser();
    await client().post('/auth/register').send(credentials);

    // Act
    const res = await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBeTruthy();

    const cookies = (res.headers['set-cookie'] || []).join(';');
    expect(cookies).toMatch(/HttpOnly/i);
  });

  it('accepts a differently-cased email', async () => {
    const credentials = fakeUser({ email: 'Casing.Test@example.test' });
    await client().post('/auth/register').send(credentials);

    const res = await client()
      .post('/auth/login')
      .send({ email: 'CASING.TEST@EXAMPLE.TEST', password: credentials.password });

    expect(res.status).toBe(200);
  });

  it('records the login timestamp', async () => {
    const credentials = fakeUser();
    await client().post('/auth/register').send(credentials);

    await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    const { rows } = await getPool().query(
      'SELECT last_login_at FROM users WHERE email = $1',
      [credentials.email.toLowerCase()]
    );
    expect(rows[0].last_login_at).toBeInstanceOf(Date);
  });

  it('rejects a wrong password with 401', async () => {
    const credentials = fakeUser();
    await client().post('/auth/register').send(credentials);

    const res = await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: 'WrongPassword123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an unknown email with 401', async () => {
    const res = await client()
      .post('/auth/login')
      .send({ email: 'nobody@example.test', password: 'CorrectHorse123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('uses an identical error for unknown email and wrong password', async () => {
    // Distinguishing them would let an attacker enumerate registered accounts.
    const credentials = fakeUser();
    await client().post('/auth/register').send(credentials);

    const wrongPassword = await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: 'WrongPassword123' });
    const unknownEmail = await client()
      .post('/auth/login')
      .send({ email: 'nobody@example.test', password: 'WrongPassword123' });

    expect(wrongPassword.status).toBe(unknownEmail.status);
    expect(wrongPassword.body.error).toEqual(unknownEmail.body.error);
  });

  it.each([
    ['no body', {}],
    ['missing password', { email: 'a@b.test' }],
    ['missing email', { password: 'CorrectHorse123' }],
  ])('rejects a malformed request (%s)', async (_label, body) => {
    const res = await client().post('/auth/login').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_FIELD');
  });

  it('never returns the password hash', async () => {
    const credentials = fakeUser();
    await client().post('/auth/register').send(credentials);

    const res = await client()
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
  });
});

describe('GET /auth/me', () => {
  it('returns the authenticated user', async () => {
    const { agent, credentials } = await registerUser();

    const res = await agent.get('/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(credentials.email.toLowerCase());
    expect(res.body.data.password).toBeUndefined();
  });

  it('returns 401 without a session', async () => {
    const res = await client().get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /auth/logout', () => {
  it('clears the session so protected routes reject the agent', async () => {
    const { agent } = await registerUser();
    expect((await agent.get('/auth/me')).status).toBe(200);

    const logout = await agent.post('/auth/logout');

    expect(logout.status).toBe(200);
    expect((await agent.get('/auth/me')).status).toBe(401);
  });

  it('succeeds even when no session exists', async () => {
    // Logout must be idempotent so a stale tab can't produce an error.
    const res = await client().post('/auth/logout');

    expect(res.status).toBe(200);
  });
});

describe('POST /auth/refresh', () => {
  it('issues a new session from the refresh cookie', async () => {
    const { agent } = await registerUser();

    const res = await agent.post('/auth/refresh');

    expect(res.status).toBe(200);
    expect((await agent.get('/auth/me')).status).toBe(200);
  });

  it('rejects a request with no refresh cookie', async () => {
    const res = await client().post('/auth/refresh');

    expect(res.status).toBe(401);
  });

  it('rejects a forged refresh cookie', async () => {
    const res = await client()
      .post('/auth/refresh')
      .set('Cookie', 'refresh_token=not-a-real-jwt');

    expect(res.status).toBe(401);
  });

  it('cannot be performed with an access token in place of a refresh token', async () => {
    // The two secrets are distinct, so an access token must not be accepted
    // here — otherwise a stolen access token could be renewed indefinitely.
    const { agent } = await registerUser();
    const me = await agent.get('/auth/me');
    expect(me.status).toBe(200);

    const accessCookie = (me.request.cookies || '')
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('access_token='));
    const accessToken = accessCookie ? accessCookie.split('=')[1] : null;
    expect(accessToken).toBeTruthy();

    const res = await client()
      .post('/auth/refresh')
      .set('Cookie', `refresh_token=${accessToken}`);

    expect(res.status).toBe(401);
  });
});
