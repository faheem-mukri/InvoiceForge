const Stripe = require("stripe");

// The Stripe SDK throws from its constructor when no API key is present. Doing
// that at require time meant the ENTIRE API refused to boot without
// STRIPE_SECRET_KEY — so a missing/rotated key took down auth, invoices and
// PDFs too, not just payments.
//
// Instead the client is created lazily on first use. The app always starts, and
// only payment endpoints fail (with STRIPE_NOT_CONFIGURED) when the key is
// absent. Callers already surface that code as a friendly error.
let client = null;

function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function getStripe() {
  if (!isStripeConfigured()) throw new Error("STRIPE_NOT_CONFIGURED");
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

// Proxy keeps the existing `stripe.checkout.sessions.create(...)` call style
// working unchanged across the codebase.
const stripeProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "isStripeConfigured") return isStripeConfigured;
      const instance = getStripe();
      const value = instance[prop];
      return typeof value === "function" ? value.bind(instance) : value;
    },
  }
);

module.exports = stripeProxy;
module.exports.isStripeConfigured = isStripeConfigured;
