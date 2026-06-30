// httpOnly auth cookie helpers. Access + refresh tokens are stored in cookies
// (not localStorage) so JS can't read them — mitigating XSS token theft.
//
// Cookie behaviour is environment-configurable so the same code works for:
//   • same-domain deploys (app.x.com + api.x.com) → SameSite=Lax (default)
//   • cross-site deploys (app.vercel.app + api.onrender.com) → set
//     COOKIE_SAMESITE=none (which forces Secure=true).
//
// Env:
//   COOKIE_SAMESITE  'lax' | 'strict' | 'none'   (default: 'lax')
//   COOKIE_SECURE    'true' | 'false'            (default: true in production)
//   COOKIE_DOMAIN    e.g. '.yourdomain.com'      (optional)
const isProd = process.env.NODE_ENV === "production";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const sameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();

// SameSite=None is only valid on Secure cookies, so force it.
const secure =
  sameSite === "none"
    ? true
    : process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : isProd;

const baseOptions = {
  httpOnly: true,
  secure,
  sameSite,
  path: "/",
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
};

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseOptions,
    maxAge: 15 * 60 * 1000, // 15m
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
  });
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, baseOptions);
  res.clearCookie(REFRESH_COOKIE, baseOptions);
}

module.exports = { setAuthCookies, clearAuthCookies, ACCESS_COOKIE, REFRESH_COOKIE };
