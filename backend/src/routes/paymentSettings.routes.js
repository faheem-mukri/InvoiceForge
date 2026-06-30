const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const {
  get,
  update,
  stripeConnect,
  stripeStatus,
} = require("../controllers/paymentSettings.controller");

const router = express.Router();

router.get("/", requireAuth, get);
router.put("/", requireAuth, update);
router.post("/stripe/connect", requireAuth, stripeConnect);
router.get("/stripe/status", requireAuth, stripeStatus);

module.exports = router;
