const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { getMe, updateMe } = require("../controllers/user.controller");

const router = express.Router();

router.get("/me", requireAuth, getMe);
router.put("/me", requireAuth, updateMe);

module.exports = router;
