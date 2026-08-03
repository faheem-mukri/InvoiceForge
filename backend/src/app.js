const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const businessRoutes = require("./routes/business.routes");
const paymentSettingsRoutes = require("./routes/paymentSettings.routes");
const clientRoutes = require("./routes/client.routes");
const productRoutes = require("./routes/product.routes");
const invoiceRoutes = require("./routes/invoice.routes");
const paymentRoutes = require("./routes/payment.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const webhookRoutes = require("./routes/webhook.routes");
const guestRoutes = require("./routes/guest.routes");
const publicRoutes = require("./routes/public.routes");

const app = express();

// Behind a hosting proxy (Render/Railway/Fly/etc.) so req.ip and Secure cookies
// work correctly. TRUST_PROXY allows enabling this outside production — useful
// for staging environments and for exercising per-IP rate limiting in tests.
if (process.env.NODE_ENV === "production" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

// Security headers. CSP is disabled because this API serves JSON + a couple of
// small inline-styled redirect pages; the Next.js frontend manages its own CSP.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// Allowed browser origins for CORS. FRONTEND_URL may be a single origin or a
// comma-separated list (e.g. production + a custom domain). Vercel preview
// deployments (*.vercel.app) are allowed too so branch previews work.
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

function isAllowedOrigin(origin) {
  // Non-browser clients (curl, server-to-server) send no Origin header.
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, "");
  if (allowedOrigins.includes(normalized)) return true;
  // Allow Vercel preview URLs for this project.
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalized)) return true;
  return false;
}

// Allow the frontend origin to call this API from the browser with cookies.
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

app.use(cookieParser());

// Stripe webhooks must receive the raw request body for signature verification,
// so they are mounted BEFORE express.json() consumes/parses the body.
app.use("/webhooks", webhookRoutes);

// Limit raised from the 100kb default so base64 business logos fit (the logo
// itself is capped at 512 KB in business.service.js).
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_, res) => res.json({ status: "OK" }));

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/business", businessRoutes);
app.use("/payment-settings", paymentSettingsRoutes);
app.use("/clients", clientRoutes);
app.use("/products", productRoutes);
app.use("/invoices", invoiceRoutes);
app.use("/payments", paymentRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/guest", guestRoutes);
app.use("/public", publicRoutes);

module.exports = app;
