const {
  getBusinessProfile,
  updateBusinessProfile,
} = require("../services/business.service");

async function getBusiness(req, res) {
  try {
    const profile = await getBusinessProfile(req.user.id);
    return res.json({ success: true, data: profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not load business profile." },
    });
  }
}

async function updateBusiness(req, res) {
  try {
    const profile = await updateBusinessProfile(req.user.id, req.body);
    return res.json({ success: true, data: profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not update business profile." },
    });
  }
}

module.exports = { getBusiness, updateBusiness };
