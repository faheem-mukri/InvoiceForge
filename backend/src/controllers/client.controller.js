const {
  listClients,
  createClient,
  getClient,
  updateClient,
  deleteClient,
} = require("../services/client.service");

function notFound(res) {
  return res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Client not found." },
  });
}

async function list(req, res) {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const result = await listClients(req.user.id, {
      q: q || null,
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not load clients." },
    });
  }
}

async function create(req, res) {
  try {
    const client = await createClient(req.user.id, req.body);
    return res.status(201).json({ success: true, data: client });
  } catch (err) {
    if (err.message === "VALIDATION_ERROR") {
      return res.status(422).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Client name is required." },
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not create client." },
    });
  }
}

async function getOne(req, res) {
  try {
    const client = await getClient(req.user.id, req.params.id);
    return res.json({ success: true, data: client });
  } catch (err) {
    if (err.message === "NOT_FOUND") return notFound(res);
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not load client." },
    });
  }
}

async function update(req, res) {
  try {
    const client = await updateClient(req.user.id, req.params.id, req.body);
    return res.json({ success: true, data: client });
  } catch (err) {
    if (err.message === "NOT_FOUND") return notFound(res);
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not update client." },
    });
  }
}

async function remove(req, res) {
  try {
    await deleteClient(req.user.id, req.params.id);
    return res.json({ success: true, data: { message: "Client deleted." } });
  } catch (err) {
    if (err.message === "NOT_FOUND") return notFound(res);
    console.error(err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Could not delete client." },
    });
  }
}

module.exports = { list, create, getOne, update, remove };
