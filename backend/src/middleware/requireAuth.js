const jwt = require("jsonwebtoken");
const { ACCESS_COOKIE } = require("../utils/cookies");

function requireAuth(req, res, next) {
  // Prefer the httpOnly cookie; fall back to a Bearer header (API clients).
  let token = req.cookies ? req.cookies[ACCESS_COOKIE] : null;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing or invalid token" },
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: payload.userId };
    next();
  } catch (err) {
    const isExpired = err.name === "TokenExpiredError";
    return res.status(401).json({
      success: false,
      error: {
        code: isExpired ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
        message: isExpired ? "Token has expired" : "Token is invalid",
      },
    });
  }
}

module.exports = requireAuth;
