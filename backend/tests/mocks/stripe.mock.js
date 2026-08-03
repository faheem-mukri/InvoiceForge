/**
 * Stripe mock.
 *
 * Replaces src/payments/stripe.js so tests never hit the Stripe API. Records
 * calls so tests can assert *how* Stripe was used — e.g. that a public checkout
 * is created on the connected account, which is what routes money to the right
 * business.
 */
import { vi } from 'vitest';

export const __calls = {
  checkoutSessions: [],
  paymentIntents: [],
  accounts: [],
  accountLinks: [],
  webhookVerifications: [],
};

// Lets a test force an API failure to exercise error handling.
let failNextWith = null;
export function failNext(error) {
  failNextWith = error;
}
function maybeFail() {
  if (failNextWith) {
    const err = failNextWith;
    failNextWith = null;
    throw err;
  }
}

let counter = 0;
const nextId = (prefix) => `${prefix}_test_${++counter}`;

const stripe = {
  checkout: {
    sessions: {
      create: vi.fn(async (params, options) => {
        maybeFail();
        __calls.checkoutSessions.push({ params, options });
        const id = nextId('cs');
        return {
          id,
          url: `https://checkout.stripe.test/pay/${id}`,
          payment_intent: nextId('pi'),
          amount_total: params?.line_items?.[0]?.price_data?.unit_amount ?? null,
          currency: params?.line_items?.[0]?.price_data?.currency ?? null,
          metadata: params?.metadata ?? {},
        };
      }),
      retrieve: vi.fn(async (id) => {
        maybeFail();
        return { id, payment_status: 'paid', payment_intent: nextId('pi') };
      }),
    },
  },

  paymentIntents: {
    create: vi.fn(async (params, options) => {
      maybeFail();
      __calls.paymentIntents.push({ params, options });
      const id = nextId('pi');
      return {
        id,
        client_secret: `${id}_secret_test`,
        status: 'requires_payment_method',
        amount: params?.amount ?? 0,
        currency: params?.currency ?? 'usd',
      };
    }),
    retrieve: vi.fn(async (id) => {
      maybeFail();
      return { id, status: 'succeeded' };
    }),
  },

  accounts: {
    create: vi.fn(async (params) => {
      maybeFail();
      __calls.accounts.push({ params });
      return { id: nextId('acct'), charges_enabled: false, details_submitted: false };
    }),
    retrieve: vi.fn(async (id) => {
      maybeFail();
      return { id, charges_enabled: true, details_submitted: true, payouts_enabled: true };
    }),
  },

  accountLinks: {
    create: vi.fn(async (params) => {
      maybeFail();
      __calls.accountLinks.push({ params });
      return {
        url: 'https://connect.stripe.test/onboarding',
        expires_at: Date.now() + 300000,
      };
    }),
  },

  webhooks: {
    // Mirrors the real signature check: reject a missing or bogus signature,
    // otherwise parse the body. Lets tests prove unsigned payloads are refused.
    constructEvent: vi.fn((rawBody, signature, secret) => {
      __calls.webhookVerifications.push({ signature, secret });
      if (!signature || signature === 'invalid') {
        const err = new Error(
          'No signatures found matching the expected signature for payload'
        );
        err.type = 'StripeSignatureVerificationError';
        throw err;
      }
      return typeof rawBody === 'string'
        ? JSON.parse(rawBody)
        : JSON.parse(rawBody.toString('utf8'));
    }),
  },

  isStripeConfigured: () => true,
};

export function resetStripeMock() {
  Object.keys(__calls).forEach((k) => {
    __calls[k].length = 0;
  });
  failNextWith = null;
  counter = 0;
  stripe.checkout.sessions.create.mockClear();
  stripe.checkout.sessions.retrieve.mockClear();
  stripe.paymentIntents.create.mockClear();
  stripe.paymentIntents.retrieve.mockClear();
  stripe.accounts.create.mockClear();
  stripe.accounts.retrieve.mockClear();
  stripe.accountLinks.create.mockClear();
  stripe.webhooks.constructEvent.mockClear();
}

export const isStripeConfigured = () => true;

// The real module exports the client itself (module.exports = stripe), so the
// default export must be the client for `require(...)` interop to match.
export default stripe;
