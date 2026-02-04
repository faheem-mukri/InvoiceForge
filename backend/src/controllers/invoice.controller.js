const { createInvoice } = require('../services/invoice.service');

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

module.exports = {
    createDraftInvoice,
};