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

const LOGO_ERRORS = {
  INVALID_LOGO_TYPE: "Logo must be a PNG or JPEG image.",
  INVALID_LOGO_DATA: "The logo image could not be read. Please try another file.",
  LOGO_TOO_LARGE: "Logo must be smaller than 512 KB.",
};

async function updateBusiness(req, res) {
  try {
    const profile = await updateBusinessProfile(req.user.id, req.body);
    return res.json({ success: true, data: profile });
  } catch (err) {
    if (LOGO_ERRORS[err.message]) {
      return res.status(422).json({
        success: false,
        error: { code: err.message, message: LOGO_ERRORS[err.message] },
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not update business profile." },
    });
  }
}

module.exports = { getBusiness, updateBusiness };
