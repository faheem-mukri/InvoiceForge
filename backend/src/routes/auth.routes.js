const express = require("express");
const {
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
} = require("../controllers/auth.controller");
const requireAuth = require("../middleware/requireAuth");
const { authLimiter } = require("../middleware/authRateLimit");

const router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/2fa/login", authLimiter, twoFactorLogin);
router.post("/google", authLimiter, googleLogin);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPasswordController);
router.post("/change-password", requireAuth, changePasswordController);
router.post("/2fa/setup", requireAuth, twoFactorSetup);
router.post("/2fa/enable", requireAuth, twoFactorEnable);
router.post("/2fa/disable", requireAuth, twoFactorDisable);
router.delete("/account", requireAuth, deleteAccountController);
router.get("/me", requireAuth, getMe);

module.exports = router;
