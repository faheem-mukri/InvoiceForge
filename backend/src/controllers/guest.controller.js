const { generateInvoicePdf } = require("../pdf/invoicePdf");

function validationError(res, code, message) {
  return res.status(400).json({ success: false, error: { code, message } });
}

/**
 * Guest invoice: validates the payload, generates a PDF on the fly and streams
 * it back. Nothing is persisted — this is a fire-and-forget anonymous flow.
 *
 * All money values are integers in the smallest currency unit (cents).
 */
async function createGuestInvoice(req, res) {
  try {
    const {
      type,
      invoice_number,
      client_name,
      client_email,
      client_address,
      currency,
      tax_amount,
      discount_amount,
      payment_method,
      due_date,
      items,
    } = req.body;

    if (!client_name || !currency || !items) {
      return validationError(
        res,
        "MISSING_FIELD",
        "client_name, currency, and items are required"
      );
    }

    if (type && !["PRODUCT", "SERVICE"].includes(type)) {
      return validationError(res, "INVALID_TYPE", "type must be PRODUCT or SERVICE");
    }

    if (
      payment_method &&
      !["COD", "BANK_TRANSFER", "ONLINE"].includes(payment_method)
    ) {
      return validationError(
        res,
        "INVALID_PAYMENT_METHOD",
        "payment_method must be COD, BANK_TRANSFER, or ONLINE"
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return validationError(res, "INVALID_ITEMS", "items must be a non-empty array");
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.description || item.quantity == null || item.unit_price == null) {
        return validationError(
          res,
          "INVALID_ITEM",
          `Item at index ${i} is missing description, quantity, or unit_price`
        );
      }
      if (item.quantity <= 0) {
        return validationError(
          res,
          "INVALID_ITEM",
          `Item at index ${i} must have quantity greater than 0`
        );
      }
      if (item.unit_price < 0) {
        return validationError(
          res,
          "INVALID_ITEM",
          `Item at index ${i} must have unit_price >= 0`
        );
      }
    }

    const taxAmount = tax_amount ?? 0;
    const discountAmount = discount_amount ?? 0;

    if (taxAmount < 0 || discountAmount < 0) {
      return validationError(
        res,
        "INVALID_AMOUNT",
        "tax and discount must be >= 0"
      );
    }

    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    const totalAmount = subtotal + taxAmount - discountAmount;

    if (totalAmount < 0) {
      return validationError(
        res,
        "INVALID_AMOUNT",
        "total cannot be negative (check the discount amount)"
      );
    }

    // Build an in-memory invoice shaped like the persisted entity so the PDF
    // generator can be reused as-is. Nothing is written to the database.
    const invoice = {
      invoice_number: invoice_number || `GUEST-${Date.now()}`,
      status: "DRAFT",
      type: type || "PRODUCT",
      client_name,
      client_email: client_email || null,
      client_address: client_address || null,
      currency,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      payment_method: payment_method || null,
      issue_date: new Date(),
      due_date: due_date || null,
      paid_at: null,
    };

    const pdfItems = items.map((item, i) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
      position: i + 1,
    }));

    generateInvoicePdf(invoice, pdfItems, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: {
          code: "PDF_GENERATION_FAILED",
          message: "Could not generate guest invoice PDF.",
        },
      });
    }
  }
}

module.exports = { createGuestInvoice };
