const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { createDraftInvoice } = require("../controllers/invoice.controller");
const { sendInvoiceController } = require("../controllers/invoice.controller");

const router = express.Router();

router.post("/", requireAuth, createDraftInvoice);
router.post("/:invoiceId/send", requireAuth, sendInvoiceController);

module.exports = router;
