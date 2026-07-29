'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { productApi, businessApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';

import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'];

const EMPTY = {
  name: '',
  description: '',
  sku: '',
  type: 'SERVICE',
  unit: '',
  unitPrice: '',
  currency: 'USD',
  taxRate: '',
  isActive: true,
};

// Money is stored in minor units (cents) on the server.
function toMinor(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
function fromMinor(cents) {
  if (cents == null) return '';
  return (cents / 100).toString();
}

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

export default function ProductsPage() {
  const { token, loading: authLoading } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');

  const [editing, setEditing] = useState(null); // null = closed; {} = new; {...} = edit
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (q) => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await productApi.list(token, q ? { q } : {});
        setProducts(res.data || []);
      } catch (err) {
        if (err.status === 401) router.replace('/login');
        else toast.error(err.message || 'Could not load products.');
      } finally {
        setLoading(false);
      }
    },
    [token, router, toast]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    load();
    // Default new products to the business currency.
    businessApi
      .get(token)
      .then((res) => setDefaultCurrency(res.data?.default_currency || 'USD'))
      .catch(() => {});
  }, [authLoading, token, load, router]);

  function openNew() {
    setForm({ ...EMPTY, currency: defaultCurrency });
    setEditing({});
  }

  function openEdit(p) {
    setForm({
      name: p.name || '',
      description: p.description || '',
      sku: p.sku || '',
      type: p.type || 'SERVICE',
      unit: p.unit || '',
      unitPrice: fromMinor(p.unit_price),
      currency: p.currency || 'USD',
      taxRate: p.tax_rate ? String(p.tax_rate) : '',
      isActive: p.is_active !== false,
    });
    setEditing(p);
  }

  async function save(e) {
    if (e) e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Product name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        sku: form.sku,
        type: form.type,
        unit: form.unit,
        unitPrice: toMinor(form.unitPrice || 0),
        currency: form.currency,
        taxRate: Number(form.taxRate || 0),
        isActive: form.isActive,
      };
      if (editing && editing.id) {
        await productApi.update(token, editing.id, payload);
        toast.success('Product updated.');
      } else {
        await productApi.create(token, payload);
        toast.success('Product created.');
      }
      setEditing(null);
      load(search);
    } catch (err) {
      toast.error(err.message || 'Could not save product.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await productApi.remove(token, deleteTarget.id);
      toast.success('Product deleted.');
      setDeleteTarget(null);
      load(search);
    } catch (err) {
      toast.error(err.message || 'Could not delete product.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Services"
        description="Save the items you invoice often, then add them to any invoice in one click."
        action={<Button onClick={openNew}>New Item</Button>}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(search);
        }}
        className="flex gap-2"
      >
        <Input
          placeholder="Search by name, SKU, or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size={24} />
        </div>
      ) : products.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconBox />}
            title="No products or services yet"
            description="Add the items you bill for and they'll be one click away when you build an invoice."
          />
          <div className="flex justify-center pb-6">
            <Button onClick={openNew}>New Item</Button>
          </div>
        </Card>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-800">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Name</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3 hidden sm:table-cell">Type</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3 hidden md:table-cell">SKU</th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Price</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                    {p.is_active === false && (
                      <span className="ml-2 text-xs text-gray-400">(inactive)</span>
                    )}
                    {p.description && (
                      <p className="text-xs text-gray-400 truncate max-w-xs">{p.description}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                    {p.type === 'PRODUCT' ? 'Product' : 'Service'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 hidden md:table-cell">{p.sku || '—'}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                    {formatMoney(p.unit_price, p.currency)}
                    {p.unit ? <span className="text-gray-400"> / {p.unit}</span> : null}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(p)} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 mr-4">Edit</button>
                    <button onClick={() => setDeleteTarget(p)} className="text-sm text-red-600 hover:text-red-700 dark:text-red-400">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / edit modal */}
      <Modal
        open={editing !== null}
        onClose={() => (saving ? null : setEditing(null))}
        title={editing && editing.id ? 'Edit Item' : 'New Item'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Spinner size={16} /> : 'Save'}
            </Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={[{ value: 'SERVICE', label: 'Service' }, { value: 'PRODUCT', label: 'Product' }]}
            />
            <Input label="SKU / Code" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Optional" />
            <Input label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. hrs, pcs" />
            <Input label="Unit Price" type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
            <Select
              label="Currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
            <Input label="Default Tax Rate %" type="number" min="0" step="0.01" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} placeholder="0" />
          </div>
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Appears as the line item description on invoices." />

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-gray-300 dark:border-slate-700"
            />
            Active (show when picking items on an invoice)
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete item?"
        description={`This removes ${deleteTarget?.name || 'this item'} from your catalog. Existing invoices keep their line items.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
