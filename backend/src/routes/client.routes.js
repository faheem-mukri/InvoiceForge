const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const {
  list,
  create,
  getOne,
  update,
  remove,
} = require("../controllers/client.controller");

const router = express.Router();

router.get("/", requireAuth, list);
router.post("/", requireAuth, create);
router.get("/:id", requireAuth, getOne);
router.put("/:id", requireAuth, update);
router.delete("/:id", requireAuth, remove);

module.exports = router;
