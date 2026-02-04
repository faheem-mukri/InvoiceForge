const { createInvoice } = require('../services/invoice.service');
const { sendInvoice } = require('../services/invoice.service');
const { getInvoiceForPdf } = require('../services/invoice.service');
const { generateInvoicePdf } = require('../pdf/invoicePdf');

async function createDraftInvoice (req, res) {
    try {
        const invoice = await createInvoice(req.user.id, req.body);

        return res.status(201).json({
            success: true,
            data: invoice,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'SERVER_ERROR',
                message: 'Could not create invoice draft.',
            },
        });
    }
}

async function sendInvoiceController (req, res) {
    try {
        const { invoiceId } = req.params;
        await sendInvoice(req.user.id, invoiceId);

        return res.json({
            success: true,
            message: 'Invoice sent successfully.',
        });
    } catch (error) {
        if (error.message === 'INVOICE_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'INVOICE_NOT_FOUND',
                    message: 'Invoice not found.',
                },
            });
        }

        if (error.message === 'INVALID_INVOICE_STATE') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INVOICE_STATE',
                    message: 'Only DRAFT invoices can be sent.',
                },
            });
        }

        console.error(error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'SERVER_ERROR',
                message: 'Could not send invoice.',
            },
        });
    }
}

async function downloadInvoicePdf(req, res) {
    try {
        const { invoiceId } = req.params;

        const { invoice, items } = await getInvoiceForPdf(
            req.user.id, 
            invoiceId
        );

        generateInvoicePdf(invoice, items, res);
    } catch (error) {
        if (error.message === 'INVOICE_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'INVOICE_NOT_FOUND',
                    message: 'Invoice not found.',
                },
            });
        }

        if (error.message === 'INVOICE_NOT_SENT') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVOICE_NOT_SENT',
                    message: 'Only SENT invoices can be downloaded as PDF.',
                },
            });
        }

        console.error(error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'SERVER_ERROR',
                message: 'Could not generate PDF for invoice.',
            },
        });
    }
}

module.exports = {
    createDraftInvoice,
    sendInvoiceController,
    downloadInvoicePdf,
};