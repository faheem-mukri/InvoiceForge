# InvoiceForge

A full-stack, multi-user invoicing SaaS for freelancers, consultants, and small businesses. Create professional invoices, send them as polished PDFs, accept online payments, and track everything from a clean dashboard.

Each user runs their own business inside the app: their own clients, branding, payment settings, and — via Stripe Connect — their own money.

---

## Features

- **Authentication** — email/password, Google Sign-In, JWT in httpOnly cookies, and optional TOTP two-factor auth (secrets encrypted at rest).
- **Invoicing** — product & service invoices with line items, discounts, multiple tax types (GST/VAT/Sales/Custom), shipping/handling, and automatic totals. Live preview while you edit.
- **PDF export** — server-rendered PDFs with an embedded Unicode font, so symbols like `₹`, `€`, and `£` render correctly.
- **Email delivery** — send invoices with the PDF attached and a "Pay Now" link (SMTP via Resend or any provider; logs to console if unconfigured).
- **Payments** — Stripe Connect direct charges so each business gets paid into their own account, plus manual mark-as-paid for cash/bank/UPI. Optional platform fee.
- **Clients** — reusable client directory with billing/shipping details.
- **Guest invoices** — generate a one-off invoice without an account.
- **Dashboard** — revenue, status breakdown, and recent activity.
- **Account safety** — soft-delete with a 30-day recovery window (log back in to restore; purged afterward).
- **First-run product tour**, dark mode, responsive layout with mobile navigation.

---

## Tech stack

**Frontend** — Next.js 16 (App Router) · React 19 · Tailwind CSS · lucide-react

**Backend** — Node.js · Express 5 · PostgreSQL (`pg`) · PDFKit · Nodemailer · Stripe · otplib · helmet · express-rate-limit

---

## Project structure

```
InvoiceForge/
├── backend/            Express API
│   ├── db/             schema.sql
│   ├── scripts/        maintenance scripts (e.g. account purge)
│   └── src/
│       ├── routes/         controllers/   services/
│       ├── middleware/      pdf/           payments/
│       └── utils/
├── frontend/           Next.js app
│   └── src/
│       ├── app/        routes ((auth), (dashboard), guest, landing)
│       ├── components/ context/  lib/
└── DEPLOYMENT.md       production setup guide
```

---

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+

---

## Local setup

### 1. Database

Create a database and load the schema:

```bash
createdb invoiceforge
psql -d invoiceforge -f backend/db/schema.sql
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in the values (see below)
npm run dev            # starts on http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
npm install
# create .env.local (see below)
npm run dev            # starts on http://localhost:3000
```

---

## Environment variables

### Backend (`backend/.env`)

See [`backend/.env.example`](./backend/.env.example) for the full annotated list. Key ones:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Auth token signing secrets |
| `ENCRYPTION_KEY` | Encrypts secrets at rest (e.g. 2FA), 32-byte hex |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe API + webhook verification |
| `PLATFORM_FEE_PERCENT` | Optional commission on connected-account payments (`0` = none) |
| `FRONTEND_URL`, `API_URL` | Base URLs for CORS, redirects, and pay links |
| `SMTP_*`, `EMAIL_FROM` | Email delivery (blank = log to console) |
| `GOOGLE_CLIENT_ID` | Google Sign-In ID-token verification |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Frontend (`frontend/.env.local`)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend base URL (e.g. `http://localhost:4000`) |
| `NEXT_PUBLIC_SITE_URL` | Public site URL (used for SEO/canonical) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Sign-In client ID (Google button hides if unset) |

---

## Available scripts

**Backend**

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with nodemon (auto-reload) |
| `npm start` | Start the API |
| `node scripts/purge.js` | Permanently delete accounts past their 30-day grace period (run daily via cron) |

**Frontend**

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

---

## API overview

The Express app mounts these route groups (see `backend/src/app.js`):

| Base path | Responsibility |
| --- | --- |
| `/auth` | Register, login, refresh, logout, 2FA, Google, account deletion |
| `/users` | User profile & notification settings |
| `/business` | Business profile |
| `/payment-settings` | Payment methods + Stripe Connect onboarding |
| `/clients` | Client directory CRUD |
| `/invoices` | Invoice CRUD, send, resend, mark paid, PDF |
| `/payments` | Payment records |
| `/dashboard` | Aggregated stats |
| `/guest` | No-account invoice generation |
| `/public` | Public invoice view + checkout |
| `/webhooks` | Stripe webhooks (raw body, mounted before JSON parsing) |
| `/health` | Health check |

---

## Notes

- Money is stored as integers in the smallest currency unit (cents) to avoid floating-point errors.
- Webhooks need the raw request body for signature verification, so they are mounted before `express.json()`.
- `backend/db/schema.sql` is the single source of truth for the database — run it once on a fresh database.
