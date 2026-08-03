# Testing

Automated tests for the InvoiceForge backend, built with **Vitest** and **Supertest**.

The goal is confidence that every important business workflow still works before a
deploy — not a large test count. Tests target business logic, money math, access
control and data integrity, and deliberately skip trivial glue code.

---

## Quick start

```bash
cd backend
npm install

# Everything (needs PostgreSQL running)
npm test

# Fast, no database required
npx vitest run --project unit

# With a coverage report
npm run test:coverage

# Watch mode while developing
npm run test:watch
```

---

## Test database

Integration tests run against a **real PostgreSQL database**, because most of the
risk in this codebase lives in SQL: transactions, cascades, constraints and
row-level ownership. Mocking the database would test the mock.

**The suite `TRUNCATE`s every table before each test**, so it must never point at
a database you care about. Two safeguards enforce this:

1. **Name guard** — `tests/helpers/testDb.js` refuses to run unless the database
   name contains `test`. Override only if you are certain, with
   `ALLOW_UNSAFE_TEST_DB=true`.
2. **Automatic derivation** — if `TEST_DATABASE_URL` is unset, the test database
   is derived from `DATABASE_URL` by appending `_test` to the database name. Your
   development database is never touched.

So with `DATABASE_URL=postgresql://postgres:pw@localhost:5432/invoiceforge`, tests
use `invoiceforge_test`. It is created automatically if missing, and the schema is
applied from `db/schema.sql`.

To point somewhere explicit:

```bash
TEST_DATABASE_URL=postgresql://user:pw@host:5432/my_test_db npm test
```

---

## Layout

```
tests/
├── setup/
│   ├── envSetup.js      env vars, fake secrets, service mocks, fetch trap
│   └── dbSetup.js       schema creation + truncate between tests
├── helpers/
│   ├── testDb.js        pool, migrate, truncate, safety guard
│   └── api.js           Supertest agents and record-creation helpers
├── fixtures/
│   └── index.js         fakeUser, fakeInvoice, fakeClient, validPngBuffer, …
├── mocks/
│   ├── stripe.mock.js   records calls, can force failures
│   └── email.mock.js    captures an outbox, can force failures
├── utils/               unit tests (no database)
├── auth/                registration, login, sessions, refresh, logout
├── middleware/          JWT handling, error handlers, rate limiting
├── invoices/            CRUD, ownership, lifecycle, PDFs
├── clients/             CRUD, search, ownership
├── products/            catalog CRUD, soft delete
├── payments/            manual + Stripe payments, webhooks
├── settings/            business profile, logo, payment settings
└── database/            constraints, cascades, transactions, concurrency
```

### Two projects

| Project | Location | Database | Parallel |
| --- | --- | --- | --- |
| `unit` | `tests/utils/**` | no | yes |
| `integration` | everything else | yes | no (single worker) |

Integration tests share one database and truncate between tests, so they run on a
**single worker**. Parallel files would wipe each other's rows mid-assertion. This
trades speed for determinism, which is the right trade for a suite that gates
deploys.

---

## External services are always mocked

No test may make a real network call. `envSetup.js` replaces `global.fetch` with a
version that throws, so an accidental outbound request fails loudly instead of
making the suite slow and flaky.

Mocked at the module boundary, leaving the rest of the app running for real:

| Service | Mock | Notes |
| --- | --- | --- |
| Stripe | `mocks/stripe.mock.js` | Records calls in `__calls`; `webhooks.constructEvent` rejects a missing or `invalid` signature so signature enforcement is genuinely tested. |
| Email | `mocks/email.mock.js` | Captures messages in `__outbox`; `failNext()` simulates a provider outage. |
| PDF | not mocked | PDFKit runs for real and in-process. It is fast, has no network dependency, and previously shipped two production bugs — so it is worth exercising. |

Forcing a failure:

```js
import { failNext } from '../mocks/email.mock.js';

failNext(new Error('provider down'));
// assert the invoice still saved
```

---

## Conventions

**Arrange → Act → Assert**, with a blank line between phases.

```js
it('marks a sent invoice as PAID', async () => {
  // Arrange
  const { agent } = await registerUser();
  const { invoiceId } = await createSentInvoice(agent);

  // Act
  const res = await agent.post(`/invoices/${invoiceId}/mark-paid`).send({ method: 'CASH' });

  // Assert
  expect(res.status).toBe(200);
});
```

- **Names describe behaviour, not implementation.** `'rejects a duplicate email with 409'`, not `'test register 2'`.
- **Every test is independent.** The database is truncated before each one, and fixtures generate unique values, so tests pass in any order and individually.
- **Use fixtures and helpers** rather than repeating setup. `registerUser()` returns a cookie-persisting agent, so ownership tests genuinely involve two different users.
- **Assert on observable behaviour** — status codes, response bodies, database rows — not on internal call sequences, unless the call itself is the contract (as with Stripe).
- **Comment the "why", not the "what".** Explain the risk a test protects against.

### Ownership is tested everywhere

Multi-tenant leakage is the worst failure this app could have, so every resource
has a test proving one user cannot read, update or delete another's data — and
that a rejected write left the original row unchanged.

---

## Coverage

```bash
npm run test:coverage      # HTML report in coverage/index.html
```

Thresholds are **enforced** — the command fails if coverage drops below:

| Scope | Lines |
| --- | --- |
| `src/utils/pricing.js` | 95% |
| `src/utils/validate.js` | 95% |
| `src/services/**` | 75% |
| Overall | 70% |

Coverage measures `src/**` only. The server bootstrap and generated files are
excluded because testing them proves nothing.

Do not chase the number. A test that asserts nothing meaningful but lifts coverage
is worse than no test: it costs maintenance and creates false confidence.

---

## CI

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

```
frontend: install → lint → build
backend:  install → schema → app loads → tests + coverage → smoke test
                              ↓
                        ci-passed (required check)
```

The backend job runs a **PostgreSQL 16 service container**, so integration tests
run against a real database in CI exactly as they do locally.

**To make deployment actually stop on failure**, point branch protection at the
`ci-passed` job, and enable "wait for CI" in your host:

- **Vercel** — Settings → Git → *Wait for CI before deploying*.
- **Render** — Settings → Build & Deploy → *Wait for CI checks to pass*.

Without those settings, hosts deploy on push and ignore CI results.

---

## Adding a test

1. Choose the folder matching the domain (`invoices/`, `clients/`, …).
2. Name the file after the behaviour: `refunds.test.js`.
3. Use `registerUser()` for an authenticated agent, and a fixture for the payload.
4. Follow Arrange → Act → Assert, and assert the database state when a route's job
   is to persist something.
5. Add a case for the unhappy path — and for ownership, if the resource belongs to
   a user.

## Troubleshooting

**`Could not prepare the test database`** — PostgreSQL isn't running or
`TEST_DATABASE_URL` is unreachable. Unit tests still work:
`npx vitest run --project unit`.

**`Refusing to run tests against database "..."`** — the safety guard. Your target
database name doesn't contain `test`. Fix the URL rather than overriding.

**`Unexpected outbound HTTP request`** — code under test tried to reach the
internet. Add a mock in `tests/mocks/` instead of allowing the call.

**Tests pass alone but fail together** — shared state. Check for a module-level
cache (see the `exchangeRates` tests, which reset modules) or a fixture using a
hard-coded unique value.
