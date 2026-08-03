import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { fakeUser } from '../fixtures/index.js';

// External services are mocked here rather than in a setup file: vi.mock() is
// hoisted to the top of the file it appears in, so it must be declared per test
// file to apply to this module graph.
vi.mock('../../src/utils/email.js', () => import('../mocks/email.mock.js'));
vi.mock('../../src/payments/stripe.js', () => import('../mocks/stripe.mock.js'));


/**
 * The rest of the suite disables rate limiting (a full run makes far more than
 * 20 auth calls). This file re-enables it with a small ceiling and loads a fresh
 * app instance, so the real middleware is exercised without leaking a limiter
 * that would then throttle other suites.
 */
describe('auth rate limiter', () => {
  let app;

  beforeAll(async () => {
    process.env.DISABLE_RATE_LIMIT = 'false';
    process.env.AUTH_RATE_LIMIT_MAX = '5';
    // Required for the limiter to key on X-Forwarded-For, which is how each
    // test gets its own counter.
    process.env.TRUST_PROXY = 'true';

    vi.resetModules();
    const mod = await import('../../src/app.js');
    app = mod.default ?? mod;
  });

  afterAll(() => {
    // Restore the suite-wide defaults so subsequent files aren't throttled.
    process.env.DISABLE_RATE_LIMIT = 'true';
    delete process.env.AUTH_RATE_LIMIT_MAX;
    delete process.env.TRUST_PROXY;
    vi.resetModules();
  });

  // express-rate-limit keys by IP and the counter persists across requests, so
  // each test needs a distinct source address to start from zero.
  let ipCounter = 0;
  const nextIp = () => `10.0.0.${(ipCounter = (ipCounter + 1) % 250) + 1}`;

  beforeEach(() => {
    ipCounter += 1;
  });

  it('allows requests below the limit', async () => {
    const ip = nextIp();

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'nobody@example.test', password: 'WrongPassword123' });

      expect(res.status).not.toBe(429);
    }
  });

  it('returns 429 once the limit is exceeded', async () => {
    const ip = nextIp();

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'nobody@example.test', password: 'WrongPassword123' });
    }

    const blocked = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'nobody@example.test', password: 'WrongPassword123' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('throttles registration too, not just login', async () => {
    const ip = nextIp();

    for (let i = 0; i < 5; i++) {
      await request(app).post('/auth/register').set('X-Forwarded-For', ip).send(fakeUser());
    }

    const blocked = await request(app)
      .post('/auth/register')
      .set('X-Forwarded-For', ip)
      .send(fakeUser());

    expect(blocked.status).toBe(429);
  });

  it('throttles password-reset requests', async () => {
    // Otherwise this endpoint becomes a free email-bombing tool.
    const ip = nextIp();

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/auth/forgot-password')
        .set('X-Forwarded-For', ip)
        .send({ email: 'someone@example.test' });
    }

    const blocked = await request(app)
      .post('/auth/forgot-password')
      .set('X-Forwarded-For', ip)
      .send({ email: 'someone@example.test' });

    expect(blocked.status).toBe(429);
  });

  it('limits per IP, so one attacker cannot lock everyone out', async () => {
    const attacker = nextIp();
    for (let i = 0; i < 6; i++) {
      await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', attacker)
        .send({ email: 'nobody@example.test', password: 'WrongPassword123' });
    }

    const innocent = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'nobody@example.test', password: 'WrongPassword123' });

    expect(innocent.status).not.toBe(429);
  });

  it('does not throttle unauthenticated read endpoints', async () => {
    const ip = nextIp();

    for (let i = 0; i < 8; i++) {
      await request(app).get('/health').set('X-Forwarded-For', ip);
    }

    const res = await request(app).get('/health').set('X-Forwarded-For', ip);

    expect(res.status).toBe(200);
  });

  it('advertises the limit via standard RateLimit headers', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'nobody@example.test', password: 'WrongPassword123' });

    const headerNames = Object.keys(res.headers).join(',');
    expect(headerNames).toMatch(/ratelimit/i);
  });
});
