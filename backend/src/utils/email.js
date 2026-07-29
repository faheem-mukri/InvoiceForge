/**
 * Email delivery.
 *
 * IMPORTANT: cloud hosts (Render free tier, Railway non-Pro, etc.) block
 * outbound SMTP ports (25/465/587), so SMTP times out in production. Prefer an
 * HTTP-API provider (port 443), which is never blocked.
 *
 * Provider is auto-selected by which env var is present, in priority order:
 *   1. BREVO_API_KEY   → Brevo HTTP API (free, single-sender verification, no
 *                        domain needed, sends to any recipient)
 *   2. RESEND_API_KEY  → Resend HTTP API (needs a verified domain to email
 *                        anyone other than your own account address)
 *   3. SMTP_HOST       → SMTP via nodemailer (local dev / hosts that allow SMTP)
 *   4. none            → log to console (dev fallback)
 */
const nodemailer = require("nodemailer");

const FROM = process.env.EMAIL_FROM || "InvoiceForge <no-reply@invoiceforge.local>";

// Parse "Display Name <email@host>" (or a bare address) into parts.
function parseFrom(value) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(value || "");
  if (m) return { name: m[1] || "InvoiceForge", email: m[2].trim() };
  return { name: "InvoiceForge", email: (value || "").trim() };
}

let transporter = null;
const smtpConfigured = Boolean(process.env.SMTP_HOST);
if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    // Fail fast instead of hanging the request when the port is blocked.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

const provider = process.env.BREVO_API_KEY
  ? "brevo"
  : process.env.RESEND_API_KEY
  ? "resend"
  : smtpConfigured
  ? "smtp"
  : "console";

// attachments (caller format): [{ filename, content: Buffer, contentType }]
async function sendViaBrevo({ to, subject, text, html, attachments }) {
  const sender = parseFrom(FROM);
  const body = {
    sender,
    to: [{ email: to }],
    subject,
    ...(html ? { htmlContent: html } : {}),
    ...(text ? { textContent: text } : {}),
    ...(attachments?.length
      ? { attachment: attachments.map((a) => ({ name: a.filename, content: a.content.toString("base64") })) }
      : {}),
  };
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo send failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return { sent: true };
}

async function sendViaResend({ to, subject, text, html, attachments }) {
  const body = {
    from: FROM,
    to: [to],
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    ...(attachments?.length
      ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })) }
      : {}),
  };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return { sent: true };
}

async function sendMail({ to, subject, text, html, attachments }) {
  if (!to) {
    console.warn("Email skipped: no recipient address.");
    return { sent: false, reason: "NO_RECIPIENT" };
  }

  if (provider === "brevo") return sendViaBrevo({ to, subject, text, html, attachments });
  if (provider === "resend") return sendViaResend({ to, subject, text, html, attachments });

  if (provider === "smtp") {
    await transporter.sendMail({ from: FROM, to, subject, text, html, attachments });
    return { sent: true };
  }

  // console fallback (no provider configured)
  console.log("──────── EMAIL (dev fallback, no provider configured) ────────");
  console.log("To:", to);
  console.log("Subject:", subject);
  console.log(text || html);
  if (attachments?.length) console.log(`Attachments: ${attachments.map((a) => a.filename).join(", ")}`);
  console.log("───────────────────────────────────────────────────────────");
  return { sent: false, reason: "EMAIL_NOT_CONFIGURED" };
}

function money(amountInCents, currency) {
  const symbols = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };
  const sym = symbols[currency] || `${currency} `;
  return `${sym}${((amountInCents || 0) / 100).toFixed(2)}`;
}

function pdfAttachment(invoice, pdfBuffer) {
  if (!pdfBuffer) return [];
  return [
    {
      filename: `invoice_${invoice.invoice_number}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    },
  ];
}

function paymentDetailsText(invoice) {
  const d = invoice.payment_details || {};
  const m = invoice.payment_method;
  if (m === "BANK_TRANSFER") {
    const lines = [];
    if (d.bank_name) lines.push(`Bank: ${d.bank_name}`);
    if (d.account_holder_name) lines.push(`Account Holder: ${d.account_holder_name}`);
    if (d.account_number) lines.push(`Account Number: ${d.account_number}`);
    if (d.ifsc_swift_code) lines.push(`IFSC/SWIFT: ${d.ifsc_swift_code}`);
    if (d.branch_name) lines.push(`Branch: ${d.branch_name}`);
    if (d.account_type) lines.push(`Account Type: ${d.account_type}`);
    return lines.length ? { title: "Bank transfer details", lines } : null;
  }
  if (m === "UPI") {
    const lines = [];
    if (d.upi_id) lines.push(`UPI ID: ${d.upi_id}`);
    if (d.upi_merchant_name) lines.push(`Merchant: ${d.upi_merchant_name}`);
    return lines.length ? { title: "UPI details", lines } : null;
  }
  if (m === "CASH" || m === "COD") {
    return { title: "Payment method", lines: ["Cash"] };
  }
  return null;
}

async function sendInvoiceEmail({ invoice, business, payUrl, pdfBuffer, subject, message }) {
  const businessName = business?.business_name || "Your supplier";
  const amount = money(invoice.total_amount, invoice.currency);
  const finalSubject = subject || `Invoice ${invoice.invoice_number} from ${businessName}`;
  const due = invoice.due_date ? new Date(invoice.due_date).toISOString().split("T")[0] : null;
  const isOnline = invoice.payment_method === "ONLINE";
  const details = isOnline ? null : paymentDetailsText(invoice);

  const intro = message
    ? message
    : `${businessName} has sent you invoice ${invoice.invoice_number} for ${amount}.${due ? ` Due by ${due}.` : ""}`;

  const detailsTextBlock = details
    ? `\n${details.title}:\n${details.lines.join("\n")}\n`
    : "";

  const text = [
    `Hi ${invoice.client_name || "there"},`,
    "",
    intro,
    "",
    "Your invoice is attached as a PDF.",
    isOnline && payUrl ? `\nPay online securely: ${payUrl}` : detailsTextBlock,
    "",
    "Thank you.",
  ]
    .filter(Boolean)
    .join("\n");

  const detailsHtml = details
    ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:16px 0">
         <p style="margin:0 0 6px;font-weight:600">${details.title}</p>
         ${details.lines.map((l) => `<p style="margin:2px 0;color:#475569">${l}</p>`).join("")}
       </div>`
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
      <p>Hi ${invoice.client_name || "there"},</p>
      <p>${intro}</p>
      <p>Your invoice is attached as a PDF.</p>
      ${
        isOnline && payUrl
          ? `<p style="margin:24px 0">
               <a href="${payUrl}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Pay Now</a>
             </p>`
          : detailsHtml
      }
      <p style="color:#6b7280;font-size:12px">Thank you for your business.</p>
    </div>`;

  return sendMail({
    to: invoice.client_email,
    subject: finalSubject,
    text,
    html,
    attachments: pdfAttachment(invoice, pdfBuffer),
  });
}

async function sendThankYouEmail({ invoice, business, pdfBuffer }) {
  const businessName = business?.business_name || "Your supplier";
  const amount = money(invoice.total_amount, invoice.currency);
  const paidDate = invoice.paid_at
    ? new Date(invoice.paid_at).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const subject = `Payment received — invoice ${invoice.invoice_number}`;
  const text = [
    `Hi ${invoice.client_name || "there"},`,
    "",
    `Thank you for your payment of ${amount}.`,
    `Invoice ${invoice.invoice_number} has been paid in full on ${paidDate}.`,
    "",
    `${businessName}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
      <p>Hi ${invoice.client_name || "there"},</p>
      <p>Thank you for your payment of <strong>${amount}</strong>.</p>
      <p>Invoice <strong>${invoice.invoice_number}</strong> has been paid in full on ${paidDate}.</p>
      <p style="color:#6b7280;font-size:12px">${businessName}</p>
    </div>`;

  return sendMail({
    to: invoice.client_email,
    subject,
    text,
    html,
    attachments: pdfAttachment(invoice, pdfBuffer),
  });
}

module.exports = { sendMail, sendInvoiceEmail, sendThankYouEmail };
