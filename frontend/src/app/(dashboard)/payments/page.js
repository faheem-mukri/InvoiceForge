'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { paymentApi } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';

import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';

function IconPayments() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function PaymentStatusBadge({ status }) {
  const map = {
    SUCCESS: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 ring-green-200 dark:ring-green-800',
    PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 ring-amber-200 dark:ring-amber-800',
    FAILED: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 ring-red-200 dark:ring-red-800',
  };
  const cls = map[status] || map.PENDING;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
}

export default function PaymentsPage() {
  const { token, loading: authLoading } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const res = await paymentApi.history(token);
        setPayments(res.data.payments || []);
      } catch (err) {
        if (err.status === 401) router.replace('/login');
        else toast.error(err.message || 'Could not load payments.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, token]);

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="A record of payments against your invoices." />

      {loading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : payments.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconPayments />}
            title="No payments yet"
            description="Payments appear here once invoices are paid online or marked as paid."
          />
        </Card>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-800">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Invoice</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Client</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3 hidden sm:table-cell">Method</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {payments.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer"
                  onClick={() => router.push(`/invoices/${p.invoice_id}`)}
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-500 dark:text-gray-400">{p.invoice_number}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{p.client_name}</td>
                  <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                    {(p.method || p.provider || '').replace('_', ' ')}
                  </td>
                  <td className="px-5 py-3.5"><PaymentStatusBadge status={p.status} /></td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatMoney(p.amount, p.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
