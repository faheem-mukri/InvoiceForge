// AES-256-GCM encryption for secrets at rest (e.g. TOTP 2FA secrets).
//
// Key source: ENCRYPTION_KEY env (32-byte hex, or any string which is hashed to
// 32 bytes). Falls back to a key derived from JWT_ACCESS_SECRET so the app works
// without extra config in dev — but set a dedicated ENCRYPTION_KEY in production.
const crypto = require("crypto");

const PREFIX = "enc:v1:";

function getKey() {
  const raw = process.env.ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET || "invoiceforge-dev-key";
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return crypto.createHash("sha256").update(raw).digest(); // 32 bytes
}

function encrypt(plaintext) {
  if (plaintext == null) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

function decrypt(value) {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) {
    // Legacy plaintext (or null) — return as-is.
    return value;
  }
  try {
    const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(":");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ct = Buffer.from(ctB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

module.exports = { encrypt, decrypt };
