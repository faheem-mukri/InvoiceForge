const pool = require("../db");
const { getRates, convertMinor } = require("../utils/exchangeRates");

async function getDashboard(userId) {
  const [counts, revenueByCurrency, recentInvoices, recentClients, businessRes] =
    await Promise.all([
      pool.query(
        `SELECT status, COUNT(*) AS count
         FROM invoices
         WHERE user_id = $1 AND deleted_at IS NULL
         GROUP BY status`,
        [userId]
      ),
      // Revenue grouped by the invoice's own currency, so we can normalize each
      // bucket into the business base currency afterwards.
      pool.query(
        `SELECT
           currency,
           COALESCE(SUM(total_amount), 0) AS total_billed,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'PAID'), 0) AS collected,
           COALESCE(SUM(total_amount) FILTER (WHERE status IN ('SENT', 'OVERDUE')), 0) AS outstanding,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'OVERDUE'), 0) AS overdue_amount
         FROM invoices
         WHERE user_id = $1 AND deleted_at IS NULL
         GROUP BY currency`,
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
      pool.query(
        `SELECT default_currency FROM business_profiles WHERE user_id = $1`,
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

  const baseCurrency = businessRes.rows[0]?.default_currency || "USD";

  // Only hit the FX service if at least one invoice is in a non-base currency.
  const needsConversion = revenueByCurrency.rows.some((r) => r.currency !== baseCurrency);
  const rateInfo = needsConversion ? await getRates() : { rates: null, live: true };

  let totalBilled = 0;
  let collected = 0;
  let outstanding = 0;
  let overdue = 0;
  let approximate = false; // true if any amount couldn't be converted with a known rate

  for (const row of revenueByCurrency.rows) {
    const from = row.currency || baseCurrency;
    const conv = (value) => {
      const n = parseInt(value, 10) || 0;
      if (from === baseCurrency) return n;
      const converted = convertMinor(n, from, baseCurrency, rateInfo.rates);
      if (converted === null) {
        approximate = true; // unknown rate — count the raw amount rather than drop it
        return n;
      }
      return converted;
    };
    totalBilled += conv(row.total_billed);
    collected += conv(row.collected);
    outstanding += conv(row.outstanding);
    overdue += conv(row.overdue_amount);
  }

  return {
    counts: { ...statusCounts, total: totalInvoices },
    revenue: {
      currency: baseCurrency,
      totalBilled,
      collected,
      outstanding,
      overdue,
      // Tells the UI the figures are normalized from multiple currencies, and
      // whether live rates were used.
      mixedCurrency: needsConversion,
      approximate: approximate || (needsConversion && !rateInfo.live),
    },
    recentInvoices: recentInvoices.rows,
    recentClients: recentClients.rows,
  };
}

module.exports = { getDashboard };
