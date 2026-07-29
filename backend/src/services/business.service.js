const pool = require("../db");
const { validateImage } = require("../utils/imageValidate");

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
  "logo_data",
  "logo_mime",
  "website",
  "gst_number",
  "tax_id",
  "default_currency",
  "default_payment_method",
  "invoice_prefix",
];

// Logos are stored as base64 in the DB (hosts like Render have an ephemeral
// filesystem, so on-disk uploads would disappear on redeploy). Keep them small
// so invoice/PDF payloads stay reasonable.
// Only PNG and JPEG — PDFKit cannot embed WebP, so accepting it would produce
// invoices with a missing logo.
const ALLOWED_LOGO_MIME = ["image/png", "image/jpeg"];
const MAX_LOGO_BYTES = 512 * 1024; // 512 KB decoded

function validateLogo(data) {
  if (data.logo_data === undefined) return;

  // Explicit removal.
  if (data.logo_data === null || data.logo_data === "") {
    data.logo_data = null;
    data.logo_mime = null;
    return;
  }

  const mime = data.logo_mime;
  if (!ALLOWED_LOGO_MIME.includes(mime)) throw new Error("INVALID_LOGO_TYPE");

  // Accept either a raw base64 string or a full data URL.
  const base64 = String(data.logo_data).replace(/^data:[^;]+;base64,/, "").trim();
  if (!/^[A-Za-z0-9+/\r\n]+={0,2}$/.test(base64)) throw new Error("INVALID_LOGO_DATA");

  const buf = Buffer.from(base64, "base64");
  if (buf.length === 0) throw new Error("INVALID_LOGO_DATA");
  if (buf.length > MAX_LOGO_BYTES) throw new Error("LOGO_TOO_LARGE");

  // Deep-validate now: a corrupt image would otherwise crash the process at
  // PDF-render time (PDFKit's PNG decoder throws asynchronously).
  const problem = validateImage(buf, mime);
  if (problem) throw new Error(problem);

  data.logo_data = buf.toString("base64");
}

async function updateBusinessProfile(userId, data) {
  // Ensure a row exists first.
  await getBusinessProfile(userId);

  validateLogo(data);

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
