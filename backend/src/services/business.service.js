const pool = require("../db");

// Returns the user's business profile, creating an empty one if missing.
async function getBusinessProfile(userId) {
  let result = await pool.query(
    `SELECT * FROM business_profiles WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    result = await pool.query(
      `INSERT INTO business_profiles (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [userId]
    );
  }

  return result.rows[0];
}

const UPDATABLE = [
  "business_name",
  "business_email",
  "business_phone",
  "business_address",
  "business_logo",
  "website",
  "gst_number",
  "tax_id",
  "default_currency",
  "default_payment_method",
  "invoice_prefix",
];

async function updateBusinessProfile(userId, data) {
  // Ensure a row exists first.
  await getBusinessProfile(userId);

  const sets = [];
  const values = [userId];

  for (const field of UPDATABLE) {
    if (data[field] !== undefined) {
      values.push(data[field] === "" ? null : data[field]);
      sets.push(`${field} = $${values.length}`);
    }
  }

  if (sets.length === 0) {
    return getBusinessProfile(userId);
  }

  const result = await pool.query(
    `UPDATE business_profiles
     SET ${sets.join(", ")}, updated_at = now()
     WHERE user_id = $1
     RETURNING *`,
    values
  );

  return result.rows[0];
}

// Generates the next sequential invoice number for a user and bumps the counter
// atomically. Used when the client doesn't supply an invoice number.
async function nextInvoiceNumber(executor, userId) {
  const runner = executor || pool;
  const result = await runner.query(
    `UPDATE business_profiles
     SET invoice_counter = invoice_counter + 1, updated_at = now()
     WHERE user_id = $1
     RETURNING invoice_prefix, invoice_counter`,
    [userId]
  );

  if (result.rows.length === 0) {
    // No profile yet (shouldn't happen) — fall back to a timestamp.
    return `INV-${Date.now()}`;
  }

  const { invoice_prefix, invoice_counter } = result.rows[0];
  const padded = String(invoice_counter).padStart(4, "0");
  return `${invoice_prefix || "INV"}-${padded}`;
}

module.exports = {
  getBusinessProfile,
  updateBusinessProfile,
  nextInvoiceNumber,
};
