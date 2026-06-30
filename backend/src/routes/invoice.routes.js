const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const {
  createDraftInvoice,
  updateInvoiceController,
  duplicateInvoiceController,
  deleteInvoiceController,
  sendInvoiceController,
  resendInvoiceController,
  markInvoicePaidController,
  downloadInvoicePdf,
  listInvoicesController,
  getInvoiceByIdController,
  getInvoiceSummaryController,
} = require('../controllers/invoice.controller');

const router = express.Router();

// Summary must come before /:invoiceId or Express matches it as an ID
router.get('/summary', requireAuth, getInvoiceSummaryController);

router.get('/', requireAuth, listInvoicesController);
router.post('/', requireAuth, createDraftInvoice);
router.get('/:invoiceId', requireAuth, getInvoiceByIdController);
router.put('/:invoiceId', requireAuth, updateInvoiceController);
router.delete('/:invoiceId', requireAuth, deleteInvoiceController);
router.post('/:invoiceId/duplicate', requireAuth, duplicateInvoiceController);
router.post('/:invoiceId/send', requireAuth, sendInvoiceController);
router.post('/:invoiceId/resend', requireAuth, resendInvoiceController);
router.post('/:invoiceId/mark-paid', requireAuth, markInvoicePaidController);
router.get('/:invoiceId/pdf', requireAuth, downloadInvoicePdf);

module.exports = router;
