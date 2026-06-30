const { generateInvoicePdf } = require('../pdf/invoicePdf');
const {
  createInvoice,
  updateInvoice,
  duplicateInvoice,
  deleteInvoice,
  sendInvoice,
  resendInvoice,
  markInvoicePaid,
  getInvoiceForPdf,
  listInvoices,
  getInvoiceById,
  getInvoiceSummary,
} = require('../services/invoice.service');

const VALIDATION_MESSAGES = {
  INVALID_TYPE: 'type must be PRODUCT or SERVICE',
  CLIENT_REQUIRED: 'A client name (or client_id) is required',
  INVALID_ITEMS: 'items must be a non-empty array',
  INVALID_ITEM: 'Each item needs a description, quantity, and unit_price',
  INVALID_QUANTITY: 'Item quantity must be greater than 0',
  INVALID_PRICE: 'Item unit price cannot be negative',
  INVALID_DUE_DATE: 'Due date cannot be earlier than the issue date',
  INVALID_PAYMENT_METHOD: 'Invalid payment method',
};

function handleInvoiceError(res, error, fallbackMessage) {
  if (VALIDATION_MESSAGES[error.message]) {
    return res.status(422).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: VALIDATION_MESSAGES[error.message] },
    });
  }
  if (error.message === 'DUPLICATE_INVOICE_NUMBER') {
    return res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE_INVOICE_NUMBER', message: 'An invoice with this number already exists' },
    });
  }
  if (error.message === 'INVOICE_NOT_FOUND') {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Invoice not found.' },
    });
  }
  if (error.message === 'INVALID_STATE' || error.message === 'INVALID_INVOICE_STATE') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATE', message: 'This action is not allowed in the invoice\'s current state.' },
    });
  }
  if (error.message === 'INVOICE_NOT_SENT') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATE', message: 'Only SENT or PAID invoices can be downloaded as PDF.' },
    });
  }
  console.error(error);
  return res.status(500).json({
    success: false,
    error: { code: 'SERVER_ERROR', message: fallbackMessage },
  });
}

async function createDraftInvoice(req, res) {
  try {
    const invoice = await createInvoice(req.user.id, req.body);
    return res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    return handleInvoiceError(res, error, 'Could not create invoice.');
  }
}

async function updateInvoiceController(req, res) {
  try {
    const result = await updateInvoice(req.user.id, req.params.invoiceId, req.body);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleInvoiceError(res, error, 'Could not update invoice.');
  }
}

async function duplicateInvoiceController(req, res) {
  try {
    const result = await duplicateInvoice(req.user.id, req.params.invoiceId);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return handleInvoiceError(res, error, 'Could not duplicate invoice.');
  }
}

async function deleteInvoiceController(req, res) {
  try {
    await deleteInvoice(req.user.id, req.params.invoiceId);
    return res.json({ success: true, data: { message: 'Invoice deleted.' } });
  } catch (error) {
    return handleInvoiceError(res, error, 'Could not delete invoice.');
  }
}

async function sendInvoiceController(req, res) {
  try {
    const result = await sendInvoice(req.user.id, req.params.invoiceId);
    return res.json({
      success: true,
      message: 'Invoice sent successfully.',
      data: result || {},
    });
  } catch (error) {
    return handleInvoiceError(res, error, 'Could not send invoice.');
  }
}

async function resendInvoiceController(req, res) {
  try {
    const { subject, message } = req.body || {};
    const result = await resendInvoice(req.user.id, req.params.invoiceId, { subject, message });
    return res.json({
      success: true,
      message: 'Invoice resent.',
      data: result || {},
    });
  } catch (error) {
    return handleInvoiceError(res, error, 'Could not resend invoice.');
  }
}

async function markInvoicePaidController(req, res) {
  try {
    await markInvoicePaid(req.user.id, req.params.invoiceId);
    return res.json({ success: true, message: 'Invoice marked as paid.' });
  } catch (error) {
    return handleInvoiceError(res, error, 'Could not mark invoice as paid.');
  }
}

async function downloadInvoicePdf(req, res) {
  try {
    const { invoice, items, business } = await getInvoiceForPdf(
      req.user.id,
      req.params.invoiceId
    );
    generateInvoicePdf(invoice, items, res, business);
  } catch (error) {
    if (!res.headersSent) {
      return handleInvoiceError(res, error, 'Could not generate PDF for invoice.');
    }
    console.error(error);
  }
}

async function listInvoicesController(req, res) {
  try {
    const { status, q, page = 1, limit = 10 } = req.query;
    const validStatuses = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `status must be one of: ${validStatuses.join(', ')}` },
      });
    }

    const result = await listInvoices(req.user.id, {
      status: status || null,
      q: q || null,
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 10)),
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleInvoiceError(res, error, 'Could not fetch invoices.');
  }
}

async function getInvoiceByIdController(req, res) {
  try {
    const data = await getInvoiceById(req.user.id, req.params.invoiceId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleInvoiceError(res, error, 'Could not fetch invoice.');
  }
}

async function getInvoiceSummaryController(req, res) {
  try {
    const summary = await getInvoiceSummary(req.user.id);
    return res.json({ success: true, data: summary });
  } catch (error) {
    return handleInvoiceError(res, error, 'Could not fetch summary.');
  }
}

module.exports = {
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
};
