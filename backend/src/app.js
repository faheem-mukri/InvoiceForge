const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const businessRoutes = require("./routes/business.routes");
const paymentSettingsRoutes = require("./routes/paymentSettings.routes");
const clientRoutes = require("./routes/client.routes");
const invoiceRoutes = require("./routes/invoice.routes");
const paymentRoutes = require("./routes/payment.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const webhookRoutes = require("./routes/webhook.routes");
const guestRoutes = require("./routes/guest.routes");
const publicRoutes = require("./routes/public.routes");

const app = express();

// Behind a hosting proxy (Render/Railway/Fly/etc.) so req.ip and Secure cookies
// work correctly.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Security headers. CSP is disabled because this API serves JSON + a couple of
// small inline-styled redirect pages; the Next.js frontend manages its own CSP.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// Allow the frontend origin to call this API from the browser with cookies.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(cookieParser());

// Stripe webhooks must receive the raw request body for signature verification,
// so they are mounted BEFORE express.json() consumes/parses the body.
app.use("/webhooks", webhookRoutes);

app.use(express.json());

app.get("/health", (_, res) => res.json({ status: "OK" }));

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/business", businessRoutes);
app.use("/payment-settings", paymentSettingsRoutes);
app.use("/clients", clientRoutes);
app.use("/invoices", invoiceRoutes);
app.use("/payments", paymentRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/guest", guestRoutes);
app.use("/public", publicRoutes);

module.exports = app;
