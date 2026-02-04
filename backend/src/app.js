const express = require("express");
const authRoutes = require("./routes/auth.routes");
const requireAuth = require("./middleware/requireAuth");
const invoiceRoutes = require("./routes/invoice.routes");

const app = express();
app.use(express.json());

app.get("/health", (_, res) => res.json({ status: "OK" }));
app.use("/auth", authRoutes);
app.get("/me", requireAuth, (req, res) => {
    res.json({
        success: true,
        data: { userId: req.user.id },
    });
});
app.use("/invoices", invoiceRoutes);

module.exports = app;
