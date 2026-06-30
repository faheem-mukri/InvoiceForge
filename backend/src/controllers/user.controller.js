const { getUserById, updateUser } = require("../services/auth.service");
const { getBusinessProfile } = require("../services/business.service");

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    createdAt: user.created_at,
    notifyOnPaid: user.notify_on_paid,
    notifyReminders: user.notify_reminders,
    twoFactorEnabled: user.two_factor_enabled,
    authProvider: user.auth_provider,
  };
}

async function getMe(req, res) {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    const business = await getBusinessProfile(req.user.id);

    return res.json({
      success: true,
      data: { ...serializeUser(user), business },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not load profile." },
    });
  }
}

async function updateMe(req, res) {
  try {
    const { firstName, lastName, notifyOnPaid, notifyReminders } = req.body;
    const user = await updateUser(req.user.id, { firstName, lastName, notifyOnPaid, notifyReminders });
    return res.json({ success: true, data: serializeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not update profile." },
    });
  }
}

module.exports = { getMe, updateMe };
