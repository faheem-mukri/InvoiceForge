# InvoiceForge — Frontend

Next.js (App Router) frontend for InvoiceForge.

See the [root README](../README.md) for the full project overview, and
[`DEPLOYMENT.md`](../DEPLOYMENT.md) for production setup.

## Quick start

```bash
npm install
# create .env.local with NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID
npm run dev
```

The app runs on http://localhost:3000 and talks to the backend API at
`NEXT_PUBLIC_API_URL` (default http://localhost:4000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm start` — serve the production build
- `npm run lint` — run ESLint
