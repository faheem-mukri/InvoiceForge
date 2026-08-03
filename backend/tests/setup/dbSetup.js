/**
 * Database lifecycle for integration tests.
 *
 * Loaded after envSetup, which has already pointed DATABASE_URL at the test
 * database. Creates the schema once, then truncates before every test so cases
 * are order independent and leave nothing behind.
 */
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { ensureDatabaseExists, migrate, truncateAll, closePool } from '../helpers/testDb.js';
import { resetOutbox } from '../helpers/outbox.js';
import stripeModule, { resetStripeMock } from '../mocks/stripe.mock.js';

/**
 * Inject the fake Stripe client into the module the APPLICATION uses.
 *
 * This is subtler than it looks. A CJS file loaded through `await import()` is a
 * *different instance* from the same file loaded through Node's `require()`, and
 * the app uses require(). Injecting into the imported copy sets a closure
 * variable nothing else can see, which is exactly why the first attempt failed.
 *
 * createRequire reaches Node's CJS cache — the same instance the app holds. Both
 * copies are injected anyway, so this keeps working if the loader changes.
 */
const nodeRequire = createRequire(import.meta.url);

function stripeInstances() {
  const found = [];
  try {
    found.push(nodeRequire('../../src/payments/stripe.js'));
  } catch {
    // Not resolvable through Node's loader in this environment.
  }
  return found;
}

async function injectStripe(client) {
  for (const instance of stripeInstances()) {
    instance.__setTestClient(client);
  }
  // Also cover the ESM-transformed copy, in case a module resolved that one.
  try {
    const esm = await import('../../src/payments/stripe.js');
    (esm.default ?? esm).__setTestClient(client);
  } catch {
    // Ignore — the Node instance above is the one that matters.
  }
}

async function resetStripeInjection() {
  for (const instance of stripeInstances()) {
    instance.__resetTestClient();
  }
  try {
    const esm = await import('../../src/payments/stripe.js');
    (esm.default ?? esm).__resetTestClient();
  } catch {
    // Ignore.
  }
}

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
  resetOutbox();
  resetStripeMock();
  // Re-inject every test so a suite that clears mocks can't leak the real
  // client into the next one.
  await injectStripe(stripeModule);
});

afterAll(async () => {
  await resetStripeInjection();
  await closePool();
  // Release the app's own pool so the worker can exit cleanly.
  try {
    const dbModule = await import('../../src/db.js');
    await (dbModule.default ?? dbModule).end();
  } catch {
    // Already closed, or never opened.
  }
});
