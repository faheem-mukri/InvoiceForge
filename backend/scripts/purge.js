// Permanently purges soft-deleted accounts whose 30-day grace period has
// elapsed. Intended to be run once a day from a scheduler (Render Cron,
// Railway Cron, system cron, etc.):
//
//   node scripts/purge.js
//
// Exits 0 on success (printing how many accounts were purged), 1 on failure.
const { purgeExpiredAccounts } = require("../src/services/auth.service");
const pool = require("../src/db");

(async () => {
  try {
    const count = await purgeExpiredAccounts();
    console.log(`Purged ${count} expired account(s).`);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Account purge failed:", err);
    try {
      await pool.end();
    } catch {
      // ignore
    }
    process.exit(1);
  }
})();
