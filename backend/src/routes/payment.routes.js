const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const {
  createPayment,
  createCheckout,
  listPayments,
} = require("../controllers/payment.controller");

const router = express.Router();

// Payment history
router.get("/", requireAuth, listPayments);

// Hosted Stripe Checkout (redirect flow)
router.post("/stripe/checkout", requireAuth, createCheckout);

// PaymentIntent flow (Stripe Elements)
router.post("/:invoiceId/pay", requireAuth, createPayment);

module.exports = router;
