/**
 * Lightweight audit logging helper.
 *
 * Writes a row into the audit_log table. Accepts an optional pg client so the
 * write can participate in an existing transaction; otherwise it falls back to
 * the shared pool. Audit failures are swallowed (logged only) so they can never
 * break the primary operation they are recording.
 */
const pool = require('../db');

async function recordAudit(executor, { userId, entityType, entityId, action, metadata }) {
  const runner = executor || pool;

  try {
    await runner.query(
      `INSERT INTO audit_log (user_id, entity_type, entity_id, action, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId || null,
        entityType,
        entityId,
        action,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (err) {
    // Never let an audit failure break the main flow.
    console.error('Audit log write failed:', err.message);
  }
}

module.exports = { recordAudit };
