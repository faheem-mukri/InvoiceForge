const rateLimit = require("express-rate-limit");

// Throttles sensitive auth endpoints (login, register, password reset, 2FA)
// to slow down brute-force and credential-stuffing attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again later." },
  },
});

module.exports = { authLimiter };
