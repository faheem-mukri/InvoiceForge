'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { invoiceApi } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';

import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Tabs from '@/components/ui/Tabs';
import Pagination from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';

const FILTERS = ['ALL', 'DRAFT', 'SENT', 'PAID', 'OVERDUE'];

function IconInvoice() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="12" y2="17" />
    </svg>
  );
}

export default function InvoicesPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 10 };
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await invoiceApi.list(token, params);
      setInvoices(res.data?.invoices || []);
      setPagination(res.data?.pagination || null);
    } catch (err) {
      if (err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err.message || 'Could not load invoices.');
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    load();
  }, [authLoading, token, load, router]);

  function changeFilter(next) {
    setPage(1);
    setStatusFilter(next);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Manage and track all your invoices."
        action={
          <Link href="/invoices/new">
            <Button>
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Invoice
              </span>
            </Button>
          </Link>
        }
      />

      {/* Filters */}
      <Tabs
        tabs={FILTERS.map((f) => ({
          value: f,
          label: f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase(),
        }))}
        value={statusFilter}
        onChange={changeFilter}
      />

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <SkeletonTable rows={6} columns={6} />
      ) : invoices.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
          <EmptyState
            icon={<IconInvoice />}
            title="No invoices found"
            description={
              statusFilter === 'ALL'
                ? 'Create your first invoice to start tracking payments.'
                : `You have no ${statusFilter.toLowerCase()} invoices.`
            }
            action={{ label: 'Create Invoice', href: '/invoices/new' }}
          />
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800">
                  <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3">Invoice</th>
                  <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3">Client</th>
                  <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3 hidden md:table-cell">Type</th>
                  <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3 hidden sm:table-cell">Due Date</th>
                  <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                  >
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-500 dark:text-gray-400">{inv.invoice_number}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{inv.client_name}</td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 hidden md:table-cell capitalize">{String(inv.type || '').toLowerCase()}</td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{formatDate(inv.due_date)}</td>
                    <td className="px-5 py-3.5"><Badge status={inv.status} /></td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900 dark:text-white tabular-nums">{formatMoney(inv.total_amount, inv.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
