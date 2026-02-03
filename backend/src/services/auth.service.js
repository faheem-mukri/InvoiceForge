const pool = require("../db");
const { hashPassword } = require("../utils/password");
const { comparePassword } = require("../utils/password");

async function registerUser(email, password) {
  const existing = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );

  if (existing.rows.length > 0) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const hashed = await hashPassword(password);

  const result = await pool.query(
    "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id",
    [email, hashed]
  );

  return { id: result.rows[0].id };
}

async function loginUser(email, password) {
  const result = await pool.query(
    "SELECT id, password FROM users WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const user = result.rows[0];

  const isValid = await comparePassword(password, user.password);

  if (!isValid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  return { id: user.id };
}

module.exports = { registerUser, loginUser };
