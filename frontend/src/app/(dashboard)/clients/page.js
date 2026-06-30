'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { clientApi } from '@/lib/api';

import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';

const EMPTY = {
  client_name: '',
  company_name: '',
  email: '',
  phone: '',
  billing_address: '',
  shipping_address: '',
  notes: '',
};

function IconClients() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );
}

export default function ClientsPage() {
  const { token, loading: authLoading } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
        const res = await clientApi.list(token, q ? { q } : {});
        setClients(res.data.clients || []);
      } catch (err) {
        if (err.status === 401) router.replace('/login');
        else toast.error(err.message || 'Could not load clients.');
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
  }, [authLoading, token, load, router]);

  function openNew() {
    setForm(EMPTY);
    setEditing({});
  }

  function openEdit(client) {
    setForm({
      client_name: client.client_name || '',
      company_name: client.company_name || '',
      email: client.email || '',
      phone: client.phone || '',
      billing_address: client.billing_address || '',
      shipping_address: client.shipping_address || '',
      notes: client.notes || '',
    });
    setEditing(client);
  }

  async function save(e) {
    e.preventDefault();
    if (!form.client_name.trim()) {
      toast.error('Client name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editing && editing.id) {
        await clientApi.update(token, editing.id, form);
        toast.success('Client updated.');
      } else {
        await clientApi.create(token, form);
        toast.success('Client created.');
      }
      setEditing(null);
      load(search);
    } catch (err) {
      toast.error(err.message || 'Could not save client.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await clientApi.remove(token, deleteTarget.id);
      toast.success('Client deleted.');
      setDeleteTarget(null);
      load(search);
    } catch (err) {
      toast.error(err.message || 'Could not delete client.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Manage the people and companies you invoice."
        action={<Button onClick={openNew}>New Client</Button>}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(search);
        }}
        className="flex gap-2"
      >
        <Input
          placeholder="Search by name, company, or email…"
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
      ) : clients.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconClients />}
            title="No clients yet"
            description="Add a client to reuse their details when creating invoices."
          />
          <div className="flex justify-center pb-6">
            <Button onClick={openNew}>New Client</Button>
          </div>
        </Card>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-800">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Name</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3 hidden sm:table-cell">Company</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3 hidden md:table-cell">Email</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{c.client_name}</td>
                  <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{c.company_name || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 hidden md:table-cell">{c.email || '—'}</td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(c)} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 mr-4">Edit</button>
                    <button onClick={() => setDeleteTarget(c)} className="text-sm text-red-600 hover:text-red-700 dark:text-red-400">Delete</button>
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
        title={editing && editing.id ? 'Edit Client' : 'New Client'}
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
            <Input label="Client Name" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} required />
            <Input label="Company" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Textarea label="Billing Address" value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} rows={2} />
          <Textarea label="Shipping Address" value={form.shipping_address} onChange={(e) => setForm({ ...form, shipping_address: e.target.value })} rows={2} />
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete client?"
        description={`This removes ${deleteTarget?.client_name || 'this client'} from your directory. Existing invoices keep their details.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
