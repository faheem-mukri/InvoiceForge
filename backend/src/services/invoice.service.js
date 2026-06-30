const pool = require('../db');
const { recordAudit } = require('../utils/audit');
const { computeTotals, computeItemTotal } = require('../utils/pricing');
const { nextInvoiceNumber } = require('./business.service');
const { sendInvoiceEmail } = require('../utils/email');
const { getPaymentSettings, buildPaymentSnapshot } = require('./paymentSettings.service');
const { generateInvoicePdfBuffer } = require('../pdf/invoicePdf');
const { sendPaymentNotifications } = require('../utils/paymentNotifications');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:4000';

const INVOICE_COLUMNS = `
  id, user_id, client_id, type, status, invoice_number,
  client_name, client_email, client_phone, client_company,
  client_address, shipping_address, currency,
  discount_type, discount_value, tax_type, tax_rate,
  subtotal, discount_amount, tax_amount, shipping_amount,
  handling_amount, round_off, total_amount,
  payment_method, payment_terms, notes, terms,
  issue_date, due_date, paid_at, pdf_url,
  created_at, updated_at
`;

// Pull a client snapshot if a client_id is supplied but snapshot fields aren't.
async function resolveClientSnapshot(executor, userId, data) {
  const snapshot = {
    client_id: data.client_id || null,
    client_name: data.client_name,
    client_email: data.client_email || null,
    client_phone: data.client_phone || null,
    client_company: data.client_company || null,
    client_address: data.client_address || null,
    shipping_address: data.shipping_address || null,
  };

  if (data.client_id && !data.client_name) {
    const res = await executor.query(
      `SELECT * FROM clients WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [data.client_id, userId]
    );
    if (res.rows.length > 0) {
      const c = res.rows[0];
      snapshot.client_name = c.client_name;
      snapshot.client_email = snapshot.client_email || c.email;
      snapshot.client_phone = snapshot.client_phone || c.phone;
      snapshot.client_company = snapshot.client_company || c.company_name;
      snapshot.client_address = snapshot.client_address || c.billing_address;
      snapshot.shipping_address = snapshot.shipping_address || c.shipping_address;
    }
  }

  return snapshot;
}

function validateInvoiceInput(data) {
  if (!data.type || !['PRODUCT', 'SERVICE'].includes(data.type)) {
    throw new Error('INVALID_TYPE');
  }
  if (!data.client_name && !data.client_id) {
    throw new Error('CLIENT_REQUIRED');
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('INVALID_ITEMS');
  }
  for (const item of data.items) {
    if (!item.description || item.quantity == null || item.unit_price == null) {
      throw new Error('INVALID_ITEM');
    }
    if (item.quantity <= 0) throw new Error('INVALID_QUANTITY');
    if (item.unit_price < 0) throw new Error('INVALID_PRICE');
  }
  if (data.issue_date && data.due_date) {
    if (new Date(data.due_date) < new Date(data.issue_date)) {
      throw new Error('INVALID_DUE_DATE');
    }
  }
  if (
    data.payment_method &&
    !['COD', 'BANK_TRANSFER', 'ONLINE', 'UPI', 'CARD'].includes(data.payment_method)
  ) {
    throw new Error('INVALID_PAYMENT_METHOD');
  }
}

async function insertItems(executor, invoiceId, items) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const totalPrice = computeItemTotal(item);
    await executor.query(
      `INSERT INTO invoice_items (
         invoice_id, description, quantity, unit, unit_price, discount, tax, total_price, position
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        invoiceId,
        item.description,
        item.quantity,
        item.unit || null,
        item.unit_price,
        parseInt(item.discount, 10) || 0,
        parseInt(item.tax, 10) || 0,
        totalPrice,
        i + 1,
      ]
    );
  }
}

async function createInvoice(userId, data) {
  validateInvoiceInput(data);

  const isProduct = data.type === 'PRODUCT';
  const totals = computeTotals({
    items: data.items,
    discountType: data.discount_type,
    discountValue: data.discount_value,
    taxType: data.tax_type,
    taxRate: data.tax_rate,
    shippingAmount: isProduct ? data.shipping_amount : 0,
    handlingAmount: isProduct ? data.handling_amount : 0,
    roundOff: data.round_off,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const snapshot = await resolveClientSnapshot(client, userId, data);

    // Snapshot the selected payment method's details from Payment Settings.
    const settings = await getPaymentSettings(userId);
    const paySnap = buildPaymentSnapshot(settings, data.payment_method);

    const invoiceNumber =
      data.invoice_number && String(data.invoice_number).trim()
        ? String(data.invoice_number).trim()
        : await nextInvoiceNumber(client, userId);

    const invoiceResult = await client.query(
      `INSERT INTO invoices (
         user_id, client_id, type, status, invoice_number,
         client_name, client_email, client_phone, client_company,
         client_address, shipping_address, currency,
         discount_type, discount_value, tax_type, tax_rate,
         subtotal, discount_amount, tax_amount, shipping_amount,
         handling_amount, round_off, total_amount,
         payment_method, payment_terms, notes, terms,
         issue_date, due_date, payment_provider, payment_details
       )
       VALUES (
         $1, $2, $3, 'DRAFT', $4,
         $5, $6, $7, $8,
         $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18, $19,
         $20, $21, $22,
         $23, $24, $25, $26,
         $27, $28, $29, $30
       )
       RETURNING id`,
      [
        userId,
        snapshot.client_id,
        data.type,
        invoiceNumber,
        snapshot.client_name,
        snapshot.client_email,
        snapshot.client_phone,
        snapshot.client_company,
        snapshot.client_address,
        snapshot.shipping_address,
        data.currency || 'USD',
        data.discount_type || 'NONE',
        data.discount_value || 0,
        data.tax_type || 'NONE',
        data.tax_rate || 0,
        totals.subtotal,
        totals.discountAmount,
        totals.taxAmount,
        totals.shippingAmount,
        totals.handlingAmount,
        totals.roundOff,
        totals.totalAmount,
        data.payment_method || null,
        data.payment_terms || null,
        data.notes || null,
        data.terms || null,
        data.issue_date || null,
        data.due_date || null,
        paySnap ? paySnap.provider : null,
        paySnap ? JSON.stringify(paySnap.details) : null,
      ]
    );

    const invoiceId = invoiceResult.rows[0].id;
    await insertItems(client, invoiceId, data.items);

    await recordAudit(client, {
      userId,
      entityType: 'INVOICE',
      entityId: invoiceId,
      action: 'INVOICE_CREATED',
      metadata: { invoice_number: invoiceNumber, total_amount: totals.totalAmount },
    });

    await client.query('COMMIT');
    return { invoiceId, invoiceNumber };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') throw new Error('DUPLICATE_INVOICE_NUMBER');
    throw err;
  } finally {
    client.release();
  }
}

async function updateInvoice(userId, invoiceId, data) {
  validateInvoiceInput(data);

  const isProduct = data.type === 'PRODUCT';
  const totals = computeTotals({
    items: data.items,
    discountType: data.discount_type,
    discountValue: data.discount_value,
    taxType: data.tax_type,
    taxRate: data.tax_rate,
    shippingAmount: isProduct ? data.shipping_amount : 0,
    handlingAmount: isProduct ? data.handling_amount : 0,
    roundOff: data.round_off,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT status FROM invoices WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [invoiceId, userId]
    );
    if (existing.rows.length === 0) throw new Error('INVOICE_NOT_FOUND');
    if (existing.rows[0].status !== 'DRAFT') throw new Error('INVALID_STATE');

    const snapshot = await resolveClientSnapshot(client, userId, data);

    const settings = await getPaymentSettings(userId);
    const paySnap = buildPaymentSnapshot(settings, data.payment_method);

    await client.query(
      `UPDATE invoices SET
         client_id = $2, type = $3,
         client_name = $4, client_email = $5, client_phone = $6, client_company = $7,
         client_address = $8, shipping_address = $9, currency = $10,
         discount_type = $11, discount_value = $12, tax_type = $13, tax_rate = $14,
         subtotal = $15, discount_amount = $16, tax_amount = $17, shipping_amount = $18,
         handling_amount = $19, round_off = $20, total_amount = $21,
         payment_method = $22, payment_terms = $23, notes = $24, terms = $25,
         issue_date = $26, due_date = $27,
         payment_provider = $28, payment_details = $29, updated_at = now()
       WHERE id = $1`,
      [
        invoiceId,
        snapshot.client_id,
        data.type,
        snapshot.client_name,
        snapshot.client_email,
        snapshot.client_phone,
        snapshot.client_company,
        snapshot.client_address,
        snapshot.shipping_address,
        data.currency || 'USD',
        data.discount_type || 'NONE',
        data.discount_value || 0,
        data.tax_type || 'NONE',
        data.tax_rate || 0,
        totals.subtotal,
        totals.discountAmount,
        totals.taxAmount,
        totals.shippingAmount,
        totals.handlingAmount,
        totals.roundOff,
        totals.totalAmount,
        data.payment_method || null,
        data.payment_terms || null,
        data.notes || null,
        data.terms || null,
        data.issue_date || null,
        data.due_date || null,
        paySnap ? paySnap.provider : null,
        paySnap ? JSON.stringify(paySnap.details) : null,
      ]
    );

    await client.query(`DELETE FROM invoice_items WHERE invoice_id = $1`, [invoiceId]);
    await insertItems(client, invoiceId, data.items);

    await recordAudit(client, {
      userId,
      entityType: 'INVOICE',
      entityId: invoiceId,
      action: 'INVOICE_UPDATED',
    });

    await client.query('COMMIT');
    return { invoiceId };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') throw new Error('DUPLICATE_INVOICE_NUMBER');
    throw err;
  } finally {
    client.release();
  }
}

async function duplicateInvoice(userId, invoiceId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const src = await client.query(
      `SELECT * FROM invoices WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [invoiceId, userId]
    );
    if (src.rows.length === 0) throw new Error('INVOICE_NOT_FOUND');
    const inv = src.rows[0];

    const items = await client.query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY position ASC NULLS LAST`,
      [invoiceId]
    );

    const invoiceNumber = await nextInvoiceNumber(client, userId);

    const newInvoice = await client.query(
      `INSERT INTO invoices (
         user_id, client_id, type, status, invoice_number,
         client_name, client_email, client_phone, client_company,
         client_address, shipping_address, currency,
         discount_type, discount_value, tax_type, tax_rate,
         subtotal, discount_amount, tax_amount, shipping_amount,
         handling_amount, round_off, total_amount,
         payment_method, payment_terms, notes, terms
       )
       SELECT
         user_id, client_id, type, 'DRAFT', $2,
         client_name, client_email, client_phone, client_company,
         client_address, shipping_address, currency,
         discount_type, discount_value, tax_type, tax_rate,
         subtotal, discount_amount, tax_amount, shipping_amount,
         handling_amount, round_off, total_amount,
         payment_method, payment_terms, notes, terms
       FROM invoices WHERE id = $1
       RETURNING id`,
      [invoiceId, invoiceNumber]
    );

    const newId = newInvoice.rows[0].id;

    for (const item of items.rows) {
      await client.query(
        `INSERT INTO invoice_items (
           invoice_id, description, quantity, unit, unit_price, discount, tax, total_price, position
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          newId,
          item.description,
          item.quantity,
          item.unit,
          item.unit_price,
          item.discount,
          item.tax,
          item.total_price,
          item.position,
        ]
      );
    }

    await recordAudit(client, {
      userId,
      entityType: 'INVOICE',
      entityId: newId,
      action: 'INVOICE_DUPLICATED',
      metadata: { source: invoiceId },
    });

    await client.query('COMMIT');
    return { invoiceId: newId, invoiceNumber };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deleteInvoice(userId, invoiceId) {
  const result = await pool.query(
    `UPDATE invoices SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [invoiceId, userId]
  );
  if (result.rows.length === 0) throw new Error('INVOICE_NOT_FOUND');

  await recordAudit(null, {
    userId,
    entityType: 'INVOICE',
    entityId: invoiceId,
    action: 'INVOICE_DELETED',
  });
}

async function sendInvoice(userId, invoiceId) {
  const result = await pool.query(
    `SELECT status FROM invoices WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [invoiceId, userId]
  );
  if (result.rows.length === 0) throw new Error('INVOICE_NOT_FOUND');
  if (result.rows[0].status !== 'DRAFT') throw new Error('INVALID_INVOICE_STATE');

  await pool.query(
    `UPDATE invoices
     SET status = 'SENT',
         issue_date = COALESCE(issue_date, now()),
         updated_at = now()
     WHERE id = $1`,
    [invoiceId]
  );

  await recordAudit(null, {
    userId,
    entityType: 'INVOICE',
    entityId: invoiceId,
    action: 'INVOICE_SENT',
  });

  return emailInvoiceToCustomer(userId, invoiceId);
}

// Generates the invoice PDF, emails it to the customer as an attachment, and
// records delivery status. Used by both send and resend. Best-effort.
async function emailInvoiceToCustomer(userId, invoiceId, opts = {}) {
  try {
    const [invRes, itemsRes, bizRes] = await Promise.all([
      pool.query(`SELECT * FROM invoices WHERE id = $1`, [invoiceId]),
      pool.query(
        `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY position ASC NULLS LAST`,
        [invoiceId]
      ),
      pool.query(`SELECT * FROM business_profiles WHERE user_id = $1`, [userId]),
    ]);

    const invoice = invRes.rows[0];
    const business = bizRes.rows[0] || null;
    const payUrl = `${API_URL}/public/invoices/${invoiceId}/pay`;

    const pdfBuffer = await generateInvoicePdfBuffer(invoice, itemsRes.rows, business);

    const emailed = await sendInvoiceEmail({
      invoice,
      business,
      payUrl,
      pdfBuffer,
      subject: opts.subject,
      message: opts.message,
    });

    await pool.query(
      `UPDATE invoices SET sent_at = now(), delivery_status = 'SENT', updated_at = now() WHERE id = $1`,
      [invoiceId]
    );

    return { emailed: !!emailed.sent, emailReason: emailed.reason || null };
  } catch (err) {
    console.error('Invoice email failed:', err.message);
    await pool.query(
      `UPDATE invoices SET delivery_status = 'FAILED', updated_at = now() WHERE id = $1`,
      [invoiceId]
    ).catch(() => {});
    return { emailed: false, emailReason: err.message || 'EMAIL_ERROR' };
  }
}

async function resendInvoice(userId, invoiceId, opts = {}) {
  const result = await pool.query(
    `SELECT status FROM invoices WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [invoiceId, userId]
  );
  if (result.rows.length === 0) throw new Error('INVOICE_NOT_FOUND');
  if (!['SENT', 'OVERDUE'].includes(result.rows[0].status)) {
    // A paid (or draft/cancelled) invoice shouldn't be re-sent as an unpaid one.
    throw new Error('INVALID_INVOICE_STATE');
  }

  await recordAudit(null, {
    userId,
    entityType: 'INVOICE',
    entityId: invoiceId,
    action: 'INVOICE_RESENT',
  });

  return emailInvoiceToCustomer(userId, invoiceId, opts);
}

async function markInvoicePaid(userId, invoiceId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT id, status, total_amount, currency, payment_method
       FROM invoices
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [invoiceId, userId]
    );
    if (result.rows.length === 0) throw new Error('INVOICE_NOT_FOUND');

    const invoice = result.rows[0];
    if (invoice.status !== 'SENT' && invoice.status !== 'OVERDUE') {
      throw new Error('INVALID_INVOICE_STATE');
    }

    await client.query(
      `UPDATE invoices SET status = 'PAID', paid_at = now(), updated_at = now() WHERE id = $1`,
      [invoiceId]
    );

    const method =
      invoice.payment_method && invoice.payment_method !== 'ONLINE'
        ? invoice.payment_method
        : 'BANK_TRANSFER';

    const updated = await client.query(
      `UPDATE payments
       SET provider = 'MANUAL', method = $2, amount = $3, currency = $4,
           status = 'SUCCESS', paid_at = now(), updated_at = now()
       WHERE invoice_id = $1
       RETURNING id`,
      [invoiceId, method, invoice.total_amount, invoice.currency]
    );

    if (updated.rowCount === 0) {
      await client.query(
        `INSERT INTO payments (invoice_id, user_id, provider, method, amount, currency, status, paid_at)
         VALUES ($1, $2, 'MANUAL', $3, $4, $5, 'SUCCESS', now())`,
        [invoiceId, userId, method, invoice.total_amount, invoice.currency]
      );
    }

    await recordAudit(client, {
      userId,
      entityType: 'INVOICE',
      entityId: invoiceId,
      action: 'INVOICE_MARKED_PAID',
      metadata: { method, provider: 'MANUAL' },
    });

    await client.query('COMMIT');

    // Send the same payment confirmation emails as an online payment
    // (customer receipt + optional owner notification). Best-effort.
    sendPaymentNotifications(invoiceId, userId).catch((e) =>
      console.error('Payment notification failed:', e.message)
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getInvoiceForPdf(userId, invoiceId) {
  const invoiceResult = await pool.query(
    `SELECT * FROM invoices WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [invoiceId, userId]
  );
  if (invoiceResult.rows.length === 0) throw new Error('INVOICE_NOT_FOUND');

  const invoice = invoiceResult.rows[0];
  if (invoice.status !== 'SENT' && invoice.status !== 'PAID') {
    throw new Error('INVOICE_NOT_SENT');
  }

  const itemsResult = await pool.query(
    `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY position ASC NULLS LAST`,
    [invoiceId]
  );

  const businessResult = await pool.query(
    `SELECT * FROM business_profiles WHERE user_id = $1`,
    [userId]
  );

  return {
    invoice,
    items: itemsResult.rows,
    business: businessResult.rows[0] || null,
  };
}

async function listInvoices(userId, { status, q, page, limit }) {
  const params = [userId];
  const conditions = ['user_id = $1', 'deleted_at IS NULL'];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(
      `(invoice_number ILIKE $${params.length} OR client_name ILIKE $${params.length})`
    );
  }

  const whereClause = conditions.join(' AND ');
  const listParams = [...params, limit, (page - 1) * limit];

  const [invoicesResult, countResult] = await Promise.all([
    pool.query(
      `SELECT id, invoice_number, client_name, client_email, type, status,
              currency, total_amount, issue_date, due_date, paid_at, created_at, updated_at
       FROM invoices
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      listParams
    ),
    pool.query(`SELECT COUNT(*) FROM invoices WHERE ${whereClause}`, params),
  ]);

  const total = parseInt(countResult.rows[0].count, 10);

  return {
    invoices: invoicesResult.rows,
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

async function getInvoiceById(userId, invoiceId) {
  const invoiceResult = await pool.query(
    `SELECT * FROM invoices WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [invoiceId, userId]
  );
  if (invoiceResult.rows.length === 0) throw new Error('INVOICE_NOT_FOUND');

  const [itemsResult, paymentResult, businessResult] = await Promise.all([
    pool.query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY position ASC NULLS LAST`,
      [invoiceId]
    ),
    pool.query(`SELECT * FROM payments WHERE invoice_id = $1`, [invoiceId]),
    pool.query(`SELECT * FROM business_profiles WHERE user_id = $1`, [userId]),
  ]);

  return {
    invoice: invoiceResult.rows[0],
    items: itemsResult.rows,
    payment: paymentResult.rows[0] || null,
    business: businessResult.rows[0] || null,
  };
}

async function getInvoiceSummary(userId) {
  const result = await pool.query(
    `SELECT status, COUNT(*) as count
     FROM invoices
     WHERE user_id = $1 AND deleted_at IS NULL
     GROUP BY status`,
    [userId]
  );

  const base = { DRAFT: 0, SENT: 0, PAID: 0, OVERDUE: 0, CANCELLED: 0 };
  result.rows.forEach((row) => {
    base[row.status] = parseInt(row.count, 10);
  });
  return base;
}

// Public view for the customer payment page. Only payable/paid invoices are
// exposed (never DRAFT/CANCELLED), and only safe presentation fields.
async function getPublicInvoice(invoiceId) {
  const invoiceResult = await pool.query(
    `SELECT * FROM invoices WHERE id = $1 AND deleted_at IS NULL`,
    [invoiceId]
  );
  if (invoiceResult.rows.length === 0) throw new Error('INVOICE_NOT_FOUND');

  const invoice = invoiceResult.rows[0];
  if (!['SENT', 'OVERDUE', 'PAID'].includes(invoice.status)) {
    // Don't reveal drafts/cancelled invoices publicly.
    throw new Error('INVOICE_NOT_FOUND');
  }

  const [itemsResult, businessResult] = await Promise.all([
    pool.query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY position ASC NULLS LAST`,
      [invoiceId]
    ),
    pool.query(
      `SELECT business_name, business_email, business_phone, business_address, website, gst_number
       FROM business_profiles WHERE user_id = $1`,
      [invoice.user_id]
    ),
  ]);

  return {
    invoice,
    items: itemsResult.rows,
    business: businessResult.rows[0] || null,
  };
}

module.exports = {
  createInvoice,
  updateInvoice,
  duplicateInvoice,
  deleteInvoice,
  sendInvoice,
  resendInvoice,
  markInvoicePaid,
  getInvoiceForPdf,
  listInvoices,
  getInvoiceById,
  getInvoiceSummary,
  getPublicInvoice,
};
