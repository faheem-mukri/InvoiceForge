const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { getBusiness, updateBusiness } = require("../controllers/business.controller");

const router = express.Router();

router.get("/", requireAuth, getBusiness);
router.put("/", requireAuth, updateBusiness);

module.exports = router;
