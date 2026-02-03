const { registerUser } = require("../services/auth.service");
const { loginUser } = require("../services/auth.service");
const { generateAccessToken, generateRefreshToken } = require("../utils/jwt");

async function register(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELD", message: "Email and password required" },
      });
    }

    const user = await registerUser(email, password);

    const accessToken = generateAccessToken({ userId: user.id });
    const refreshToken = generateRefreshToken({ userId: user.id });

    return res.status(201).json({
      success: true,
      data: { userId: user.id, accessToken, refreshToken },
    });
  } catch (err) {
    if (err.message === "EMAIL_ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        error: { code: "EMAIL_ALREADY_EXISTS", message: "Email already registered" },
      });
    }

    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Something went wrong" },
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELD", message: "Email and password required" },
      });
    }

    const user = await loginUser(email, password);

    const accessToken = generateAccessToken({ userId: user.id });
    const refreshToken = generateRefreshToken({ userId: user.id });

    return res.status(200).json({
      success: true,
      data: { userId: user.id, accessToken, refreshToken },
    });
  } catch (err) {
    if (err.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
      });
    }

    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Something went wrong" },
    });
  }
}

module.exports = { register, login };
