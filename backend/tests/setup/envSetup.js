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
delete process.env.BREVO_API_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_HOST;
delete process.env.GOOGLE_CLIENT_ID;

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

// ── Mock external services ──────────────────────────────────────────────────
// Mocked at the module boundary so the rest of the app runs for real.
// Paths must be literals: vi.mock calls are hoisted to the top of the file.
vi.mock('../../src/payments/stripe.js', () => import('../mocks/stripe.mock.js'));
vi.mock('../../src/utils/email.js', () => import('../mocks/email.mock.js'));

// ── Fail loudly on unexpected outbound HTTP ─────────────────────────────────
// A test reaching the internet is a bug: slow, flaky, dependent on third
// parties. Supertest drives the app in-process and doesn't use global fetch, so
// trapping it here is safe. Tests that need fetch (e.g. FX rates) stub it.
globalThis.fetch = vi.fn(async (url) => {
  throw new Error(
    `Unexpected outbound HTTP request to "${url}" during tests. ` +
      'External services must be mocked — see tests/mocks/.'
  );
});
