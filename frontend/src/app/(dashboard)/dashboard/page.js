'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { dashboardApi } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';

import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import { SkeletonCards, SkeletonTable } from '@/components/ui/Skeleton';

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconRevenue() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function IconPaid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconPending() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconOverdue() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);

  // One-shot "welcome back" banner after a scheduled deletion was cancelled.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('accountRestored') === '1') {
      setRestored(true);
      sessionStorage.removeItem('accountRestored');
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      router.replace('/login');
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await dashboardApi.get(token);
        if (cancelled) return;

        const d = res.data;
        const currency = d.recentInvoices?.[0]?.currency || 'USD';

        setStats({
          totalRevenue: d.revenue.totalBilled,
          paid: d.revenue.collected,
          pending: d.revenue.outstanding,
          overdue: d.revenue.overdue,
          currency,
        });

        setInvoices(d.recentInvoices || []);
      } catch (err) {
        if (cancelled) return;
        if (err.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err.message || 'Could not load dashboard data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="space-y-8">
        <SkeletonCards count={4} />
        <SkeletonTable rows={5} columns={5} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        description="Here's what's happening with your invoices."
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

      {error && <Alert variant="error">{error}</Alert>}

      {restored && (
        <Alert variant="success">
          Welcome back — your account was scheduled for deletion, but logging in cancelled it. Everything has been restored.
        </Alert>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Total Billed"
            value={formatMoney(stats.totalRevenue, stats.currency)}
            icon={<IconRevenue />}
            trend="All invoices"
            variant="default"
          />
          <StatCard
            title="Paid"
            value={formatMoney(stats.paid, stats.currency)}
            icon={<IconPaid />}
            trend="Collected"
            variant="success"
          />
          <StatCard
            title="Pending"
            value={formatMoney(stats.pending, stats.currency)}
            icon={<IconPending />}
            trend="Awaiting payment"
            variant="warning"
          />
          <StatCard
            title="Overdue"
            value={formatMoney(stats.overdue, stats.currency)}
            icon={<IconOverdue />}
            trend="Past due date"
            variant="danger"
          />
        </div>
      )}

      {/* Recent Invoices */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Recent Invoices
          </h2>
          <Link
            href="/invoices"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
          >
            View all →
          </Link>
        </div>

        {invoices.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <EmptyState
              icon={<IconInvoice />}
              title="No invoices yet"
              description="Create your first invoice to start tracking payments."
              action={{ label: 'Create Invoice', href: '/invoices/new' }}
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800">
                  <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3">
                    Invoice
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3">
                    Client
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3 hidden sm:table-cell">
                    Due Date
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3">
                    Status
                  </th>
                  <th className="text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                  >
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {inv.invoice_number}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">
                      {inv.client_name}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      {formatDate(inv.due_date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge status={inv.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900 dark:text-white tabular-nums">
                      {formatMoney(inv.total_amount, inv.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
