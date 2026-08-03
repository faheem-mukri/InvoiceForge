const rateLimit = require("express-rate-limit");

// Throttles sensitive auth endpoints (login, register, password reset, 2FA)
// to slow down brute-force and credential-stuffing attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // Read per request rather than captured at module load, so the ceiling can be
  // changed without rebuilding the middleware (and so tests can lower it).
  limit: () => Number(process.env.AUTH_RATE_LIMIT_MAX) || 20, // per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again later." },
  },
  // The automated test suite makes far more than 20 auth calls per run, so it
  // opts out via DISABLE_RATE_LIMIT. The dedicated rate-limit test re-enables
  // the limiter (with a small max) to verify the real behaviour.
  skip: () => process.env.DISABLE_RATE_LIMIT === "true",
});

module.exports = { authLimiter };
