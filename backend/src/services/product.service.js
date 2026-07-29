const pool = require("../db");

// Reusable catalog of products/services a user can drop into invoices.
// All queries are scoped by user_id for tenant isolation.

const SELECT_FIELDS = `id, name, description, sku, type, unit, unit_price,
  currency, tax_rate, is_active, created_at, updated_at`;

async function listProducts(userId, { search, activeOnly } = {}) {
  const params = [userId];
  let sql = `SELECT ${SELECT_FIELDS} FROM products
             WHERE user_id = $1 AND deleted_at IS NULL`;

  if (activeOnly) sql += ` AND is_active = TRUE`;

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (name ILIKE $${params.length} OR sku ILIKE $${params.length}
                  OR description ILIKE $${params.length})`;
  }

  sql += ` ORDER BY name ASC`;
  const res = await pool.query(sql, params);
  return res.rows;
}

async function getProduct(userId, id) {
  const res = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM products
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [id, userId]
  );
  return res.rows[0] || null;
}

function normalize(body) {
  const name = (body.name || "").trim();
  if (!name) throw new Error("NAME_REQUIRED");

  const unitPrice = Math.round(Number(body.unitPrice) || 0);
  if (unitPrice < 0) throw new Error("INVALID_PRICE");

  const taxRate = Number(body.taxRate) || 0;
  if (taxRate < 0) throw new Error("INVALID_TAX_RATE");

  const type = body.type === "PRODUCT" ? "PRODUCT" : "SERVICE";

  return {
    name,
    description: body.description?.trim() || null,
    sku: body.sku?.trim() || null,
    type,
    unit: body.unit?.trim() || null,
    unitPrice,
    currency: (body.currency || "USD").toUpperCase().slice(0, 3),
    taxRate,
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  };
}

async function createProduct(userId, body) {
  const p = normalize(body);
  const res = await pool.query(
    `INSERT INTO products
       (user_id, name, description, sku, type, unit, unit_price, currency, tax_rate, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${SELECT_FIELDS}`,
    [userId, p.name, p.description, p.sku, p.type, p.unit, p.unitPrice, p.currency, p.taxRate, p.isActive]
  );
  return res.rows[0];
}

async function updateProduct(userId, id, body) {
  const existing = await getProduct(userId, id);
  if (!existing) throw new Error("PRODUCT_NOT_FOUND");

  const p = normalize({
    name: body.name ?? existing.name,
    description: body.description ?? existing.description,
    sku: body.sku ?? existing.sku,
    type: body.type ?? existing.type,
    unit: body.unit ?? existing.unit,
    unitPrice: body.unitPrice ?? existing.unit_price,
    currency: body.currency ?? existing.currency,
    taxRate: body.taxRate ?? existing.tax_rate,
    isActive: body.isActive ?? existing.is_active,
  });

  const res = await pool.query(
    `UPDATE products SET
       name = $3, description = $4, sku = $5, type = $6, unit = $7,
       unit_price = $8, currency = $9, tax_rate = $10, is_active = $11,
       updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING ${SELECT_FIELDS}`,
    [id, userId, p.name, p.description, p.sku, p.type, p.unit, p.unitPrice, p.currency, p.taxRate, p.isActive]
  );
  return res.rows[0];
}

// Soft delete so historical invoices keep their meaning.
async function deleteProduct(userId, id) {
  const res = await pool.query(
    `UPDATE products SET deleted_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  if (res.rows.length === 0) throw new Error("PRODUCT_NOT_FOUND");
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};
