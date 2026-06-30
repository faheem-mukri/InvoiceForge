const express = require("express");
const rateLimit = require("../middleware/rateLimit");
const { createGuestInvoice } = require("../controllers/guest.controller");

const router = express.Router();

// Public, anonymous endpoint — throttle to limit abuse.
const guestLimiter = rateLimit({ windowMs: 60_000, max: 5 });

router.post("/invoices", guestLimiter, createGuestInvoice);

module.exports = router;
