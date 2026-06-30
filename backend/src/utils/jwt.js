const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";
const MFA_TOKEN_TTL = "5m";

function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

function generateRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

// Short-lived token issued after password check when 2FA is required.
function generateMfaToken(payload) {
  return jwt.sign({ ...payload, mfa: true }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: MFA_TOKEN_TTL,
  });
}

function verifyMfaToken(token) {
  const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  if (!payload.mfa) throw new Error("NOT_MFA_TOKEN");
  return payload;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateMfaToken,
  verifyMfaToken,
};
