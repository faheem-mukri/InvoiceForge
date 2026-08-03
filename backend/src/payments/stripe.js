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

// Test seam. The automated suite must never reach the real Stripe API, and
// because consumers hold the proxy below (resolved on every property access),
// swapping the client here takes effect even after they have been required.
// Only ever set from tests.
let testClient = null;

function isStripeConfigured() {
  return Boolean(testClient) || Boolean(process.env.STRIPE_SECRET_KEY);
}

function getStripe() {
  if (testClient) return testClient;
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_NOT_CONFIGURED");
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

// Proxy keeps the existing `stripe.checkout.sessions.create(...)` call style
// working unchanged across the codebase.
const stripeProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      // Module-level helpers must not trigger client construction.
      if (prop === "isStripeConfigured") return isStripeConfigured;
      if (prop === "__setTestClient") return (mock) => {
        testClient = mock;
      };
      if (prop === "__resetTestClient") return () => {
        testClient = null;
      };
      const instance = getStripe();
      const value = instance[prop];
      return typeof value === "function" ? value.bind(instance) : value;
    },
  }
);

module.exports = stripeProxy;
module.exports.isStripeConfigured = isStripeConfigured;

// Test-only helpers, deliberately prefixed. Not used by application code.
module.exports.__setTestClient = (mock) => {
  testClient = mock;
};
module.exports.__resetTestClient = () => {
  testClient = null;
};
