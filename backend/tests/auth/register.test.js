import { describe, it, expect } from 'vitest';
import { client } from '../helpers/api.js';
import { fakeUser } from '../fixtures/index.js';
import { getPool } from '../helpers/testDb.js';

describe('POST /auth/register', () => {
  it('creates a user and returns a session', async () => {
    // Arrange
    const payload = fakeUser();

    // Act
    const res = await client().post('/auth/register').send(payload);

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBeTruthy();

    const { rows } = await getPool().query('SELECT email FROM users WHERE email = $1', [
      payload.email.toLowerCase(),
    ]);
    expect(rows).toHaveLength(1);
  });

  it('sets httpOnly auth cookies', async () => {
    const res = await client().post('/auth/register').send(fakeUser());

    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies.join(';')).toMatch(/HttpOnly/i);
  });

  it('stores the password as a bcrypt hash, never in plain text', async () => {
    const payload = fakeUser();

    await client().post('/auth/register').send(payload);

    const { rows } = await getPool().query('SELECT password FROM users WHERE email = $1', [
      payload.email.toLowerCase(),
    ]);
    expect(rows[0].password).not.toBe(payload.password);
    expect(rows[0].password).toMatch(/^\$2[aby]\$/); // bcrypt signature
  });

  it('provisions business profile and payment settings rows', async () => {
    const payload = fakeUser();

    await client().post('/auth/register').send(payload);

    const { rows } = await getPool().query(
      `SELECT
         (SELECT count(*) FROM business_profiles bp WHERE bp.user_id = u.id) AS profiles,
         (SELECT count(*) FROM payment_settings ps WHERE ps.user_id = u.id) AS settings
       FROM users u WHERE u.email = $1`,
      [payload.email.toLowerCase()]
    );
    expect(Number(rows[0].profiles)).toBe(1);
    expect(Number(rows[0].settings)).toBe(1);
  });

  it('rejects a duplicate email with 409', async () => {
    const payload = fakeUser();
    await client().post('/auth/register').send(payload);

    const res = await client().post('/auth/register').send(payload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('treats email as case-insensitive when detecting duplicates', async () => {
    // Without normalisation these would become two accounts, and the user could
    // be locked out by their own capitalisation.
    await client().post('/auth/register').send(fakeUser({ email: 'Mixed.Case@example.test' }));

    const res = await client()
      .post('/auth/register')
      .send(fakeUser({ email: 'mixed.case@example.test' }));

    expect(res.status).toBe(409);
  });

  it('stores the email lowercased', async () => {
    await client().post('/auth/register').send(fakeUser({ email: 'CAPS@example.test' }));

    const { rows } = await getPool().query('SELECT email FROM users');
    expect(rows[0].email).toBe('caps@example.test');
  });

  it.each([
    ['missing @', 'not-an-email'],
    ['missing domain', 'user@'],
    ['missing local part', '@example.test'],
    ['contains a space', 'user name@example.test'],
    ['no dot in domain', 'user@example'],
  ])('rejects an invalid email (%s)', async (_label, email) => {
    const res = await client().post('/auth/register').send(fakeUser({ email }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_EMAIL');
  });

  it.each([
    ['too short', 'abc123'],
    ['digits only', '12345678'],
    ['letters only', 'password'],
  ])('rejects a weak password (%s)', async (_label, password) => {
    const res = await client().post('/auth/register').send(fakeUser({ password }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WEAK_PASSWORD');
  });

  it.each([
    ['no body', {}],
    ['email only', { email: 'a@b.test' }],
    ['password only', { password: 'CorrectHorse123' }],
  ])('rejects a request with missing fields (%s)', async (_label, body) => {
    const res = await client().post('/auth/register').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_FIELD');
  });

  it('never leaks a password hash in the response', async () => {
    const res = await client().post('/auth/register').send(fakeUser());

    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
  });
});
