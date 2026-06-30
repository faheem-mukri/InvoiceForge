const {
  registerUser,
  loginUser,
  getUserById,
  changePassword,
  createPasswordReset,
  resetPassword,
  findOrCreateGoogleUser,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  verifyTwoFactor,
  deleteAccount,
} = require("../services/auth.service");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateMfaToken,
  verifyMfaToken,
} = require("../utils/jwt");
const { setAuthCookies, clearAuthCookies } = require("../utils/cookies");
const QRCode = require("qrcode");

function issueSession(res, userId) {
  setAuthCookies(res, {
    accessToken: generateAccessToken({ userId }),
    refreshToken: generateRefreshToken({ userId }),
  });
}

async function register(req, res) {
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELD", message: "Email and password required" },
      });
    }

    const user = await registerUser(email, password, firstName, lastName);
    issueSession(res, user.id);
    return res.status(201).json({ success: true, data: { userId: user.id } });
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

    if (user.twoFactorEnabled) {
      // Don't issue a session yet — require the 2FA code.
      const mfaToken = generateMfaToken({ userId: user.id });
      return res.status(200).json({
        success: true,
        data: { twoFactorRequired: true, mfaToken, restored: !!user.restored },
      });
    }

    issueSession(res, user.id);
    return res.status(200).json({
      success: true,
      data: { userId: user.id, restored: !!user.restored },
    });
  } catch (err) {
    if (err.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
      });
    }
    if (err.message === "USE_SOCIAL_LOGIN") {
      return res.status(400).json({
        success: false,
        error: { code: "USE_SOCIAL_LOGIN", message: "This account uses Google sign-in. Continue with Google." },
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Something went wrong" },
    });
  }
}

async function twoFactorLogin(req, res) {
  try {
    const { mfaToken, code } = req.body;
    if (!mfaToken || !code) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELD", message: "Code is required" },
      });
    }

    let payload;
    try {
      payload = verifyMfaToken(mfaToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: { code: "MFA_EXPIRED", message: "Your session expired. Please sign in again." },
      });
    }

    await verifyTwoFactor(payload.userId, code);
    issueSession(res, payload.userId);
    return res.json({ success: true, data: { userId: payload.userId } });
  } catch (err) {
    if (err.message === "INVALID_2FA_CODE") {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_2FA_CODE", message: "Invalid authentication code" },
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Something went wrong" },
    });
  }
}

async function googleLogin(req, res) {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELD", message: "Google credential is required" },
      });
    }
    const user = await findOrCreateGoogleUser(credential);
    issueSession(res, user.id);
    return res.json({ success: true, data: { userId: user.id, restored: !!user.restored } });
  } catch (err) {
    if (err.message === "GOOGLE_NOT_CONFIGURED") {
      return res.status(400).json({
        success: false,
        error: { code: "GOOGLE_NOT_CONFIGURED", message: "Google sign-in is not configured." },
      });
    }
    if (err.message === "INVALID_GOOGLE_TOKEN") {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_GOOGLE_TOKEN", message: "Could not verify your Google sign-in." },
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Something went wrong" },
    });
  }
}

async function refresh(req, res) {
  try {
    const token = req.cookies?.refresh_token || req.body?.refreshToken;
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_REFRESH_TOKEN", message: "Not authenticated" },
      });
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_REFRESH_TOKEN", message: "Session expired" },
      });
    }

    const user = await getUserById(payload.userId);
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_REFRESH_TOKEN", message: "Session expired" },
      });
    }

    issueSession(res, user.id);
    return res.json({ success: true, data: { userId: user.id } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Something went wrong" },
    });
  }
}

async function logout(_req, res) {
  clearAuthCookies(res);
  return res.json({ success: true, data: { message: "Logged out" } });
}

async function getMe(req, res) {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
    }
    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        twoFactorEnabled: user.two_factor_enabled,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Something went wrong" },
    });
  }
}

// ── 2FA management (authenticated) ──
async function twoFactorSetup(req, res) {
  try {
    const { otpauthUrl, secret } = await setupTwoFactor(req.user.id);
    const qr = await QRCode.toDataURL(otpauthUrl);
    return res.json({ success: true, data: { otpauthUrl, secret, qr } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not start 2FA setup" },
    });
  }
}

async function twoFactorEnable(req, res) {
  try {
    await enableTwoFactor(req.user.id, req.body.code);
    return res.json({ success: true, data: { message: "Two-factor authentication enabled" } });
  } catch (err) {
    if (err.message === "INVALID_2FA_CODE" || err.message === "NO_2FA_SETUP") {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_2FA_CODE", message: "Invalid code. Try again." },
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not enable 2FA" },
    });
  }
}

async function twoFactorDisable(req, res) {
  try {
    await disableTwoFactor(req.user.id, req.body.code);
    return res.json({ success: true, data: { message: "Two-factor authentication disabled" } });
  } catch (err) {
    if (err.message === "INVALID_2FA_CODE") {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_2FA_CODE", message: "Invalid code. Try again." },
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not disable 2FA" },
    });
  }
}

async function changePasswordController(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELD", message: "Current and new password are required" },
      });
    }
    await changePassword(req.user.id, currentPassword, newPassword);
    return res.json({ success: true, data: { message: "Password updated" } });
  } catch (err) {
    if (err.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Current password is incorrect" },
      });
    }
    if (err.message === "WEAK_PASSWORD") {
      return res.status(422).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "New password must be at least 8 characters" },
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not change password" },
    });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (email) await createPasswordReset(email);
  } catch (err) {
    console.error("forgotPassword error:", err.message);
  }
  return res.json({
    success: true,
    data: { message: "If that email exists, a reset link has been sent." },
  });
}

async function resetPasswordController(req, res) {
  try {
    const { token, newPassword } = req.body;
    await resetPassword(token, newPassword);
    return res.json({ success: true, data: { message: "Password has been reset" } });
  } catch (err) {
    if (err.message === "INVALID_TOKEN") {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_TOKEN", message: "This reset link is invalid or has expired" },
      });
    }
    if (err.message === "WEAK_PASSWORD") {
      return res.status(422).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Password must be at least 8 characters" },
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not reset password" },
    });
  }
}

async function deleteAccountController(req, res) {
  try {
    await deleteAccount(req.user.id, req.body.password);
    clearAuthCookies(res);
    return res.json({ success: true, data: { message: "Account deleted" } });
  } catch (err) {
    if (err.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Password is incorrect" },
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not delete account" },
    });
  }
}

module.exports = {
  register,
  login,
  twoFactorLogin,
  googleLogin,
  refresh,
  logout,
  getMe,
  twoFactorSetup,
  twoFactorEnable,
  twoFactorDisable,
  changePasswordController,
  forgotPassword,
  resetPasswordController,
  deleteAccountController,
};
