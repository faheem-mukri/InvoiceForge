# InvoiceForge

A full-stack, multi-user invoicing SaaS for freelancers, consultants, and small businesses. Create professional invoices, send them as polished PDFs, accept online payments, and track everything from a clean dashboard.

Each user runs their own business inside the app: their own clients, branding, payment settings, and — via Stripe Connect — their own money.

> **Deploying to production?** See [`DEPLOYMENT.md`](./DEPLOYMENT.md).
> **Working on the tests?** See [`backend/TESTING.md`](./backend/TESTING.md).

---

## Features

- **Authentication** — email/password, Google Sign-In, JWT in httpOnly cookies, and optional TOTP two-factor auth (secrets encrypted at rest with AES-256-GCM).
- **Invoicing** — product & service invoices with line items, discounts, multiple tax types (GST/VAT/Sales/Custom), shipping/handling, and automatic totals. Live preview while you edit.
- **Products & services catalog** — save the items you bill for and add them to any invoice in one click, instead of retyping them.
- **Business branding** — upload a logo that appears on the invoice preview and in generated PDFs.
- **PDF export** — server-rendered PDFs with an embedded Unicode font, so symbols like `₹`, `€`, and `£` render correctly. Downloads are named after the invoice number.
- **Email delivery** — invoices sent with the PDF attached and a "Pay Now" link. Mail goes out from the app's verified sender showing the business name, with `Reply-To` pointing at the business so client replies reach them, not the platform.
- **Payments** — Stripe Connect direct charges so each business is paid into their own account, plus manual mark-as-paid for cash/bank transfer/UPI. Optional platform fee.
- **Multi-currency dashboard** — revenue from invoices in any currency is normalised into the business's base currency using cached exchange rates, with a static fallback if the rate service is unreachable.
- **Clients** — reusable client directory with billing/shipping details.
- **Guest invoices** — generate a one-off PDF without an account; nothing is stored.
- **Account safety** — soft delete with a 30-day recovery window (log back in to restore; purged afterwards).
- **First-run product tour**, dark mode, and a responsive layout with mobile navigation.

---

## Tech stack

**Frontend** — Next.js 16 (App Router) · React 19 · Tailwind CSS · lucide-react

**Backend** — Node.js · Express 5 · PostgreSQL (`pg`) · PDFKit · Stripe · otplib · helmet · express-rate-limit · Nodemailer

**Testing** — Vitest · Supertest · v8 coverage · GitHub Actions

---

## Project structure

```
InvoiceForge/
├── backend/            Express API
│   ├── db/             schema.sql
│   ├── scripts/        maintenance (account purge, CI smoke test)
│   ├── tests/          Vitest suites, fixtures, mocks  → TESTING.md
│   └── src/
│       ├── routes/         controllers/   services/
│       ├── middleware/      pdf/           payments/
│       └── utils/
├── frontend/           Next.js app
│   └── src/
│       ├── app/        routes ((auth), (dashboard), guest, landing)
│       ├── components/ context/  lib/
├── .github/workflows/  CI (lint, build, tests, coverage)
└── DEPLOYMENT.md       production setup guide
```

---

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL 14+

---

## Local setup

### 1. Database

```bash
createdb invoiceforge
psql -d invoiceforge -f backend/db/schema.sql
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in the values (see below)
npm run dev            # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
npm install
# create .env.local (see below)
npm run dev            # http://localhost:3000
```

The frontend proxies the API at `/api`, so no extra configuration is needed
locally as long as the backend is on port 4000.

---

## Environment variables

### Backend (`backend/.env`)

See [`backend/.env.example`](./backend/.env.example) for the full annotated list. Key ones:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (SSL is enabled automatically for non-local hosts) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Auth token signing secrets |
| `ENCRYPTION_KEY` | Encrypts secrets at rest (e.g. 2FA), 32-byte hex |
| `BREVO_API_KEY` *or* `RESEND_API_KEY` | Email over HTTP — **preferred in production** |
| `SMTP_*` | Email over SMTP — local development only (see note below) |
| `EMAIL_FROM` | Verified sender address, e.g. `InvoiceForge <invoices@yourdomain.com>` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe API + webhook signature verification |
| `PLATFORM_FEE_PERCENT` | Optional commission on connected-account payments (`0` = none) |
| `FRONTEND_URL`, `API_URL` | Base URLs for CORS, redirects, and pay links |
| `COOKIE_SAMESITE`, `COOKIE_SECURE`, `COOKIE_DOMAIN` | Cookie behaviour per environment |
| `GOOGLE_CLIENT_ID` | Google Sign-In ID-token verification |
| `TRUST_PROXY` | Set `true` when behind a proxy outside production (staging) |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Frontend (`frontend/.env.local`)

| Variable | Purpose |
| --- | --- |
| `BACKEND_URL` | Where the `/api` proxy forwards to (default `http://localhost:4000`). Server-side only. |
| `NEXT_PUBLIC_SITE_URL` | Public site URL, used for SEO and link previews |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Sign-In client ID (the button hides if unset) |
| `NEXT_PUBLIC_API_URL` | Optional override to call the backend directly instead of through the proxy. Leave unset — see the cookie note below. |

---

## Available scripts

**Backend**

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with nodemon (auto-reload) |
| `npm start` | Start the API |
| `npm test` | Run the full test suite |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Run with coverage, enforcing thresholds |
| `npm run test:unit` | Fast unit tests only — no database needed |
| `node scripts/purge.js` | Permanently delete accounts past their 30-day grace period (run daily via cron) |

**Frontend**

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

---

## Testing

485 tests covering authentication, two-factor auth, password reset, account deletion, invoices, clients, products, payments, webhooks, business settings, middleware and database integrity.

```bash
cd backend
npm test                # everything (needs PostgreSQL)
npm run test:unit       # fast, no database
npm run test:coverage   # coverage report in coverage/index.html
```

Integration tests drive the real Express app against a **real PostgreSQL
database**, because most of the risk in this codebase lives in SQL: transactions,
cascade deletes, constraints and per-tenant ownership filters. The test database
is derived from `DATABASE_URL` by appending `_test`, created automatically, and a
guard refuses to run against any database whose name doesn't contain `test` —
the suite truncates every table.

Stripe and email are never contacted: Stripe is swapped for a fake client, email
is captured at the HTTP boundary, and an unexpected outbound request fails the
test rather than silently reaching the internet.

Full conventions, layout and troubleshooting: [`backend/TESTING.md`](./backend/TESTING.md).

---

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

```
frontend: install → lint → build
backend:  install → schema → app loads → tests + coverage → smoke test
                              ↓
                        ci-passed (required check)
```

The backend job runs a PostgreSQL service container, so integration tests run
against a real database in CI exactly as they do locally.

To make a failing build actually stop a deploy, point branch protection at the
`ci-passed` job and enable "wait for CI" in your host — otherwise Vercel and
Render deploy on push and ignore the result.

---

## API overview

| Base path | Responsibility |
| --- | --- |
| `/auth` | Register, login, refresh, logout, 2FA, Google, password reset, account deletion |
| `/users` | User profile & notification settings |
| `/business` | Business profile and logo |
| `/payment-settings` | Payment methods + Stripe Connect onboarding |
| `/clients` | Client directory CRUD |
| `/products` | Reusable product/service catalog |
| `/invoices` | Invoice CRUD, send, resend, mark paid, duplicate, PDF |
| `/payments` | Payment records and Stripe checkout |
| `/dashboard` | Aggregated stats |
| `/guest` | No-account invoice generation |
| `/public` | Public invoice view + customer checkout (unauthenticated) |
| `/webhooks` | Stripe webhooks (raw body, mounted before JSON parsing) |
| `/health` | Health check |

---

## Implementation notes

Details that are easy to trip over when changing this code:

- **Money is stored as integers** in the smallest currency unit (cents). `utils/pricing.js` is the single authority for totals; figures sent by the client are recomputed server-side and never trusted.
- **Webhooks need the raw request body** for signature verification, so `/webhooks` is mounted *before* `express.json()`. Payment settlement updates the PENDING payment row created at checkout, and is idempotent because Stripe redelivers events.
- **The API is proxied through the frontend** at `/api` so the session cookie is first-party. Calling the backend origin directly makes it a third-party cookie, which iOS Safari and Chrome block — login then silently fails on iPhones.
- **Cloud hosts block outbound SMTP ports**, so production email goes over a provider's HTTPS API (`BREVO_API_KEY` or `RESEND_API_KEY`). SMTP is kept for local development.
- **Logos are stored in the database**, not on disk, because hosts like Render have an ephemeral filesystem where uploads vanish on redeploy. Uploads are validated at rest: a corrupt PNG would otherwise throw from inside PDFKit's zlib callback and take down the process.
- **The public invoice endpoint is unauthenticated** — the invoice UUID is the only credential. Its query selects an explicit column list so internal fields (owner id, delivery status) never reach the customer.
- **`backend/db/schema.sql` is the single source of truth** for the database. Run it once on a fresh database; it is idempotent, so re-running is safe.
