const { getPublicInvoice } = require("../services/invoice.service");
const { createPublicCheckoutSession } = require("../services/payment.service");

async function viewInvoice(req, res) {
  try {
    const data = await getPublicInvoice(req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    if (err.message === "INVOICE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Invoice not found." },
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not load invoice." },
    });
  }
}

async function checkout(req, res) {
  try {
    const result = await createPublicCheckoutSession(req.params.id);
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.message === "INVOICE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Invoice not found." },
      });
    }
    if (err.message === "INVALID_INVOICE_STATE") {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_STATE", message: "This invoice can no longer be paid." },
      });
    }
    if (err.message === "STRIPE_NOT_CONNECTED") {
      return res.status(400).json({
        success: false,
        error: { code: "STRIPE_NOT_CONNECTED", message: "Online payment isn't available for this invoice." },
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "STRIPE_ERROR", message: "Could not start payment." },
    });
  }
}

function resultPage(title, message) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#1f2937;padding:0 20px"><div style="width:48px;height:48px;border-radius:12px;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;margin:0 auto 16px">IF</div><h2 style="margin:0 0 8px">${title}</h2><p style="color:#6b7280">${message}</p></body></html>`;
}

// Email "Pay Now" target: creates a Stripe Checkout session and redirects the
// customer straight to Stripe (no public InvoiceForge page in between).
async function payRedirect(req, res) {
  try {
    const result = await createPublicCheckoutSession(req.params.id);
    return res.redirect(303, result.url);
  } catch (err) {
    const message =
      err.message === "INVALID_INVOICE_STATE"
        ? "This invoice has already been paid or is no longer payable."
        : err.message === "INVOICE_NOT_FOUND"
        ? "This invoice could not be found."
        : err.message === "STRIPE_NOT_CONNECTED"
        ? "Online card payment isn't set up for this invoice. Please use the payment details on the invoice, or contact the sender."
        : "We couldn't start the payment. Please contact the sender.";
    return res
      .status(err.message === "INVOICE_NOT_FOUND" ? 404 : 400)
      .send(resultPage("Payment unavailable", message));
  }
}

function paySuccess(_req, res) {
  return res.send(
    resultPage(
      "Payment received",
      "Thank you! Your payment was successful. A receipt has been emailed to you, and the sender has been notified."
    )
  );
}

function payCancel(_req, res) {
  return res.send(
    resultPage(
      "Payment canceled",
      "Your payment was canceled. You can use the link in your invoice email to try again."
    )
  );
}

module.exports = { viewInvoice, checkout, payRedirect, paySuccess, payCancel };
