const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { dashboard } = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/", requireAuth, dashboard);

module.exports = router;
