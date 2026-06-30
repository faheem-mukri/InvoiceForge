'use client';

import { formatMoney, formatDate } from '@/lib/format';

// A printable-style invoice document. Renders on a white "paper" surface in
// both themes so it looks like the final PDF. Drives off plain props so it can
// be fed from the live editor state or a saved invoice.
//
// props:
//   business: { business_name, business_email, business_phone, business_address, website, gst_number } | null
//   meta: { invoiceNumber, type, status, issueDate, dueDate, paymentMethod, paymentTerms }
//   client: { name, company, email, phone, billingAddress, shippingAddress }
//   items: [{ description, quantity, unit, unitPriceCents, lineTotalCents }]
//   totals: { subtotal, discountAmount, taxAmount, shipping, handling, total }
//   currency, taxType, taxRate, notes, terms
export default function InvoicePreview({
  business,
  meta = {},
  client = {},
  items = [],
  totals = {},
  currency = 'USD',
  taxType = 'NONE',
  taxRate = 0,
  notes,
  terms,
  paymentDetails = null,
}) {
  return (
    <div className="bg-white text-gray-800 rounded-lg shadow-sm border border-gray-200 p-8 sm:p-10 text-sm leading-relaxed">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          {business && business.business_name ? (
            <>
              <p className="text-lg font-bold text-gray-900">{business.business_name}</p>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                {business.business_address && <p className="whitespace-pre-line">{business.business_address}</p>}
                {business.business_email && <p>{business.business_email}</p>}
                {business.business_phone && <p>{business.business_phone}</p>}
                {business.website && <p>{business.website}</p>}
                {business.gst_number && <p>GST/VAT: {business.gst_number}</p>}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">Your business details</p>
          )}
        </div>

        <div className="text-right shrink-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">INVOICE</h1>
          <p className="font-mono text-xs text-gray-500 mt-1">
            {meta.invoiceNumber || 'Auto-generated'}
          </p>
          <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {meta.status || 'DRAFT'}
          </span>
        </div>
      </div>

      <div className="border-t border-gray-100 my-6" />

      {/* Bill to + meta */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Bill To</p>
          <p className="font-medium text-gray-900">{client.name || 'Client name'}</p>
          <div className="text-xs text-gray-500 space-y-0.5 mt-0.5">
            {client.company && <p>{client.company}</p>}
            {client.email && <p>{client.email}</p>}
            {client.phone && <p>{client.phone}</p>}
            {client.billingAddress && <p className="whitespace-pre-line">{client.billingAddress}</p>}
          </div>
          {meta.type === 'PRODUCT' && client.shippingAddress && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Ship To</p>
              <p className="text-xs text-gray-500 whitespace-pre-line">{client.shippingAddress}</p>
            </div>
          )}
        </div>

        <div className="text-right text-xs text-gray-600 space-y-1 shrink-0">
          <div className="flex justify-end gap-3"><span className="text-gray-400">Issued</span><span>{formatDate(meta.issueDate)}</span></div>
          <div className="flex justify-end gap-3"><span className="text-gray-400">Due</span><span>{formatDate(meta.dueDate)}</span></div>
          {meta.paymentMethod && (
            <div className="flex justify-end gap-3"><span className="text-gray-400">Method</span><span>{meta.paymentMethod.replace('_', ' ')}</span></div>
          )}
          {meta.paymentTerms && (
            <div className="flex justify-end gap-3"><span className="text-gray-400">Terms</span><span>{meta.paymentTerms}</span></div>
          )}
        </div>
      </div>

      {/* Items */}
      <table className="w-full mt-6 text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-200">
            <th className="text-left py-2 font-medium">Description</th>
            <th className="text-right py-2 font-medium w-12">Qty</th>
            <th className="text-left py-2 font-medium w-16 pl-3">Unit</th>
            <th className="text-right py-2 font-medium w-24">Price</th>
            <th className="text-right py-2 font-medium w-24">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.length === 0 ? (
            <tr><td colSpan={5} className="py-4 text-center text-gray-300">No items yet</td></tr>
          ) : (
            items.map((it, i) => (
              <tr key={i}>
                <td className="py-2 text-gray-800">{it.description || <span className="text-gray-300">Item description</span>}</td>
                <td className="py-2 text-right text-gray-600 tabular-nums">{it.quantity}</td>
                <td className="py-2 text-gray-500 pl-3">{it.unit || '—'}</td>
                <td className="py-2 text-right text-gray-600 tabular-nums">{formatMoney(it.unitPriceCents, currency)}</td>
                <td className="py-2 text-right text-gray-900 tabular-nums">{formatMoney(it.lineTotalCents, currency)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mt-4">
        <div className="w-full sm:w-64 space-y-1.5 text-xs">
          <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
          {totals.discountAmount > 0 && <Row label="Discount" value={`-${formatMoney(totals.discountAmount, currency)}`} />}
          {totals.taxAmount > 0 && (
            <Row label={taxType && taxType !== 'NONE' ? `${taxType} (${taxRate || 0}%)` : 'Tax'} value={formatMoney(totals.taxAmount, currency)} />
          )}
          {totals.shipping > 0 && <Row label="Shipping" value={formatMoney(totals.shipping, currency)} />}
          {totals.handling > 0 && <Row label="Handling" value={formatMoney(totals.handling, currency)} />}
          <div className="flex justify-between border-t border-gray-200 pt-2 mt-1 text-sm font-bold text-gray-900">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(totals.total, currency)}</span>
          </div>
        </div>
      </div>

      {/* Payment details snapshot */}
      {paymentDetails && (
        <div className="border-t border-gray-100 mt-6 pt-4 text-xs text-gray-600">
          <p className="font-semibold text-gray-700 mb-1">Payment Details</p>
          {paymentDetails.upi_id !== undefined ? (
            <div className="space-y-0.5">
              {paymentDetails.upi_id && <p>UPI ID: {paymentDetails.upi_id}</p>}
              {paymentDetails.upi_merchant_name && <p>Merchant: {paymentDetails.upi_merchant_name}</p>}
            </div>
          ) : (
            <div className="space-y-0.5">
              {paymentDetails.bank_name && <p>Bank: {paymentDetails.bank_name}</p>}
              {paymentDetails.account_holder_name && <p>Account Holder: {paymentDetails.account_holder_name}</p>}
              {paymentDetails.account_number && <p>Account Number: {paymentDetails.account_number}</p>}
              {paymentDetails.ifsc_swift_code && <p>IFSC/SWIFT: {paymentDetails.ifsc_swift_code}</p>}
              {paymentDetails.branch_name && <p>Branch: {paymentDetails.branch_name}</p>}
              {paymentDetails.account_type && <p>Account Type: {paymentDetails.account_type}</p>}
            </div>
          )}
        </div>
      )}

      {/* Notes & terms */}
      {(notes || terms) && (
        <div className="border-t border-gray-100 mt-6 pt-4 space-y-3 text-xs text-gray-600">
          {notes && (
            <div>
              <p className="font-semibold text-gray-700">Notes</p>
              <p className="whitespace-pre-line">{notes}</p>
            </div>
          )}
          {terms && (
            <div>
              <p className="font-semibold text-gray-700">Terms &amp; Conditions</p>
              <p className="whitespace-pre-line">{terms}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-gray-500">
      <span>{label}</span>
      <span className="tabular-nums text-gray-700">{value}</span>
    </div>
  );
}
