const PDFDocument = require('pdfkit');

function generateInvoicePdf(invoice, items, res) {
    const doc = new PDFDocument({margin: 50});

    // Stream PDF directly to response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition",
         `inline; filename=invoice_${invoice.invoice_number}.pdf`
    );
    
    doc.pipe(res);

   // ===== HEADER =====
  doc.fontSize(20).text("INVOICE", { align: "right" });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Invoice #: ${invoice.invoice_number}`);
  doc.text(`Issued: ${invoice.issued_at.toISOString().split("T")[0]}`);
  doc.moveDown();

  // ===== CLIENT =====
  doc.text(`Bill To:`);
  doc.text(invoice.client_name);
  if (invoice.client_email) doc.text(invoice.client_email);
  if (invoice.client_address) doc.text(invoice.client_address);
  doc.moveDown();

  // ===== ITEMS =====
  doc.fontSize(12).text("Items", { underline: true });
  doc.moveDown(0.5);

  items.forEach((item) => {
    doc.text(
      `${item.description} — ${item.quantity} × ${item.unit_price} = ${item.total_price}`
    );
  });

  doc.moveDown();

  // ===== TOTAL =====
  doc.fontSize(14).text(`Total: ${invoice.total_amount} ${invoice.currency}`, {
    align: "right",
  });

  doc.end();
}

module.exports = { generateInvoicePdf };