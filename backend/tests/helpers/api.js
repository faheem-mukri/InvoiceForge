/**
 * Supertest helpers.
 *
 * `registerUser` returns an *agent* that persists cookies, so tests read like a
 * real user session instead of manual token plumbing. This is what keeps
 * ownership tests honest: two agents are genuinely two different users.
 */
import request from 'supertest';
import appModule from '../../src/app.js';
import { fakeUser, fakeInvoice, fakeClient } from '../fixtures/index.js';

// src/app.js is CommonJS, so the Express app arrives as the default export.
export const app = appModule.default ?? appModule;

/**
 * Unauthenticated, stateless client. Each call is independent and cookies are
 * NOT retained — use `agent()` when a test needs to stay logged in.
 */
export const client = () => request(app);

/**
 * A fresh client with a cookie jar, for tests that log in and then make
 * authenticated requests (e.g. verifying account recovery).
 */
export const agent = () => request.agent(app);

/** Logs an existing user in on a new agent and returns it. */
export async function loginAs(credentials) {
  const session = request.agent(app);
  const res = await session
    .post('/auth/login')
    .send({ email: credentials.email, password: credentials.password });
  if (res.status !== 200) {
    throw new Error(`Login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return { session, body: res.body };
}

/**
 * Registers a user and returns a cookie-persisting agent, the credentials, and
 * the resolved user record.
 */
export async function registerUser(overrides = {}) {
  const credentials = fakeUser(overrides);
  const agent = request.agent(app);

  const res = await agent.post('/auth/register').send(credentials);
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `Fixture registration failed (${res.status}): ${JSON.stringify(res.body)}`
    );
  }

  // Log in explicitly so the agent is authenticated regardless of whether
  // registration issues a session.
  const login = await agent
    .post('/auth/login')
    .send({ email: credentials.email, password: credentials.password });
  if (login.status !== 200) {
    throw new Error(`Fixture login failed (${login.status}): ${JSON.stringify(login.body)}`);
  }

  const me = await agent.get('/auth/me');
  if (me.status !== 200) {
    throw new Error(`Fixture /auth/me failed (${me.status}): ${JSON.stringify(me.body)}`);
  }

  return { agent, credentials, user: me.body.data, userId: me.body.data.id };
}

/** Creates an invoice and returns { invoiceId, invoiceNumber }. */
export async function createInvoice(agent, payload) {
  const res = await agent.post('/invoices').send(fakeInvoice(payload));
  if (res.status !== 201) {
    throw new Error(
      `Fixture invoice creation failed (${res.status}): ${JSON.stringify(res.body)}`
    );
  }
  return res.body.data;
}

/** Creates an invoice already transitioned to SENT. */
export async function createSentInvoice(agent, payload) {
  const invoice = await createInvoice(agent, payload);
  const res = await agent.post(`/invoices/${invoice.invoiceId}/send`);
  if (res.status !== 200) {
    throw new Error(`Fixture invoice send failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return invoice;
}

export async function createClientRecord(agent, overrides) {
  const res = await agent.post('/clients').send(fakeClient(overrides));
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(
      `Fixture client creation failed (${res.status}): ${JSON.stringify(res.body)}`
    );
  }
  return res.body.data;
}
