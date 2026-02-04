const pool = require('../db');

async function createInvoice(userId, payload) {
    const {
        type,
        client,
        currency,
        items,
    } = payload;

    //generate simple invoice number (to be improved later)
    const invoiceNumber = `INV-${Date.now()}`;

    let subtotal = 0;
    for (const item of items || []) {
        subtotal += item.quantity * item.unitPrice;
    }

    const taxAmount = 0;
    const discountAmount = 0;
    const totalAmount = subtotal + taxAmount - discountAmount;

    const invoiceResult = await pool.query(
        `
    INSERT INTO invoices (
      user_id, type, status, invoice_number,
      client_name, client_email, client_address,
      currency, subtotal, tax_amount, discount_amount, total_amount
    )
    VALUES (
      $1, $2, 'DRAFT', $3,
      $4, $5, $6,
      $7, $8, $9, $10, $11
    )
    RETURNING id
    `,
    [
      userId,
      type,
      invoiceNumber,
      client.name,
      client.email || null,
      client.address || null,
      currency,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
    ]
  );

  const invoiceId = invoiceResult.rows[0].id;

  for ( let i = 0; i < (items || []).length; i++ ) {
    const item = items[i];
    await pool.query(
        `
      INSERT INTO invoice_items (
        invoice_id, description, quantity, unit_price, total_price, position
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        invoiceId,
        item.description,
        item.quantity,
        item.unitPrice,
        item.quantity * item.unitPrice,
        i + 1,
      ]
    );
    }

    return { invoiceId };
}

async function sendInvoice(userId, invoiceId) {
    // Placeholder for sending invoice logic
    // This could involve updating the invoice status and sending an email

    // ensure invoice belongs to user & is DRAFT
    const result = await pool.query(
       `
    SELECT status
    FROM invoices
    WHERE id = $1 AND user_id = $2
    `,
    [invoiceId, userId]
  );

  if (result.rows.length === 0) {
  throw new Error('INVOICE_NOT_FOUND');
  }

  if (result.rows[0].status !== 'DRAFT') {
    throw new Error('INVALID_INVOICE_STATE');
  }

  await pool.query(
    `
    UPDATE invoices
    SET status = 'SENT',
        issued_at = now(),
        updated_at = now()
    WHERE id = $1
    `,
    [invoiceId]
  );
}

module.exports = {
    createInvoice,
    sendInvoice,
};