const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../services/product.service");

function notFound(res) {
  return res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Product not found." },
  });
}

function serverError(res, message) {
  return res.status(500).json({
    success: false,
    error: { code: "SERVER_ERROR", message },
  });
}

// Map service-thrown validation codes to a 422 with a friendly message.
const VALIDATION_MESSAGES = {
  NAME_REQUIRED: "Product name is required.",
  INVALID_PRICE: "Price must be zero or greater.",
  INVALID_TAX_RATE: "Tax rate must be zero or greater.",
};

function handleValidation(res, err) {
  const message = VALIDATION_MESSAGES[err.message];
  if (!message) return null;
  return res.status(422).json({
    success: false,
    error: { code: "VALIDATION_ERROR", message },
  });
}

async function list(req, res) {
  try {
    const products = await listProducts(req.user.id, {
      search: req.query.q || null,
      activeOnly: req.query.activeOnly === "true",
    });
    return res.json({ success: true, data: products });
  } catch (err) {
    console.error(err);
    return serverError(res, "Could not load products.");
  }
}

async function getOne(req, res) {
  try {
    const product = await getProduct(req.user.id, req.params.id);
    if (!product) return notFound(res);
    return res.json({ success: true, data: product });
  } catch (err) {
    console.error(err);
    return serverError(res, "Could not load product.");
  }
}

async function create(req, res) {
  try {
    const product = await createProduct(req.user.id, req.body);
    return res.status(201).json({ success: true, data: product });
  } catch (err) {
    const handled = handleValidation(res, err);
    if (handled) return handled;
    console.error(err);
    return serverError(res, "Could not create product.");
  }
}

async function update(req, res) {
  try {
    const product = await updateProduct(req.user.id, req.params.id, req.body);
    return res.json({ success: true, data: product });
  } catch (err) {
    if (err.message === "PRODUCT_NOT_FOUND") return notFound(res);
    const handled = handleValidation(res, err);
    if (handled) return handled;
    console.error(err);
    return serverError(res, "Could not update product.");
  }
}

async function remove(req, res) {
  try {
    await deleteProduct(req.user.id, req.params.id);
    return res.json({ success: true, data: { message: "Product deleted." } });
  } catch (err) {
    if (err.message === "PRODUCT_NOT_FOUND") return notFound(res);
    console.error(err);
    return serverError(res, "Could not delete product.");
  }
}

module.exports = { list, getOne, create, update, remove };
