const PDFDocument = require('pdfkit');
const path = require('path');

// Embedded Unicode font (Noto Sans). PDFKit's built-in Helvetica uses WinAnsi
// encoding which has no glyph for the Indian rupee sign (₹, U+20B9) — it would
// render blank. Noto Sans covers ₹ along with $, €, £ and more.
const FONT_REGULAR = path.join(__dirname, 'fonts', 'NotoSans-Regular.ttf');
const FONT_BOLD = path.join(__dirname, 'fonts', 'NotoSans-Bold.ttf');
const FONT_BODY = 'Body';
const FONT_HEAVY = 'Bold';

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };

function formatAmount(amountInCents, currency) {
  const amount = ((amountInCents || 0) / 100).toFixed(2);
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${amount}`;
}

function fmtDate(value) {
  if (!value) return 'N/A';
  return new Date(value).toISOString().split('T')[0];
}

function renderPaymentDetails(doc, invoice) {
  const method = invoice.payment_method;
  const details = invoice.payment_details || {};
  if (!method) return;

  const lines = [];
  if (method === 'BANK_TRANSFER') {
    if (details.bank_name) lines.push(`Bank: ${details.bank_name}`);
    if (details.account_holder_name) lines.push(`Account Holder: ${details.account_holder_name}`);
    if (details.account_number) lines.push(`Account Number: ${details.account_number}`);
    if (details.ifsc_swift_code) lines.push(`IFSC/SWIFT: ${details.ifsc_swift_code}`);
    if (details.branch_name) lines.push(`Branch: ${details.branch_name}`);
    if (details.account_type) lines.push(`Account Type: ${details.account_type}`);
  } else if (method === 'UPI') {
    if (details.upi_id) lines.push(`UPI ID: ${details.upi_id}`);
    if (details.upi_merchant_name) lines.push(`Merchant: ${details.upi_merchant_name}`);
  } else if (method === 'CASH' || method === 'COD') {
    lines.push('Payment Method: Cash');
  } else if (method === 'ONLINE') {
    lines.push('Payment Method: Online (Pay using the link in your email)');
  }

  if (lines.length === 0) return;

  doc.moveDown(0.8);
  doc.font(FONT_HEAVY).fontSize(10).fillColor('#111111').text('Payment Details');
  doc.font(FONT_BODY).fillColor('#333333').fontSize(9);
  lines.forEach((l) => doc.text(l));
  doc.fillColor('black');
}

// Draws the entire invoice onto the given PDFKit document and ends it.
function renderInvoiceDocument(doc, invoice, items, business) {
  const currency = invoice.currency;
  try {
    // Register and default to the embedded Unicode font.
    doc.registerFont(FONT_BODY, FONT_REGULAR);
    doc.registerFont(FONT_HEAVY, FONT_BOLD);
    doc.font(FONT_BODY);
    // ===== HEADER =====
    const topY = doc.y;
    if (business && business.business_name) {
      doc.fontSize(16).font(FONT_HEAVY).text(business.business_name, 50, topY);
      doc.fontSize(9).font(FONT_BODY).fillColor('#555555');
      if (business.business_address) doc.text(business.business_address, { width: 250 });
      if (business.business_email) doc.text(business.business_email);
      if (business.business_phone) doc.text(business.business_phone);
      if (business.website) doc.text(business.website);
      if (business.gst_number) doc.text(`GST/VAT: ${business.gst_number}`);
      doc.fillColor('black');
    }

    doc.fontSize(26).font(FONT_HEAVY).fillColor('#111111')
      .text('INVOICE', 50, topY, { align: 'right' });
    doc.fillColor('black');

    doc.moveDown(2);

    // ===== META =====
    doc.fontSize(10).font(FONT_BODY);
    const metaY = doc.y;
    doc.text(`Invoice #: ${invoice.invoice_number}`, 50, metaY, { align: 'right' });
    doc.text(`Status: ${invoice.status}`, { align: 'right' });
    doc.text(`Issued: ${fmtDate(invoice.issue_date)}`, { align: 'right' });
    if (invoice.due_date) doc.text(`Due: ${fmtDate(invoice.due_date)}`, { align: 'right' });
    if (invoice.paid_at) doc.text(`Paid: ${fmtDate(invoice.paid_at)}`, { align: 'right' });

    // ===== BILL TO =====
    doc.moveDown(1.5);
    const billY = doc.y;
    doc.fontSize(10).font(FONT_HEAVY).text('Bill To:', 50, billY);
    doc.font(FONT_BODY).fillColor('#333333');
    doc.text(invoice.client_name);
    if (invoice.client_company) doc.text(invoice.client_company);
    if (invoice.client_email) doc.text(invoice.client_email);
    if (invoice.client_phone) doc.text(invoice.client_phone);
    if (invoice.client_address) doc.text(invoice.client_address, { width: 250 });
    doc.fillColor('black');

    if (invoice.type === 'PRODUCT' && invoice.shipping_address) {
      doc.moveDown(0.5);
      doc.font(FONT_HEAVY).text('Ship To:');
      doc.font(FONT_BODY).fillColor('#333333').text(invoice.shipping_address, { width: 250 });
      doc.fillColor('black');
    }

    // ===== ITEMS =====
    doc.moveDown(1.5);
    const cols = { desc: 50, qty: 290, unit: 340, price: 410, total: 490 };
    const headerY = doc.y;
    doc.fontSize(9).font(FONT_HEAVY);
    doc.text('Description', cols.desc, headerY);
    doc.text('Qty', cols.qty, headerY);
    doc.text('Unit', cols.unit, headerY);
    doc.text('Price', cols.price, headerY);
    doc.text('Amount', cols.total, headerY, { width: 60, align: 'right' });
    doc.moveTo(50, doc.y + 2).lineTo(550, doc.y + 2).strokeColor('#cccccc').stroke();
    doc.moveDown(0.6);

    doc.font(FONT_BODY).fontSize(9);
    const sorted = [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    sorted.forEach((item) => {
      const rowY = doc.y;
      doc.text(item.description, cols.desc, rowY, { width: 230 });
      doc.text(String(item.quantity), cols.qty, rowY);
      doc.text(item.unit || '-', cols.unit, rowY, { width: 60 });
      doc.text(formatAmount(item.unit_price, currency), cols.price, rowY, { width: 70 });
      doc.text(formatAmount(item.total_price, currency), cols.total, rowY, { width: 60, align: 'right' });
      doc.moveDown(0.8);
    });

    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.6);

    // ===== TOTALS =====
    const labelX = 380;
    const valX = 470;
    const valWidth = 80;
    function totalRow(label, value, bold = false) {
      const y = doc.y;
      doc.font(bold ? FONT_HEAVY : FONT_BODY).fontSize(bold ? 12 : 10);
      doc.text(label, labelX, y);
      doc.text(value, valX, y, { width: valWidth, align: 'right' });
      doc.moveDown(0.5);
    }
    totalRow('Subtotal', formatAmount(invoice.subtotal, currency));
    if (invoice.discount_amount > 0) totalRow('Discount', `-${formatAmount(invoice.discount_amount, currency)}`);
    if (invoice.tax_amount > 0) {
      const taxLabel = invoice.tax_type && invoice.tax_type !== 'NONE'
        ? `${invoice.tax_type} (${invoice.tax_rate}%)`
        : 'Tax';
      totalRow(taxLabel, formatAmount(invoice.tax_amount, currency));
    }
    if (invoice.shipping_amount > 0) totalRow('Shipping', formatAmount(invoice.shipping_amount, currency));
    if (invoice.handling_amount > 0) totalRow('Handling', formatAmount(invoice.handling_amount, currency));
    if (invoice.round_off && invoice.round_off !== 0) totalRow('Round Off', formatAmount(invoice.round_off, currency));
    doc.moveDown(0.2);
    totalRow('Total', formatAmount(invoice.total_amount, currency), true);

    // ===== PAYMENT DETAILS / NOTES / TERMS =====
    doc.moveDown(1);
    doc.x = 50;
    renderPaymentDetails(doc, invoice);

    if (invoice.payment_terms) {
      doc.moveDown(0.5);
      doc.font(FONT_BODY).fillColor('#333333').fontSize(9)
        .text(`Payment Terms: ${invoice.payment_terms}`, 50);
      doc.fillColor('black');
    }

    if (invoice.notes) {
      doc.moveDown(0.8);
      doc.font(FONT_HEAVY).fontSize(9).text('Notes', 50);
      doc.font(FONT_BODY).fillColor('#333333').text(invoice.notes, { width: 500 });
      doc.fillColor('black');
    }
    if (invoice.terms) {
      doc.moveDown(0.8);
      doc.font(FONT_HEAVY).fontSize(9).text('Terms & Conditions', 50);
      doc.font(FONT_BODY).fillColor('#333333').text(invoice.terms, { width: 500 });
      doc.fillColor('black');
    }

    doc.end();
  } catch (err) {
    console.error('PDF render error:', err);
    doc.end();
  }
}

// Stream the PDF to an HTTP response (download/inline view).
function generateInvoicePdf(invoice, items, res, business = null) {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename=invoice_${invoice.invoice_number}.pdf`
  );
  doc.on('error', (err) => {
    console.error('PDF generation error:', err);
    if (res.headersSent) res.end();
  });
  doc.pipe(res);
  renderInvoiceDocument(doc, invoice, items, business);
}

// Render the PDF to an in-memory Buffer (for email attachments).
function generateInvoicePdfBuffer(invoice, items, business = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    renderInvoiceDocument(doc, invoice, items, business);
  });
}

module.exports = { generateInvoicePdf, generateInvoicePdfBuffer };
