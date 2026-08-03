/**
 * Runs once per test worker, before any test file.
 *
 * Responsibilities:
 *  1. Force a test environment with deterministic secrets.
 *  2. Point the app's database pool at the TEST database.
 *  3. Mock every external service so no real network call can happen.
 *  4. Create the schema, and truncate between each test for isolation.
 */
import { beforeAll, afterAll, beforeEach, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 1. Environment ──────────────────────────────────────────────────────────
// Load .env first (for a local TEST_DATABASE_URL), then force test values.
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

process.env.NODE_ENV = 'test';

// Deterministic, obviously-fake secrets. Never reuse real ones in tests.
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.ENCRYPTION_KEY = '0'.repeat(64); // 32-byte hex for AES-256-GCM
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.API_URL = 'http://localhost:4000';

// Rate limiting is off by default so unrelated suites don't trip it. The
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
 *   2. DATABASE_URL with "_test" appended to the database name. This reuses the
 *      developer's existing credentials and host, so no extra setup is needed,
 *      while never pointing at the development database itself.
 */
function resolveTestDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) {
    return 'postgresql://postgres:postgres@localhost:5432/invoiceforge_test';
  }

  // Swap only the final path segment (the database name), preserving any
  // query string such as ?sslmode=require.
  const [beforeQuery, query] = devUrl.split('?');
  const segments = beforeQuery.split('/');
  const dbName = segments.pop();
  const testDbName = dbName.endsWith('_test') ? dbName : `${dbName}_test`;
  const rebuilt = [...segments, testDbName].join('/');
  return query ? `${rebuilt}?${query}` : rebuilt;
}

// The app reads DATABASE_URL; point it at the test database before src/db loads.
const TEST_DB_URL = resolveTestDatabaseUrl();
process.env.TEST_DATABASE_URL = TEST_DB_URL;
process.env.DATABASE_URL = TEST_DB_URL;
process.env.DATABASE_SSL = process.env.TEST_DATABASE_SSL || 'false';

// ── 2. Mock external services ───────────────────────────────────────────────
// Mocked at the module boundary so the rest of the app runs for real.
// Paths must be literals: vi.mock calls are hoisted to the top of the file.
vi.mock('../../src/payments/stripe.js', () => import('../mocks/stripe.mock.js'));
vi.mock('../../src/utils/email.js', () => import('../mocks/email.mock.js'));

// ── 3. Fail loudly on unexpected outbound HTTP ──────────────────────────────
// A test reaching the internet is a bug: slow, flaky, and dependent on third
// parties. Supertest drives the app in-process and does not use global fetch,
// so trapping it here is safe.
globalThis.fetch = vi.fn(async (url) => {
  throw new Error(
    `Unexpected outbound HTTP request to "${url}" during tests. ` +
      'External services must be mocked — see tests/mocks/.'
  );
});

// ── 4. Database lifecycle ───────────────────────────────────────────────────
import { ensureDatabaseExists, migrate, truncateAll, closePool } from '../helpers/testDb.js';
import { resetEmailMock } from '../mocks/email.mock.js';
import { resetStripeMock } from '../mocks/stripe.mock.js';

beforeAll(async () => {
  await ensureDatabaseExists();
  await migrate();
  await truncateAll();
});

// Every test starts from an empty database, so cases are order independent.
beforeEach(async () => {
  await truncateAll();
  resetEmailMock();
  resetStripeMock();
});

afterAll(async () => {
  await closePool();
  // Release the app's own pool so the worker can exit cleanly.
  try {
    const dbModule = await import('../../src/db.js');
    await (dbModule.default ?? dbModule).end();
  } catch {
    // Already closed, or never opened.
  }
});
