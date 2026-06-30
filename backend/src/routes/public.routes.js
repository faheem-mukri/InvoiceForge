const express = require("express");
const {
  viewInvoice,
  checkout,
  payRedirect,
  paySuccess,
  payCancel,
} = require("../controllers/public.controller");

const router = express.Router();

// Stripe redirect result pages (generic, no invoice data).
router.get("/pay/success", paySuccess);
router.get("/pay/cancel", payCancel);

// Unauthenticated — used by the customer who received the invoice email.
router.get("/invoices/:id", viewInvoice);
router.post("/invoices/:id/checkout", checkout);
// Direct "Pay Now" link from the email → redirects straight to Stripe Checkout.
router.get("/invoices/:id/pay", payRedirect);

module.exports = router;
