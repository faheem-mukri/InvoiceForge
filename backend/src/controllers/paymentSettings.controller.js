const {
  getPaymentSettings,
  updatePaymentSettings,
  beginStripeConnect,
  refreshStripeStatus,
} = require("../services/paymentSettings.service");

async function get(req, res) {
  try {
    const settings = await getPaymentSettings(req.user.id);
    return res.json({ success: true, data: settings });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not load payment settings." },
    });
  }
}

async function update(req, res) {
  try {
    const settings = await updatePaymentSettings(req.user.id, req.body);
    return res.json({ success: true, data: settings });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not update payment settings." },
    });
  }
}

async function stripeConnect(req, res) {
  try {
    const result = await beginStripeConnect(req.user.id);
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.message === "STRIPE_CONNECT_UNAVAILABLE") {
      return res.status(400).json({
        success: false,
        error: {
          code: "STRIPE_CONNECT_UNAVAILABLE",
          message:
            "Stripe Connect is not available. Enable Connect in your Stripe dashboard, then try again.",
        },
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "STRIPE_ERROR", message: "Could not start Stripe onboarding." },
    });
  }
}

async function stripeStatus(req, res) {
  try {
    const status = await refreshStripeStatus(req.user.id);
    return res.json({ success: true, data: status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not load Stripe status." },
    });
  }
}

module.exports = { get, update, stripeConnect, stripeStatus };
