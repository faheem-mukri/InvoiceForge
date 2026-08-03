/**
 * Test database lifecycle.
 *
 * SAFETY: this module refuses to run against anything that doesn't look like a
 * dedicated test database. Truncating the development database by accident is
 * unrecoverable, so the guard is deliberately strict and fails loudly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, '..', '..', 'db', 'schema.sql');

// Tables truncated between tests. `users` cascades to everything owned by a
// user; the rest are listed for tables not reachable by cascade.
export const TABLES = [
  'audit_log',
  'password_resets',
  'payments',
  'invoice_items',
  'invoices',
  'products',
  'clients',
  'payment_settings',
  'business_profiles',
  'users',
];

function getConnectionString() {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Tests need a dedicated database — see TESTING.md.'
    );
  }
  return url;
}

/**
 * Guard against pointing the suite at a real database. The database name must
 * signal test intent, unless explicitly overridden.
 */
function assertSafeTarget(connectionString) {
  if (process.env.ALLOW_UNSAFE_TEST_DB === 'true') return;

  const dbName = (connectionString.split('/').pop() || '').split('?')[0].toLowerCase();
  if (!dbName) {
    throw new Error('Could not determine the database name from the connection string.');
  }

  if (!dbName.includes('test')) {
    throw new Error(
      `Refusing to run tests against database "${dbName}" because the name does not ` +
        'contain "test". Tests TRUNCATE every table. Point TEST_DATABASE_URL at a ' +
        'dedicated database (e.g. invoiceforge_test), or set ALLOW_UNSAFE_TEST_DB=true ' +
        'if you are certain.'
    );
  }
}

let pool = null;

export function getPool() {
  if (!pool) {
    const connectionString = getConnectionString();
    assertSafeTarget(connectionString);
    pool = new pg.Pool({
      connectionString,
      ssl:
        process.env.TEST_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 5,
    });
  }
  return pool;
}

/**
 * Creates the test database if it doesn't exist yet, by connecting to the
 * server's default `postgres` database. Saves every developer (and CI) from a
 * manual createdb step.
 */
export async function ensureDatabaseExists() {
  const connectionString = getConnectionString();
  assertSafeTarget(connectionString);

  const [beforeQuery, query] = connectionString.split('?');
  const segments = beforeQuery.split('/');
  const dbName = segments.pop();
  const adminUrl = [...segments, 'postgres'].join('/') + (query ? `?${query}` : '');

  const admin = new pg.Client({
    connectionString: adminUrl,
    ssl: process.env.TEST_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await admin.connect();
    const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      dbName,
    ]);
    if (rows.length === 0) {
      // Identifier can't be parameterised; dbName is derived from our own env,
      // and quoting prevents injection via an odd database name.
      await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    }
  } catch (err) {
    // If we can't check/create (e.g. restricted CI role), let migrate() surface
    // the real connection error instead of masking it here.
    if (process.env.DEBUG_TEST_DB) console.error('ensureDatabaseExists:', err.message);
  } finally {
    await admin.end().catch(() => {});
  }
}

/** Creates the schema. Idempotent — schema.sql uses IF NOT EXISTS throughout. */
export async function migrate() {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await getPool().query(sql);
}

/**
 * Wipes all data while keeping the schema. RESTART IDENTITY resets sequences so
 * tests can't depend on ids leaking between cases.
 */
export async function truncateAll() {
  await getPool().query(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
