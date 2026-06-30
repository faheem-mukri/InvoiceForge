const pool = require("../db");
const stripe = require("../payments/stripe");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const UPDATABLE = [
  "cash_enabled",
  "bank_enabled",
  "upi_enabled",
  "stripe_enabled",
  "default_method",
  "bank_name",
  "account_holder_name",
  "account_number",
  "ifsc_swift_code",
  "branch_name",
  "account_type",
  "upi_id",
  "upi_merchant_name",
];

async function getPaymentSettings(userId) {
  let result = await pool.query(
    `SELECT * FROM payment_settings WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    result = await pool.query(
      `INSERT INTO payment_settings (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [userId]
    );
  }

  return result.rows[0];
}

async function updatePaymentSettings(userId, data) {
  await getPaymentSettings(userId); // ensure row exists

  const sets = [];
  const values = [userId];

  for (const field of UPDATABLE) {
    if (data[field] !== undefined) {
      let value = data[field];
      if (field.endsWith("_enabled")) value = Boolean(value);
      else if (value === "") value = null;
      values.push(value);
      sets.push(`${field} = $${values.length}`);
    }
  }

  if (sets.length === 0) return getPaymentSettings(userId);

  const result = await pool.query(
    `UPDATE payment_settings
     SET ${sets.join(", ")}, updated_at = now()
     WHERE user_id = $1
     RETURNING *`,
    values
  );

  return result.rows[0];
}

// Build the immutable payment snapshot copied onto an invoice for a given
// method. Returns { provider, details } or null.
function buildPaymentSnapshot(settings, method) {
  if (!settings || !method) return null;

  switch (method) {
    case "BANK_TRANSFER":
      return {
        provider: "MANUAL",
        details: {
          bank_name: settings.bank_name || null,
          account_holder_name: settings.account_holder_name || null,
          account_number: settings.account_number || null,
          ifsc_swift_code: settings.ifsc_swift_code || null,
          branch_name: settings.branch_name || null,
          account_type: settings.account_type || null,
        },
      };
    case "UPI":
      return {
        provider: "MANUAL",
        details: {
          upi_id: settings.upi_id || null,
          upi_merchant_name: settings.upi_merchant_name || null,
        },
      };
    case "ONLINE":
      return { provider: "STRIPE", details: {} };
    case "CASH":
    default:
      return { provider: "MANUAL", details: {} };
  }
}

// ── Stripe Connect ──
async function beginStripeConnect(userId) {
  const settings = await getPaymentSettings(userId);

  try {
    let accountId = settings.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({ type: "express" });
      accountId = account.id;
      await pool.query(
        `UPDATE payment_settings
         SET stripe_account_id = $2, stripe_connection_status = 'PENDING', updated_at = now()
         WHERE user_id = $1`,
        [userId, accountId]
      );
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${FRONTEND_URL}/settings?stripe=refresh`,
      return_url: `${FRONTEND_URL}/settings?stripe=return`,
      type: "account_onboarding",
    });

    return { url: link.url };
  } catch (err) {
    // Connect not enabled on the platform account, etc.
    console.error("Stripe Connect onboarding failed:", err.message);
    throw new Error("STRIPE_CONNECT_UNAVAILABLE");
  }
}

async function refreshStripeStatus(userId) {
  const settings = await getPaymentSettings(userId);
  if (!settings.stripe_account_id) {
    return { stripe_account_id: null, stripe_connection_status: "NOT_CONNECTED" };
  }

  try {
    const account = await stripe.accounts.retrieve(settings.stripe_account_id);
    const status = account.charges_enabled ? "CONNECTED" : "PENDING";
    await pool.query(
      `UPDATE payment_settings SET stripe_connection_status = $2, updated_at = now() WHERE user_id = $1`,
      [userId, status]
    );
    return { stripe_account_id: settings.stripe_account_id, stripe_connection_status: status };
  } catch (err) {
    return {
      stripe_account_id: settings.stripe_account_id,
      stripe_connection_status: settings.stripe_connection_status,
    };
  }
}

module.exports = {
  getPaymentSettings,
  updatePaymentSettings,
  buildPaymentSnapshot,
  beginStripeConnect,
  refreshStripeStatus,
};
