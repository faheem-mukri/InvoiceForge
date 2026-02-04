const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { createDraftInvoice, downloadInvoicePdf } = require("../controllers/invoice.controller");
const { sendInvoiceController } = require("../controllers/invoice.controller");

const router = express.Router();

router.post("/", requireAuth, createDraftInvoice);
router.post("/:invoiceId/send", requireAuth, sendInvoiceController);
router.get("/:invoiceId/pdf", requireAuth, downloadInvoicePdf);

module.exports = router;
