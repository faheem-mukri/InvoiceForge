const express = require("express");
require('dotenv').config();
const authRoutes = require("./routes/auth.routes");
const requireAuth = require("./middleware/requireAuth");

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

module.exports = app;
