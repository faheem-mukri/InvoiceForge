/**
 * Database lifecycle for integration tests.
 *
 * Loaded after envSetup, which has already pointed DATABASE_URL at the test
 * database. Creates the schema once, then truncates before every test so cases
 * are order independent and leave nothing behind.
 */
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { ensureDatabaseExists, migrate, truncateAll, closePool } from '../helpers/testDb.js';
import { resetEmailMock } from '../mocks/email.mock.js';
import { resetStripeMock } from '../mocks/stripe.mock.js';

beforeAll(async () => {
  try {
    await ensureDatabaseExists();
    await migrate();
    await truncateAll();
  } catch (err) {
    // Fail with actionable guidance rather than a raw ECONNREFUSED.
    throw new Error(
      `Could not prepare the test database.\n\n` +
        `  ${err.message}\n\n` +
        `Integration tests need a running PostgreSQL server.\n` +
        `  • Target: ${process.env.TEST_DATABASE_URL}\n` +
        `  • Start PostgreSQL, or set TEST_DATABASE_URL to a reachable instance.\n` +
        `  • Unit tests need no database: npx vitest run --project unit\n`
    );
  }
});

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
