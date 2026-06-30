const pool = require("../db");

async function getDashboard(userId) {
  const [counts, revenue, recentInvoices, recentClients] = await Promise.all([
    pool.query(
      `SELECT status, COUNT(*) AS count
       FROM invoices
       WHERE user_id = $1 AND deleted_at IS NULL
       GROUP BY status`,
      [userId]
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(total_amount), 0) AS total_billed,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'PAID'), 0) AS collected,
         COALESCE(SUM(total_amount) FILTER (WHERE status IN ('SENT', 'OVERDUE')), 0) AS outstanding,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'OVERDUE'), 0) AS overdue_amount
       FROM invoices
       WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    ),
    pool.query(
      `SELECT id, invoice_number, client_name, status, currency, total_amount, due_date, created_at
       FROM invoices
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    ),
    pool.query(
      `SELECT id, client_name, company_name, email, created_at
       FROM clients
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    ),
  ]);

  const statusCounts = { DRAFT: 0, SENT: 0, PAID: 0, OVERDUE: 0, CANCELLED: 0 };
  let totalInvoices = 0;
  counts.rows.forEach((row) => {
    const n = parseInt(row.count, 10);
    statusCounts[row.status] = n;
    totalInvoices += n;
  });

  const rev = revenue.rows[0];

  return {
    counts: { ...statusCounts, total: totalInvoices },
    revenue: {
      totalBilled: parseInt(rev.total_billed, 10),
      collected: parseInt(rev.collected, 10),
      outstanding: parseInt(rev.outstanding, 10),
      overdue: parseInt(rev.overdue_amount, 10),
    },
    recentInvoices: recentInvoices.rows,
    recentClients: recentClients.rows,
  };
}

module.exports = { getDashboard };
