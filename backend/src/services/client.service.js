const pool = require("../db");

const FIELDS = [
  "client_name",
  "company_name",
  "email",
  "phone",
  "billing_address",
  "shipping_address",
  "notes",
];

async function listClients(userId, { q, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const params = [userId];
  let where = "user_id = $1 AND deleted_at IS NULL";

  if (q) {
    params.push(`%${q}%`);
    where += ` AND (client_name ILIKE $${params.length} OR company_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
  }

  const listParams = [...params, limit, offset];

  const [rows, count] = await Promise.all([
    pool.query(
      `SELECT * FROM clients
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      listParams
    ),
    pool.query(`SELECT COUNT(*) FROM clients WHERE ${where}`, params),
  ]);

  const total = parseInt(count.rows[0].count, 10);

  return {
    clients: rows.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

async function createClient(userId, data) {
  if (!data.client_name || !String(data.client_name).trim()) {
    throw new Error("VALIDATION_ERROR");
  }

  const result = await pool.query(
    `INSERT INTO clients (
       user_id, client_name, company_name, email, phone,
       billing_address, shipping_address, notes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      data.client_name.trim(),
      data.company_name || null,
      data.email || null,
      data.phone || null,
      data.billing_address || null,
      data.shipping_address || null,
      data.notes || null,
    ]
  );

  return result.rows[0];
}

async function getClient(userId, clientId) {
  const result = await pool.query(
    `SELECT * FROM clients WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [clientId, userId]
  );
  if (result.rows.length === 0) throw new Error("NOT_FOUND");
  return result.rows[0];
}

async function updateClient(userId, clientId, data) {
  await getClient(userId, clientId); // ownership + existence

  const sets = [];
  const values = [clientId, userId];

  for (const field of FIELDS) {
    if (data[field] !== undefined) {
      values.push(data[field] === "" ? null : data[field]);
      sets.push(`${field} = $${values.length}`);
    }
  }

  if (sets.length === 0) return getClient(userId, clientId);

  const result = await pool.query(
    `UPDATE clients SET ${sets.join(", ")}, updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    values
  );

  return result.rows[0];
}

async function deleteClient(userId, clientId) {
  const result = await pool.query(
    `UPDATE clients SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [clientId, userId]
  );
  if (result.rows.length === 0) throw new Error("NOT_FOUND");
}

module.exports = {
  listClients,
  createClient,
  getClient,
  updateClient,
  deleteClient,
};
