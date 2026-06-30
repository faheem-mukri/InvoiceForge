/**
 * Minimal in-memory fixed-window rate limiter, keyed by client IP.
 *
 * This is intentionally dependency-free and process-local. For a multi-instance
 * deployment this should be backed by a shared store (e.g. Redis), but it is
 * sufficient to throttle the public guest-invoice endpoint here.
 */
function rateLimit({ windowMs = 60_000, max = 10 } = {}) {
  const hits = new Map(); // ip -> { count, resetAt }

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const ip =
      req.ip ||
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown";

    let entry = hits.get(ip);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again shortly.",
        },
      });
    }

    next();
  };
}

module.exports = rateLimit;
