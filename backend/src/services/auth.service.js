const pool = require("../db");
const crypto = require("crypto");
const otplib = require("otplib");
const { OAuth2Client } = require("google-auth-library");
const { encrypt, decrypt } = require("../utils/crypto");
const { hashPassword, comparePassword } = require("../utils/password");
const { sendMail } = require("../utils/email");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Soft-deleted accounts are recoverable for this long, then permanently purged.
const GRACE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function isWithinGrace(deletedAt) {
  return deletedAt && Date.now() - new Date(deletedAt).getTime() < GRACE_MS;
}

// Permanently removes accounts whose grace period has elapsed. Safe to call from
// a daily cron; also called opportunistically on login for the account in hand.
async function purgeExpiredAccounts() {
  const cutoff = new Date(Date.now() - GRACE_MS);
  const res = await pool.query(
    "DELETE FROM users WHERE deleted_at IS NOT NULL AND deleted_at < $1 RETURNING id",
    [cutoff]
  );
  return res.rowCount;
}

async function registerUser(email, password, firstName, lastName) {
  const existing = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );

  if (existing.rows.length > 0) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const hashed = await hashPassword(password);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO users (email, password, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [email, hashed, firstName || null, lastName || null]
    );

    const userId = result.rows[0].id;

    // Every user gets a business profile row so the editor can read defaults.
    await client.query(
      `INSERT INTO business_profiles (user_id, business_email)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, email]
    );

    // ...and a payment settings row (Cash enabled by default).
    await client.query(
      `INSERT INTO payment_settings (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    await client.query("COMMIT");
    return { id: userId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function loginUser(email, password) {
  const result = await pool.query(
    "SELECT id, password, two_factor_enabled, deleted_at FROM users WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const user = result.rows[0];

  // Grace period expired → purge and treat as gone.
  if (user.deleted_at && !isWithinGrace(user.deleted_at)) {
    await pool.query("DELETE FROM users WHERE id = $1", [user.id]);
    throw new Error("INVALID_CREDENTIALS");
  }

  if (!user.password) {
    // Account was created via an OAuth provider — no local password.
    throw new Error("USE_SOCIAL_LOGIN");
  }
  const isValid = await comparePassword(password, user.password);

  if (!isValid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // Logging in within the grace window cancels a scheduled deletion.
  const restored = !!user.deleted_at;
  await pool.query(
    "UPDATE users SET last_login_at = now(), deleted_at = NULL WHERE id = $1",
    [user.id]
  );

  return { id: user.id, twoFactorEnabled: user.two_factor_enabled, restored };
}

async function getUserById(userId) {
  const result = await pool.query(
    `SELECT id, email, first_name, last_name, role, created_at, last_login_at,
            notify_on_paid, notify_reminders, two_factor_enabled, auth_provider
     FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  return result.rows[0] || null;
}

async function updateUser(userId, { firstName, lastName, notifyOnPaid, notifyReminders }) {
  const result = await pool.query(
    `UPDATE users
     SET first_name = COALESCE($2, first_name),
         last_name  = COALESCE($3, last_name),
         notify_on_paid = COALESCE($4, notify_on_paid),
         notify_reminders = COALESCE($5, notify_reminders),
         updated_at = now()
     WHERE id = $1
     RETURNING id, email, first_name, last_name, role, created_at,
               notify_on_paid, notify_reminders`,
    [
      userId,
      firstName ?? null,
      lastName ?? null,
      typeof notifyOnPaid === "boolean" ? notifyOnPaid : null,
      typeof notifyReminders === "boolean" ? notifyReminders : null,
    ]
  );
  return result.rows[0] || null;
}

async function changePassword(userId, currentPassword, newPassword) {
  if (!newPassword || newPassword.length < 8) throw new Error("WEAK_PASSWORD");

  const result = await pool.query("SELECT password FROM users WHERE id = $1", [userId]);
  if (result.rows.length === 0) throw new Error("USER_NOT_FOUND");

  const ok = await comparePassword(currentPassword, result.rows[0].password);
  if (!ok) throw new Error("INVALID_CREDENTIALS");

  const hashed = await hashPassword(newPassword);
  await pool.query("UPDATE users SET password = $2, updated_at = now() WHERE id = $1", [
    userId,
    hashed,
  ]);
}

// Creates a single-use reset token (valid 1h) and emails the reset link.
// Always succeeds from the caller's perspective so we never leak which emails exist.
async function createPasswordReset(email) {
  const userRes = await pool.query("SELECT id, first_name FROM users WHERE email = $1", [email]);
  if (userRes.rows.length === 0) return;

  const user = userRes.rows[0];
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
  await sendMail({
    to: email,
    subject: "Reset your InvoiceForge password",
    text: `Hi ${user.first_name || "there"},\n\nReset your password using the link below (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
      <p>Hi ${user.first_name || "there"},</p>
      <p>Reset your password using the button below. This link is valid for 1 hour.</p>
      <p style="margin:24px 0"><a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Reset Password</a></p>
      <p style="color:#6b7280;font-size:12px">If you didn't request this, you can ignore this email.</p>
    </div>`,
  });
}

async function resetPassword(token, newPassword) {
  if (!newPassword || newPassword.length < 8) throw new Error("WEAK_PASSWORD");
  if (!token) throw new Error("INVALID_TOKEN");

  const tokenHash = hashToken(token);
  const result = await pool.query(
    `SELECT id, user_id FROM password_resets
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [tokenHash]
  );
  if (result.rows.length === 0) throw new Error("INVALID_TOKEN");

  const { id, user_id } = result.rows[0];
  const hashed = await hashPassword(newPassword);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE users SET password = $2, updated_at = now() WHERE id = $1", [user_id, hashed]);
    await client.query("UPDATE password_resets SET used_at = now() WHERE id = $1", [id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ── Google OAuth ──
async function findOrCreateGoogleUser(credential) {
  if (!process.env.GOOGLE_CLIENT_ID) throw new Error("GOOGLE_NOT_CONFIGURED");

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new Error("INVALID_GOOGLE_TOKEN");
  }

  if (!payload || !payload.email) throw new Error("INVALID_GOOGLE_TOKEN");

  const email = payload.email.toLowerCase();
  const googleId = payload.sub;
  const firstName = payload.given_name || null;
  const lastName = payload.family_name || null;

  // Existing user by google_id or email → restore (if soft-deleted within
  // grace), purge-and-recreate (if grace expired), or simply link/return.
  const existing = await pool.query(
    "SELECT id, deleted_at FROM users WHERE google_id = $1 OR email = $2",
    [googleId, email]
  );

  if (existing.rows.length > 0) {
    const { id, deleted_at } = existing.rows[0];

    if (deleted_at && !isWithinGrace(deleted_at)) {
      // Grace expired — purge the dead account and fall through to create fresh.
      await pool.query("DELETE FROM users WHERE id = $1", [id]);
    } else {
      // Active, or soft-deleted within grace → logging in cancels the deletion.
      await pool.query(
        `UPDATE users SET google_id = COALESCE(google_id, $2),
           auth_provider = CASE WHEN password IS NULL THEN 'GOOGLE' ELSE auth_provider END,
           deleted_at = NULL,
           last_login_at = now() WHERE id = $1`,
        [id, googleId]
      );
      return { id, restored: !!deleted_at };
    }
  }

  // New user via Google — no local password.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `INSERT INTO users (email, auth_provider, google_id, first_name, last_name, last_login_at)
       VALUES ($1, 'GOOGLE', $2, $3, $4, now())
       RETURNING id`,
      [email, googleId, firstName, lastName]
    );
    const userId = res.rows[0].id;
    await client.query(
      `INSERT INTO business_profiles (user_id, business_email) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
      [userId, email]
    );
    await client.query(
      `INSERT INTO payment_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    await client.query("COMMIT");
    return { id: userId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ── TOTP 2FA ──
async function setupTwoFactor(userId) {
  const userRes = await pool.query("SELECT email FROM users WHERE id = $1", [userId]);
  if (userRes.rows.length === 0) throw new Error("USER_NOT_FOUND");

  const secret = otplib.generateSecret();
  // Store the secret encrypted at rest; don't enable until a code is confirmed.
  await pool.query("UPDATE users SET two_factor_secret = $2 WHERE id = $1", [userId, encrypt(secret)]);

  const otpauthUrl = await otplib.generateURI({
    secret,
    label: userRes.rows[0].email,
    issuer: "InvoiceForge",
  });
  return { secret, otpauthUrl };
}

async function isValidTotp(code, storedSecret) {
  const secret = decrypt(storedSecret);
  if (!secret) return false;
  const result = await otplib.verify({ token: String(code || ""), secret });
  return !!result.valid;
}

async function enableTwoFactor(userId, code) {
  const res = await pool.query(
    "SELECT two_factor_secret FROM users WHERE id = $1",
    [userId]
  );
  const secret = res.rows[0]?.two_factor_secret;
  if (!secret) throw new Error("NO_2FA_SETUP");
  if (!(await isValidTotp(code, secret))) throw new Error("INVALID_2FA_CODE");
  await pool.query("UPDATE users SET two_factor_enabled = true WHERE id = $1", [userId]);
}

async function disableTwoFactor(userId, code) {
  const res = await pool.query(
    "SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1",
    [userId]
  );
  const row = res.rows[0];
  if (!row || !row.two_factor_enabled) return;
  if (!(await isValidTotp(code, row.two_factor_secret))) throw new Error("INVALID_2FA_CODE");
  await pool.query(
    "UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL WHERE id = $1",
    [userId]
  );
}

async function verifyTwoFactor(userId, code) {
  const res = await pool.query(
    "SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1",
    [userId]
  );
  const row = res.rows[0];
  if (!row || !row.two_factor_enabled || !row.two_factor_secret) {
    throw new Error("NO_2FA");
  }
  if (!(await isValidTotp(code, row.two_factor_secret))) throw new Error("INVALID_2FA_CODE");
  return true;
}

// Soft-deletes the account by stamping deleted_at. The account (and all its
// data via cascade) is recoverable by logging back in within GRACE_MS; after
// that it's permanently purged (see loginUser / purgeExpiredAccounts).
async function deleteAccount(userId, password) {
  const res = await pool.query(
    "SELECT password FROM users WHERE id = $1 AND deleted_at IS NULL",
    [userId]
  );
  if (res.rows.length === 0) throw new Error("USER_NOT_FOUND");

  const hash = res.rows[0].password;
  // Local accounts must confirm with their password. OAuth accounts (no local
  // password) are confirmed by the authenticated session alone.
  if (hash) {
    const ok = await comparePassword(password || "", hash);
    if (!ok) throw new Error("INVALID_CREDENTIALS");
  }

  await pool.query("UPDATE users SET deleted_at = now() WHERE id = $1", [userId]);
}

module.exports = {
  registerUser,
  loginUser,
  getUserById,
  updateUser,
  changePassword,
  createPasswordReset,
  resetPassword,
  findOrCreateGoogleUser,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  verifyTwoFactor,
  deleteAccount,
  purgeExpiredAccounts,
};
