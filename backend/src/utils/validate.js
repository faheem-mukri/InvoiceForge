/**
 * Input validation for credentials.
 *
 * Kept in one place so the rules are testable in isolation and identical across
 * registration, password change and password reset.
 */

// Deliberately pragmatic rather than RFC-complete: one @, no whitespace, a dot
// in the domain, and a non-empty local part. Catches real typos without
// rejecting valid addresses.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200; // bcrypt truncates past 72 bytes; reject absurd input early

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return EMAIL_PATTERN.test(trimmed);
}

/**
 * Emails are compared case-insensitively, so they must be stored in a single
 * canonical form. Without this, "User@x.com" and "user@x.com" become two
 * accounts and the user can be locked out by their own capitalisation.
 */
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Returns null when acceptable, otherwise a human-readable reason.
 * Length is the dominant factor in real-world password strength, so it is the
 * primary rule; we also reject single-character-class passwords.
 */
function validatePassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Password is required.';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (/^\d+$/.test(password)) {
    return 'Password cannot be only numbers.';
  }
  if (/^[a-z]+$/i.test(password)) {
    return 'Password must include a number or symbol.';
  }
  return null;
}

module.exports = {
  isValidEmail,
  normalizeEmail,
  validatePassword,
  MIN_PASSWORD_LENGTH,
};
