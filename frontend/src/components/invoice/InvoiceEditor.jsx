'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { invoiceApi, clientApi, businessApi, paymentSettingsApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { computeTotals, toMinorUnits } from '@/lib/pricing';

import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import InvoicePreview from '@/components/invoice/InvoicePreview';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'];
const inputClass =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all';

function centsToInput(cents) {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

function blankItem() {
  return { description: '', quantity: '1', unit: '', unitPrice: '' };
}

// `initial` is a normalized invoice object (edit mode) or null (create mode).
export default function InvoiceEditor({ mode = 'create', invoiceId, initial = null }) {
  const { token, loading: authLoading } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [business, setBusiness] = useState(null);
  const [clients, setClients] = useState([]);
  const [paySettings, setPaySettings] = useState(null);
  const [ready, setReady] = useState(mode === 'create' ? false : true);

  // ── form state ──
  const [type, setType] = useState(initial?.type || 'SERVICE');
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoice_number || '');
  const [currency, setCurrency] = useState(initial?.currency || 'USD');
  const [issueDate, setIssueDate] = useState(initial?.issue_date?.slice(0, 10) || '');
  const [dueDate, setDueDate] = useState(initial?.due_date?.slice(0, 10) || '');

  const [clientId, setClientId] = useState(initial?.client_id || '');
  const [clientName, setClientName] = useState(initial?.client_name || '');
  const [clientCompany, setClientCompany] = useState(initial?.client_company || '');
  const [clientEmail, setClientEmail] = useState(initial?.client_email || '');
  const [clientPhone, setClientPhone] = useState(initial?.client_phone || '');
  const [billingAddress, setBillingAddress] = useState(initial?.client_address || '');
  const [shippingAddress, setShippingAddress] = useState(initial?.shipping_address || '');

  const [items, setItems] = useState(
    initial?.items?.length
      ? initial.items.map((it) => ({
          description: it.description,
          quantity: String(it.quantity),
          unit: it.unit || '',
          unitPrice: centsToInput(it.unit_price),
        }))
      : [blankItem()]
  );

  const [discountType, setDiscountType] = useState(initial?.discount_type || 'NONE');
  const [discountValue, setDiscountValue] = useState(
    initial
      ? initial.discount_type === 'FIXED'
        ? centsToInput(Number(initial.discount_value))
        : String(initial.discount_value || '')
      : ''
  );
  const [taxType, setTaxType] = useState(initial?.tax_type || 'NONE');
  const [taxRate, setTaxRate] = useState(initial ? String(initial.tax_rate || '') : '');
  const [shipping, setShipping] = useState(centsToInput(initial?.shipping_amount) || '');
  const [handling, setHandling] = useState(centsToInput(initial?.handling_amount) || '');

  const [paymentMethod, setPaymentMethod] = useState(initial?.payment_method || '');
  const [paymentTerms, setPaymentTerms] = useState(initial?.payment_terms || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [terms, setTerms] = useState(initial?.terms || '');

  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // ── load business defaults + clients ──
  useEffect(() => {
    if (authLoading || !token) return;
    (async () => {
      try {
        const [b, c, ps] = await Promise.all([
          businessApi.get(token),
          clientApi.list(token, { limit: 100 }),
          paymentSettingsApi.get(token),
        ]);
        setBusiness(b.data);
        setClients(c.data.clients || []);
        setPaySettings(ps.data);
        if (mode === 'create') {
          if (!currency || currency === 'USD') setCurrency(b.data.default_currency || 'USD');
          if (!paymentMethod && ps.data?.default_method) {
            setPaymentMethod(ps.data.default_method);
          }
          if (!issueDate) setIssueDate(new Date().toISOString().slice(0, 10));
          setReady(true);
        }
      } catch (err) {
        if (err.status === 401) router.replace('/login');
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, token]);

  // Methods the user enabled in Payment Settings.
  const enabledMethods = useMemo(() => {
    const s = paySettings;
    if (!s) return [];
    const list = [];
    if (s.cash_enabled) list.push({ value: 'CASH', label: 'Cash' });
    if (s.bank_enabled) list.push({ value: 'BANK_TRANSFER', label: 'Bank Transfer' });
    if (s.upi_enabled) list.push({ value: 'UPI', label: 'UPI' });
    if (s.stripe_enabled && s.stripe_connection_status === 'CONNECTED') {
      list.push({ value: 'ONLINE', label: 'Online Payment (Stripe)' });
    }
    return list;
  }, [paySettings]);

  function selectClient(id) {
    setClientId(id);
    if (!id) return;
    const c = clients.find((x) => x.id === id);
    if (c) {
      setClientName(c.client_name || '');
      setClientCompany(c.company_name || '');
      setClientEmail(c.email || '');
      setClientPhone(c.phone || '');
      setBillingAddress(c.billing_address || '');
      setShippingAddress(c.shipping_address || '');
    }
  }

  function updateItem(i, field, value) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, blankItem()]);
  }
  function removeItem(i) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  // ── live totals ──
  const isProduct = type === 'PRODUCT';
  const totals = useMemo(() => {
    const itemsCents = items.map((it) => ({
      quantity: it.quantity,
      unitPriceCents: toMinorUnits(it.unitPrice),
    }));
    return computeTotals({
      items: itemsCents,
      discountType,
      discountValue: discountType === 'FIXED' ? toMinorUnits(discountValue) : Number(discountValue || 0),
      taxType,
      taxRate: Number(taxRate || 0),
      shippingAmount: isProduct ? toMinorUnits(shipping) : 0,
      handlingAmount: isProduct ? toMinorUnits(handling) : 0,
    });
  }, [items, discountType, discountValue, taxType, taxRate, shipping, handling, isProduct]);

  // Data for the live document preview (mirrors what will be saved/printed).
  const previewData = useMemo(() => ({
    business,
    meta: {
      invoiceNumber,
      type,
      status: initial?.status || 'DRAFT',
      issueDate,
      dueDate,
      paymentMethod,
      paymentTerms,
    },
    client: {
      name: clientName,
      company: clientCompany,
      email: clientEmail,
      phone: clientPhone,
      billingAddress,
      shippingAddress,
    },
    items: items.map((it) => {
      const qty = parseInt(it.quantity, 10) || 0;
      const unitPriceCents = toMinorUnits(it.unitPrice);
      return {
        description: it.description,
        quantity: it.quantity || '0',
        unit: it.unit,
        unitPriceCents,
        lineTotalCents: qty * unitPriceCents,
      };
    }),
    totals: {
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      shipping: isProduct ? toMinorUnits(shipping) : 0,
      handling: isProduct ? toMinorUnits(handling) : 0,
      total: totals.total,
    },
    currency,
    taxType,
    taxRate,
    notes,
    terms,
    paymentDetails:
      paymentMethod === 'BANK_TRANSFER' && paySettings
        ? {
            bank_name: paySettings.bank_name,
            account_holder_name: paySettings.account_holder_name,
            account_number: paySettings.account_number,
            ifsc_swift_code: paySettings.ifsc_swift_code,
            branch_name: paySettings.branch_name,
            account_type: paySettings.account_type,
          }
        : paymentMethod === 'UPI' && paySettings
        ? { upi_id: paySettings.upi_id, upi_merchant_name: paySettings.upi_merchant_name }
        : null,
  }), [
    business, invoiceNumber, type, initial, issueDate, dueDate, paymentMethod, paymentTerms,
    clientName, clientCompany, clientEmail, clientPhone, billingAddress, shippingAddress,
    items, totals, shipping, handling, currency, taxType, taxRate, notes, terms, paySettings,
    isProduct,
  ]);

  function validate() {
    if (!clientName.trim()) return 'Client name is required.';
    if (items.length === 0) return 'Add at least one line item.';
    for (let i = 0; i < items.length; i++) {
      if (!items[i].description.trim()) return `Item ${i + 1}: description is required.`;
      if ((parseInt(items[i].quantity, 10) || 0) <= 0) return `Item ${i + 1}: quantity must be greater than 0.`;
    }
    if (issueDate && dueDate && new Date(dueDate) < new Date(issueDate)) {
      return 'Due date cannot be earlier than the issue date.';
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    const payload = {
      type,
      client_id: clientId || undefined,
      invoice_number: invoiceNumber.trim() || undefined,
      client_name: clientName.trim(),
      client_company: clientCompany.trim() || undefined,
      client_email: clientEmail.trim() || undefined,
      client_phone: clientPhone.trim() || undefined,
      client_address: billingAddress.trim() || undefined,
      shipping_address: shippingAddress.trim() || undefined,
      currency,
      discount_type: discountType,
      discount_value:
        discountType === 'FIXED' ? toMinorUnits(discountValue) : Number(discountValue || 0),
      tax_type: taxType,
      tax_rate: Number(taxRate || 0),
      shipping_amount: isProduct ? toMinorUnits(shipping) : 0,
      handling_amount: isProduct ? toMinorUnits(handling) : 0,
      payment_method: paymentMethod || undefined,
      payment_terms: paymentTerms.trim() || undefined,
      notes: notes.trim() || undefined,
      terms: terms.trim() || undefined,
      issue_date: issueDate || undefined,
      due_date: dueDate || undefined,
      items: items.map((it) => ({
        description: it.description.trim(),
        quantity: parseInt(it.quantity, 10),
        unit: it.unit.trim() || undefined,
        unit_price: toMinorUnits(it.unitPrice),
      })),
    };

    setSubmitting(true);
    try {
      if (mode === 'edit') {
        await invoiceApi.update(token, invoiceId, payload);
        toast.success('Invoice updated.');
        router.push(`/invoices/${invoiceId}`);
      } else {
        const res = await invoiceApi.create(token, payload);
        toast.success('Invoice created.');
        router.push(`/invoices/${res.data.invoiceId}`);
      }
    } catch (e2) {
      if (e2.status === 401) router.replace('/login');
      else if (e2.code === 'DUPLICATE_INVOICE_NUMBER') toast.error('That invoice number is already in use.');
      else toast.error(e2.message || 'Could not save the invoice.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !ready) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── Form column ── */}
      <div className="lg:col-span-2 space-y-6">
        {/* Invoice details */}
        <Card className="space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Invoice Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Invoice Type" value={type} onChange={(e) => setType(e.target.value)}
              options={[{ value: 'SERVICE', label: 'Service' }, { value: 'PRODUCT', label: 'Product' }]} />
            <Input label="Invoice Number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Auto-generated" />
            <Select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
            <div />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Issue Date</label>
              <input type="date" className={inputClass} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Due Date</label>
              <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </Card>

        {/* Business (auto-filled) */}
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">From</h2>
            <Link href="/settings" className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">Edit business profile</Link>
          </div>
          {business && business.business_name ? (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <p className="font-medium text-gray-900 dark:text-white">{business.business_name}</p>
              {business.business_email && <p>{business.business_email}</p>}
              {business.business_phone && <p>{business.business_phone}</p>}
              {business.business_address && <p className="whitespace-pre-line">{business.business_address}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No business details yet. <Link href="/settings" className="text-blue-600 dark:text-blue-400">Add them in Settings</Link> to show them on invoices.
            </p>
          )}
        </Card>

        {/* Client */}
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Bill To</h2>
          {clients.length > 0 && (
            <Select
              label="Select a saved client (optional)"
              value={clientId}
              onChange={(e) => selectClient(e.target.value)}
              options={[{ value: '', label: 'Enter manually…' }, ...clients.map((c) => ({ value: c.id, label: c.company_name ? `${c.client_name} — ${c.company_name}` : c.client_name }))]}
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Client Name" value={clientName} onChange={(e) => { setClientName(e.target.value); setClientId(''); }} required />
            <Input label="Company" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} />
            <Input label="Email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
            <Input label="Phone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
          </div>
          <Textarea label="Billing Address" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} rows={2} />
          {type === 'PRODUCT' && (
            <Textarea label="Shipping Address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} rows={2} />
          )}
        </Card>

        {/* Items */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Items</h2>
            <button type="button" onClick={addItem} className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">+ Add item</button>
          </div>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start border-b border-gray-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0">
                <div className="col-span-12 sm:col-span-5">
                  <input className={inputClass} placeholder="Description" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <input type="number" min="1" step="1" className={inputClass} placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <input className={inputClass} placeholder="Unit" value={item.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input type="number" min="0" step="0.01" className={inputClass} placeholder={`Price`} value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', e.target.value)} />
                </div>
                <div className="col-span-2 sm:col-span-1 flex justify-end pt-2">
                  <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1} className="text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed" title="Remove">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Pricing & Tax */}
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Pricing &amp; Tax</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Discount Type" value={discountType} onChange={(e) => setDiscountType(e.target.value)}
              options={[{ value: 'NONE', label: 'No discount' }, { value: 'PERCENTAGE', label: 'Percentage (%)' }, { value: 'FIXED', label: `Fixed (${currency})` }]} />
            <Input label={discountType === 'PERCENTAGE' ? 'Discount %' : `Discount (${currency})`} type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} disabled={discountType === 'NONE'} />
            <Select label="Tax Type" value={taxType} onChange={(e) => setTaxType(e.target.value)}
              options={[{ value: 'NONE', label: 'No tax' }, { value: 'GST', label: 'GST' }, { value: 'VAT', label: 'VAT' }, { value: 'SALES', label: 'Sales Tax' }, { value: 'CUSTOM', label: 'Custom' }]} />
            <Input label="Tax Rate %" type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} disabled={taxType === 'NONE'} />
            {isProduct && (
              <>
                <Input label={`Shipping (${currency})`} type="number" min="0" step="0.01" value={shipping} onChange={(e) => setShipping(e.target.value)} />
                <Input label={`Handling (${currency})`} type="number" min="0" step="0.01" value={handling} onChange={(e) => setHandling(e.target.value)} />
              </>
            )}
          </div>
        </Card>

        {/* Payment */}
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Payment</h2>
          {enabledMethods.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No payment methods enabled.{' '}
              <Link href="/settings" className="text-blue-600 dark:text-blue-400">Enable methods in Payment Settings</Link>.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Payment Method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={[{ value: '', label: 'Not specified' }, ...enabledMethods]}
              />
              <Input label="Payment Terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. Net 15" />
            </div>
          )}

          {/* Read-only preview of the saved details that will be attached */}
          {paymentMethod === 'BANK_TRANSFER' && paySettings && (
            <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-3 text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
              <p className="font-medium text-gray-700 dark:text-gray-200">Saved bank details (attached automatically):</p>
              <p>{paySettings.bank_name || '—'} · {paySettings.account_holder_name || '—'}</p>
              <p>A/C: {paySettings.account_number || '—'} · {paySettings.ifsc_swift_code || '—'}</p>
              <Link href="/settings" className="text-blue-600 dark:text-blue-400">Edit in Payment Settings</Link>
            </div>
          )}
          {paymentMethod === 'UPI' && paySettings && (
            <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-3 text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
              <p className="font-medium text-gray-700 dark:text-gray-200">Saved UPI details (attached automatically):</p>
              <p>{paySettings.upi_id || '—'}{paySettings.upi_merchant_name ? ` · ${paySettings.upi_merchant_name}` : ''}</p>
              <Link href="/settings" className="text-blue-600 dark:text-blue-400">Edit in Payment Settings</Link>
            </div>
          )}
          {paymentMethod === 'ONLINE' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              The customer will get a secure &quot;Pay Now&quot; link in the invoice email (Stripe).
            </p>
          )}
        </Card>

        {/* Notes & Terms */}
        <Card className="space-y-4">
          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Thank you for your business." />
          <Textarea label="Terms & Conditions" value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} placeholder="Late payments may incur additional charges." />
        </Card>
      </div>

      {/* ── Live summary ── */}
      <div className="lg:col-span-1">
        <div className="lg:sticky lg:top-4 space-y-4">
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Summary</h2>
              <Badge status={initial?.status || 'DRAFT'} />
            </div>

            <div className="space-y-2 text-sm border-t border-gray-100 dark:border-slate-800 pt-3">
              <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
              {totals.discountAmount > 0 && <Row label="Discount" value={`-${formatMoney(totals.discountAmount, currency)}`} />}
              {totals.taxAmount > 0 && <Row label={taxType !== 'NONE' ? `${taxType} (${taxRate || 0}%)` : 'Tax'} value={formatMoney(totals.taxAmount, currency)} />}
              {toMinorUnits(shipping) > 0 && <Row label="Shipping" value={formatMoney(toMinorUnits(shipping), currency)} />}
              {toMinorUnits(handling) > 0 && <Row label="Handling" value={formatMoney(toMinorUnits(handling), currency)} />}
            </div>

            <div className="flex justify-between font-semibold text-gray-900 dark:text-white text-base border-t border-gray-100 dark:border-slate-800 pt-3">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(totals.total, currency)}</span>
            </div>

            <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1 border-t border-gray-100 dark:border-slate-800 pt-3">
              <div className="flex justify-between"><span>Due date</span><span>{dueDate || '—'}</span></div>
              <div className="flex justify-between"><span>Method</span><span>{paymentMethod ? paymentMethod.replace('_', ' ') : '—'}</span></div>
            </div>

            <div className="space-y-2 pt-2">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <span className="flex items-center gap-2 justify-center"><Spinner size={16} /> Saving…</span> : mode === 'edit' ? 'Save Changes' : 'Save Draft'}
              </Button>
              <Button type="button" variant="secondary" className="w-full" onClick={() => setShowPreview(true)}>
                Preview Invoice
              </Button>
              <Link href={mode === 'edit' ? `/invoices/${invoiceId}` : '/invoices'}>
                <Button type="button" variant="secondary" className="w-full">Cancel</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </form>

    <Modal
      open={showPreview}
      onClose={() => setShowPreview(false)}
      title="Invoice Preview"
      size="3xl"
      footer={<Button type="button" onClick={() => setShowPreview(false)}>Close</Button>}
    >
      <div className="-mx-2">
        <InvoicePreview {...previewData} />
      </div>
    </Modal>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-gray-500 dark:text-gray-400">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
