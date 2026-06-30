const { getDashboard } = require("../services/dashboard.service");

async function dashboard(req, res) {
  try {
    const data = await getDashboard(req.user.id);
    return res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not load dashboard." },
    });
  }
}

module.exports = { dashboard };
