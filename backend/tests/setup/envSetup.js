/**
 * Environment + external-service mocking.
 *
 * Shared by both test projects. Contains NO database work, so pure unit tests
 * can run with no PostgreSQL instance available.
 */
import { vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env first (for local credentials), then force test values.
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

process.env.NODE_ENV = 'test';

// Deterministic, obviously-fake secrets. Never reuse real ones in tests.
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.ENCRYPTION_KEY = '0'.repeat(64); // 32-byte hex for AES-256-GCM
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.API_URL = 'http://localhost:4000';

// Rate limiting is off by default so unrelated suites don't trip it; the
// dedicated rate-limit test opts back in.
process.env.DISABLE_RATE_LIMIT = 'true';

// Strip credentials for anything that must never be contacted.
delete process.env.STRIPE_SECRET_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_HOST;
delete process.env.GOOGLE_CLIENT_ID;

// Email is captured at the HTTP boundary rather than module-mocked (see
// tests/helpers/outbox.js). Selecting the Brevo provider with a fake key means
// the real email code runs and its outbound request is intercepted below.
process.env.BREVO_API_KEY = 'test-brevo-key-not-real';
process.env.EMAIL_FROM = 'InvoiceForge <no-reply@invoiceforge.test>';

/**
 * Resolve the test database.
 *
 * Preference order:
 *   1. TEST_DATABASE_URL — explicit, used by CI.
 *   2. DATABASE_URL with "_test" appended to the database name, reusing the
 *      developer's existing credentials and host while never pointing at the
 *      development database itself.
 */
function resolveTestDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) return 'postgresql://postgres:postgres@localhost:5432/invoiceforge_test';

  // Swap only the final path segment (database name), preserving any query
  // string such as ?sslmode=require.
  const [beforeQuery, query] = devUrl.split('?');
  const segments = beforeQuery.split('/');
  const dbName = segments.pop();
  const testDbName = dbName.endsWith('_test') ? dbName : `${dbName}_test`;
  const rebuilt = [...segments, testDbName].join('/');
  return query ? `${rebuilt}?${query}` : rebuilt;
}

const TEST_DB_URL = resolveTestDatabaseUrl();
process.env.TEST_DATABASE_URL = TEST_DB_URL;
// The app reads DATABASE_URL; point it at the test database before src/db loads.
process.env.DATABASE_URL = TEST_DB_URL;
process.env.DATABASE_SSL = process.env.TEST_DATABASE_SSL || 'false';

// ── Why vi.mock is not used for services ────────────────────────────────────
// The application is CommonJS and loads its dependencies with require(), which
// Node's loader resolves directly — Vitest's mock registry is never consulted.
// vi.mock() therefore cannot replace src/utils/email.js or src/payments/stripe.js,
// wherever it is declared. Two mechanisms are used instead:
//
//   Stripe — src/payments/stripe.js resolves its client on every property
//            access, so dbSetup injects a fake client via __setTestClient().
//   Email  — captured at the HTTP boundary: the Brevo provider is selected with
//            a fake key below and the outbound request is intercepted, so the
//            real email code runs and is asserted on (see helpers/outbox.js).

// ── Intercept outbound HTTP ─────────────────────────────────────────────────
// Known providers are captured; anything else throws, because a test reaching
// the internet is a bug — slow, flaky and dependent on third parties. Supertest
// drives the app in-process and does not use global fetch, so this is safe.
// Unit tests that exercise fetch directly (e.g. FX rates) override it.
import { handleBrevoRequest } from '../helpers/outbox.js';

// Fixed FX rates, so multi-currency assertions are deterministic instead of
// depending on the day's market data. The unreachable-provider fallback is
// covered separately in tests/utils/exchangeRates.test.js.
export const TEST_FX_RATES = { USD: 1, INR: 80, EUR: 0.9, GBP: 0.8 };

globalThis.fetch = vi.fn(async (url, init) => {
  const target = String(url);

  if (target.includes('api.brevo.com')) return handleBrevoRequest(init);

  if (target.includes('open.er-api.com')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ result: 'success', rates: TEST_FX_RATES }),
      text: async () => JSON.stringify({ result: 'success', rates: TEST_FX_RATES }),
    };
  }

  throw new Error(
    `Unexpected outbound HTTP request to "${target}" during tests. ` +
      'External services must be intercepted — see tests/helpers/outbox.js.'
  );
});
