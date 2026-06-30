'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { FileText, Sun, Moon, ArrowLeft, Plus, Trash2 } from 'lucide-react';

import { guestApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';

import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import InvoicePreview from '@/components/invoice/InvoicePreview';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'];

function toMinorUnits(value) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

const fieldClass =
  'w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all';

export default function GuestInvoicePage() {
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();

  const [type, setType] = useState('PRODUCT');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [taxInput, setTaxInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [items, setItems] = useState([{ description: '', quantity: '1', unitPrice: '' }]);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { subtotalCents, taxCents, discountCents, totalCents } = useMemo(() => {
    const subtotal = items.reduce((acc, item) => {
      const qty = parseInt(item.quantity, 10) || 0;
      return acc + qty * toMinorUnits(item.unitPrice);
    }, 0);
    const tax = toMinorUnits(taxInput);
    const discount = toMinorUnits(discountInput);
    return {
      subtotalCents: subtotal,
      taxCents: tax,
      discountCents: discount,
      totalCents: Math.max(0, subtotal + tax - discount),
    };
  }, [items, taxInput, discountInput]);

  const previewData = useMemo(() => ({
    business: null,
    meta: { invoiceNumber: '', type, status: 'DRAFT', issueDate: new Date().toISOString() },
    client: { name: clientName, email: clientEmail, billingAddress: clientAddress },
    items: items.map((it) => {
      const qty = parseInt(it.quantity, 10) || 0;
      const unitPriceCents = toMinorUnits(it.unitPrice);
      return {
        description: it.description,
        quantity: it.quantity || '0',
        unitPriceCents,
        lineTotalCents: qty * unitPriceCents,
      };
    }),
    totals: { subtotal: subtotalCents, discountAmount: discountCents, taxAmount: taxCents, shipping: 0, handling: 0, total: totalCents },
    currency,
  }), [type, clientName, clientEmail, clientAddress, items, subtotalCents, discountCents, taxCents, totalCents, currency]);

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }
  function addItem() {
    setItems((prev) => [...prev, { description: '', quantity: '1', unitPrice: '' }]);
  }
  function removeItem(index) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function validate() {
    if (!clientName.trim()) return 'Client name is required.';
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.description.trim()) return `Item ${i + 1}: description is required.`;
      const qty = parseInt(item.quantity, 10);
      if (!Number.isFinite(qty) || qty <= 0) return `Item ${i + 1}: quantity must be greater than 0.`;
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      type,
      client_name: clientName.trim(),
      client_email: clientEmail.trim() || undefined,
      client_address: clientAddress.trim() || undefined,
      currency,
      tax_amount: taxCents,
      discount_amount: discountCents,
      items: items.map((item) => ({
        description: item.description.trim(),
        quantity: parseInt(item.quantity, 10),
        unit_price: toMinorUnits(item.unitPrice),
      })),
    };

    setSubmitting(true);
    try {
      const blob = await guestApi.createInvoice(payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoice.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success('Invoice PDF downloaded.');
    } catch (err) {
      if (err.status === 429) {
        setError('You have generated several invoices recently. Please wait a moment and try again.');
      } else {
        setError(err.message || 'Could not generate the invoice.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 h-16 border-b border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
        <Link href="/" className="flex items-center gap-2" aria-label="InvoiceForge home">
          <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <FileText size={18} />
          </span>
          <span className="font-semibold text-gray-900 dark:text-white">InvoiceForge</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link href="/login" className="hidden sm:inline px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white">
            Sign in
          </Link>
          <Link href="/register" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
            Get Started
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
            <ArrowLeft size={16} /> Back to home
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">Quick Invoice</h1>
          <p className="mt-1.5 text-gray-500 dark:text-gray-400">
            Generate a one-off invoice PDF instantly — no account needed. Nothing is saved.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="space-y-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Invoice Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Invoice Type" value={type} onChange={(e) => setType(e.target.value)}
                options={[{ value: 'PRODUCT', label: 'Product' }, { value: 'SERVICE', label: 'Service' }]} />
              <Select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
            </div>
          </Card>

          <Card className="space-y-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Bill To</h2>
            <Input label="Client Name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Acme Corp" required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Client Email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="billing@acme.com" />
              <Textarea label="Client Address" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} placeholder="123 Market St" rows={2} />
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Line Items</h2>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
                <Plus size={15} /> Add item
              </button>
            </div>

            {/* column labels (desktop) */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-1 text-[11px] font-medium uppercase tracking-wider text-gray-400">
              <span className="col-span-6">Description</span>
              <span className="col-span-2">Qty</span>
              <span className="col-span-3">Unit price</span>
              <span className="col-span-1" />
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 sm:col-span-6">
                    <input className={fieldClass} value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="Description" />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input type="number" min="1" step="1" className={fieldClass} value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} placeholder="Qty" />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <input type="number" min="0" step="0.01" className={fieldClass} value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-center">
                    <button type="button" onClick={() => removeItem(index)} disabled={items.length === 1}
                      className="text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Remove item" aria-label="Remove item">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Totals</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={`Tax (${currency})`} type="number" min="0" step="0.01" value={taxInput} onChange={(e) => setTaxInput(e.target.value)} placeholder="0.00" />
              <Input label={`Discount (${currency})`} type="number" min="0" step="0.01" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} placeholder="0.00" />
            </div>

            <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>Subtotal</span><span className="tabular-nums">{formatMoney(subtotalCents, currency)}</span>
              </div>
              {taxCents > 0 && (
                <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Tax</span><span className="tabular-nums">{formatMoney(taxCents, currency)}</span></div>
              )}
              {discountCents > 0 && (
                <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Discount</span><span className="tabular-nums">-{formatMoney(discountCents, currency)}</span></div>
              )}
              <div className="flex justify-between font-semibold text-gray-900 dark:text-white text-base pt-2 border-t border-gray-100 dark:border-slate-800">
                <span>Total</span><span className="tabular-nums">{formatMoney(totalCents, currency)}</span>
              </div>
            </div>
          </Card>

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setShowPreview(true)}>
              Preview
            </Button>
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? (
                <span className="flex items-center gap-2"><Spinner size={16} /> Generating…</span>
              ) : (
                'Download PDF'
              )}
            </Button>
          </div>
        </form>

        {/* Upsell */}
        <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-900/10 px-6 py-5 text-center">
          <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">Want to track invoices, email clients, and get paid online?</p>
          <Link href="/register" className="mt-2 inline-block text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            Create a free account →
          </Link>
        </div>
      </div>

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
    </div>
  );
}
