const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL || "";

// Managed Postgres (Render, Railway, Neon, Supabase, etc.) requires SSL for
// connections. Local Postgres typically doesn't. Detect localhost and disable
// SSL there; otherwise connect over SSL. `rejectUnauthorized: false` accepts
// the provider's certificate without a local CA bundle.
const isLocal = /@(localhost|127\.0\.0\.1)/.test(connectionString);

// Explicit override if you ever need it (DATABASE_SSL=true/false).
const sslOverride =
  process.env.DATABASE_SSL === "true"
    ? { rejectUnauthorized: false }
    : process.env.DATABASE_SSL === "false"
    ? false
    : undefined;

const pool = new Pool({
  connectionString,
  ssl: sslOverride !== undefined ? sslOverride : isLocal ? false : { rejectUnauthorized: false },
});

pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL");
});

// Don't let an idle-client error (e.g. the DB dropping a connection) crash the
// whole process.
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err.message);
});

module.exports = pool;
