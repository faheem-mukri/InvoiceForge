import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { client, registerUser } from '../helpers/api.js';

// External services are mocked here rather than in a setup file: vi.mock() is
// hoisted to the top of the file it appears in, so it must be declared per test
// file to apply to this module graph.
vi.mock('../../src/utils/email.js', () => import('../mocks/email.mock.js'));
vi.mock('../../src/payments/stripe.js', () => import('../mocks/stripe.mock.js'));


/** Signs a token directly so we can forge expiry, audience and secret. */
const sign = (payload, options = {}) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m', ...options });

// Every authenticated route should behave identically for a bad token.
const PROTECTED_ROUTES = [
  ['GET', '/auth/me'],
  ['GET', '/invoices'],
  ['GET', '/clients'],
  ['GET', '/products'],
  ['GET', '/dashboard'],
  ['GET', '/business'],
  ['GET', '/payment-settings'],
  ['GET', '/payments'],
];

describe('requireAuth middleware', () => {
  describe('missing credentials', () => {
    it.each(PROTECTED_ROUTES)('%s %s returns 401 without a token', async (method, path) => {
      const res = await client()[method.toLowerCase()](path);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('does not leak data in the 401 body', async () => {
      const res = await client().get('/invoices');

      expect(res.body.data).toBeUndefined();
    });
  });

  describe('invalid tokens', () => {
    it('rejects a structurally invalid token', async () => {
      const res = await client().get('/auth/me').set('Cookie', 'access_token=garbage');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });

    it('rejects a token signed with the wrong secret', async () => {
      // Catches a deployment where secrets were rotated or mismatched.
      const forged = jwt.sign({ userId: 'abc' }, 'attacker-secret', { expiresIn: '15m' });

      const res = await client().get('/auth/me').set('Cookie', `access_token=${forged}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });

    it('rejects a token signed with the refresh secret', async () => {
      const refreshSigned = jwt.sign({ userId: 'abc' }, process.env.JWT_REFRESH_SECRET);

      const res = await client()
        .get('/auth/me')
        .set('Cookie', `access_token=${refreshSigned}`);

      expect(res.status).toBe(401);
    });

    it('distinguishes an expired token so the client knows to refresh', async () => {
      const expired = sign({ userId: 'abc' }, { expiresIn: '-1s' });

      const res = await client().get('/auth/me').set('Cookie', `access_token=${expired}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('rejects an unsigned ("alg: none") token', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify({ userId: 'abc' })).toString('base64url');

      const res = await client()
        .get('/auth/me')
        .set('Cookie', `access_token=${header}.${body}.`);

      expect(res.status).toBe(401);
    });
  });

  describe('valid credentials', () => {
    it('accepts a Bearer header for non-browser API clients', async () => {
      const { userId } = await registerUser();
      const token = sign({ userId });

      const res = await client().get('/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(userId);
    });

    it('ignores a malformed Authorization header', async () => {
      const res = await client().get('/auth/me').set('Authorization', 'Basic dXNlcjpwYXNz');

      expect(res.status).toBe(401);
    });

    it('prefers the cookie over a Bearer header', async () => {
      // Browsers are the primary client; the cookie is the authoritative source.
      const { agent, userId } = await registerUser();
      const otherToken = sign({ userId: '00000000-0000-0000-0000-000000000000' });

      const res = await agent.get('/auth/me').set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(userId);
    });

    it('rejects a well-formed token for a user that no longer exists', async () => {
      // Deleting an account must invalidate outstanding tokens.
      const orphan = sign({ userId: '00000000-0000-0000-0000-000000000000' });

      const res = await client().get('/auth/me').set('Cookie', `access_token=${orphan}`);

      expect(res.status).toBe(404);
    });
  });
});

describe('routing and error handling', () => {
  it('returns 404 for an unknown route', async () => {
    const res = await client().get('/this-route-does-not-exist');

    expect(res.status).toBe(404);
  });

  it('returns 404 for an unknown method on a known path', async () => {
    const res = await client().patch('/auth/login');

    expect(res.status).toBe(404);
  });

  it('exposes an unauthenticated health check for uptime monitoring', async () => {
    const res = await client().get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('rejects malformed JSON with 400 rather than crashing', async () => {
    const res = await client()
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.test", ');

    expect(res.status).toBe(400);
  });

  it('sets security headers via helmet', async () => {
    const res = await client().get('/health');

    expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
  });

  it('does not advertise the server technology', async () => {
    const res = await client().get('/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
