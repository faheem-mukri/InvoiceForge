'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { invoiceApi } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';

import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Skeleton, { SkeletonText } from '@/components/ui/Skeleton';

export default function InvoiceDetailPage() {
  const { token, loading: authLoading } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const params = useParams();
  const invoiceId = params?.invoiceId;

  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [acting, setActing] = useState(null); // 'send' | 'paid' | 'pdf' | 'pay' | 'duplicate'
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!token || !invoiceId) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await invoiceApi.get(token, invoiceId);
      setInvoice(res.data?.invoice || null);
      setItems(res.data?.items || []);
    } catch (err) {
      if (err.status === 401) {
        router.replace('/login');
        return;
      }
      setLoadError(err.message || 'Could not load invoice.');
    } finally {
      setLoading(false);
    }
  }, [token, invoiceId, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    load();
  }, [authLoading, token, load, router]);

  // Surface the result of a returning Stripe Checkout redirect (?paid / ?canceled).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('paid') === '1') {
      toast.success('Payment received. The status will update shortly.');
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copyPaymentLink() {
    const url = `${window.location.origin}/pay/${invoiceId}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Payment link copied to clipboard.'))
      .catch(() => toast.info(url));
  }

  function describeEmailResult(data, fallbackSuccess) {
    if (data?.emailed) {
      toast.success(fallbackSuccess);
      return;
    }
    const reason = data?.emailReason;
    if (reason === 'NO_RECIPIENT') {
      toast.info('Done. Add a client email to deliver it automatically, or share the payment link.');
    } else if (reason === 'SMTP_NOT_CONFIGURED') {
      toast.info('Done. Email is not configured on the server — share the payment link instead.');
    } else if (reason) {
      toast.error(`Saved, but the email could not be delivered: ${reason}`);
    } else {
      toast.success(fallbackSuccess);
    }
  }

  async function handleSend() {
    setActing('send');
    try {
      const res = await invoiceApi.send(token, invoiceId);
      describeEmailResult(res.data, 'Invoice sent and emailed to the client.');
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not send invoice.');
    } finally {
      setActing(null);
    }
  }

  async function handleMarkPaid() {
    setActing('paid');
    try {
      await invoiceApi.markPaid(token, invoiceId);
      toast.success('Invoice marked as paid.');
      setConfirmPaid(false);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not mark invoice as paid.');
    } finally {
      setActing(null);
    }
  }

  async function handleDownloadPdf() {
    setActing('pdf');
    try {
      const blob = await invoiceApi.pdf(token, invoiceId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      toast.error(err.message || 'Could not generate PDF.');
    } finally {
      setActing(null);
    }
  }

  async function handleResend() {
    setActing('resend');
    try {
      const res = await invoiceApi.resend(token, invoiceId);
      describeEmailResult(res.data, 'Invoice resent to the client.');
    } catch (err) {
      toast.error(err.message || 'Could not resend invoice.');
    } finally {
      setActing(null);
    }
  }

  async function handleDuplicate() {
    setActing('duplicate');
    try {
      const res = await invoiceApi.duplicate(token, invoiceId);
      toast.success('Invoice duplicated.');
      router.push(`/invoices/${res.data.invoiceId}`);
    } catch (err) {
      toast.error(err.message || 'Could not duplicate invoice.');
      setActing(null);
    }
  }

  async function handleDelete() {
    setActing('delete');
    try {
      await invoiceApi.remove(token, invoiceId);
      toast.success('Invoice deleted.');
      router.push('/invoices');
    } catch (err) {
      toast.error(err.message || 'Could not delete invoice.');
      setActing(null);
      setConfirmDelete(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Card className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <SkeletonText lines={3} />
            <SkeletonText lines={3} />
          </div>
          <SkeletonText lines={4} />
        </Card>
      </div>
    );
  }

  if (loadError && !invoice) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Alert variant="error">{loadError}</Alert>
        <Link href="/invoices">
          <Button variant="secondary">Back to invoices</Button>
        </Link>
      </div>
    );
  }

  if (!invoice) return null;

  const status = invoice.status;
  const canSend = status === 'DRAFT';
  const canEdit = status === 'DRAFT';
  const canMarkPaid = status === 'SENT' || status === 'OVERDUE';
  const canDownload = status === 'SENT' || status === 'PAID';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/invoices"
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            ← Back to invoices
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
              {invoice.invoice_number}
            </h1>
            <Badge status={status} />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 capitalize">
            {String(invoice.type || '').toLowerCase()} invoice
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          {canEdit && (
            <Link href={`/invoices/${invoiceId}/edit`}>
              <Button variant="secondary" disabled={acting !== null}>Edit</Button>
            </Link>
          )}
          {canSend && (
            <Button onClick={handleSend} disabled={acting !== null}>
              {acting === 'send' ? (
                <span className="flex items-center gap-2">
                  <Spinner size={16} /> Sending…
                </span>
              ) : (
                'Send Invoice'
              )}
            </Button>
          )}
          {(status === 'SENT' || status === 'OVERDUE') && (
            <Button variant="secondary" onClick={handleResend} disabled={acting !== null}>
              {acting === 'resend' ? (
                <span className="flex items-center gap-2"><Spinner size={16} /> Resending…</span>
              ) : (
                'Resend'
              )}
            </Button>
          )}
          {canMarkPaid && (
            <Button
              variant="secondary"
              onClick={() => setConfirmPaid(true)}
              disabled={acting !== null}
            >
              Mark as Paid
            </Button>
          )}
          {canDownload && (
            <Button variant="secondary" onClick={handleDownloadPdf} disabled={acting !== null}>
              {acting === 'pdf' ? (
                <span className="flex items-center gap-2">
                  <Spinner size={16} /> Preparing…
                </span>
              ) : (
                'Download PDF'
              )}
            </Button>
          )}
          <Button variant="secondary" onClick={handleDuplicate} disabled={acting !== null}>
            {acting === 'duplicate' ? (
              <span className="flex items-center gap-2">
                <Spinner size={16} /> Duplicating…
              </span>
            ) : (
              'Duplicate'
            )}
          </Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={acting !== null}>
            Delete
          </Button>
        </div>
      </div>

      {/* Meta + client */}
      <Card className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
              Bill To
            </h2>
            <p className="font-medium text-gray-900 dark:text-white">{invoice.client_name}</p>
            {invoice.client_email && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{invoice.client_email}</p>
            )}
            {invoice.client_address && (
              <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line">
                {invoice.client_address}
              </p>
            )}
          </div>

          <div className="sm:text-right space-y-1 text-sm">
            <div className="flex sm:justify-end gap-2">
              <span className="text-gray-400 dark:text-gray-500">Issued:</span>
              <span className="text-gray-700 dark:text-gray-300">{formatDate(invoice.issue_date)}</span>
            </div>
            <div className="flex sm:justify-end gap-2">
              <span className="text-gray-400 dark:text-gray-500">Due:</span>
              <span className="text-gray-700 dark:text-gray-300">{formatDate(invoice.due_date)}</span>
            </div>
            {invoice.paid_at && (
              <div className="flex sm:justify-end gap-2">
                <span className="text-gray-400 dark:text-gray-500">Paid:</span>
                <span className="text-gray-700 dark:text-gray-300">{formatDate(invoice.paid_at)}</span>
              </div>
            )}
            {invoice.payment_method && (
              <div className="flex sm:justify-end gap-2">
                <span className="text-gray-400 dark:text-gray-500">Method:</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {invoice.payment_method.replace('_', ' ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="border-t border-gray-100 dark:border-slate-800 pt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Unit Price</th>
                <th className="text-right py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 text-gray-900 dark:text-white">{item.description}</td>
                  <td className="py-2.5 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="py-2.5 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                    {formatMoney(item.unit_price, invoice.currency)}
                  </td>
                  <td className="py-2.5 text-right text-gray-900 dark:text-white tabular-nums">
                    {formatMoney(item.total_price, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatMoney(invoice.subtotal, invoice.currency)}</span>
          </div>
          {invoice.tax_amount > 0 && (
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>Tax</span>
              <span className="tabular-nums">{formatMoney(invoice.tax_amount, invoice.currency)}</span>
            </div>
          )}
          {invoice.discount_amount > 0 && (
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>Discount</span>
              <span className="tabular-nums">
                -{formatMoney(invoice.discount_amount, invoice.currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-gray-900 dark:text-white text-base pt-2">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(invoice.total_amount, invoice.currency)}</span>
          </div>
        </div>

        {/* Payment details snapshot */}
        {invoice.payment_details && Object.values(invoice.payment_details).some(Boolean) && (
          <div className="border-t border-gray-100 dark:border-slate-800 pt-4 text-sm">
            <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
              Payment Details
            </h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-0.5">
              {invoice.payment_details.upi_id !== undefined ? (
                <>
                  {invoice.payment_details.upi_id && <p>UPI ID: {invoice.payment_details.upi_id}</p>}
                  {invoice.payment_details.upi_merchant_name && <p>Merchant: {invoice.payment_details.upi_merchant_name}</p>}
                </>
              ) : (
                <>
                  {invoice.payment_details.bank_name && <p>Bank: {invoice.payment_details.bank_name}</p>}
                  {invoice.payment_details.account_holder_name && <p>Account Holder: {invoice.payment_details.account_holder_name}</p>}
                  {invoice.payment_details.account_number && <p>Account Number: {invoice.payment_details.account_number}</p>}
                  {invoice.payment_details.ifsc_swift_code && <p>IFSC/SWIFT: {invoice.payment_details.ifsc_swift_code}</p>}
                </>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Confirm: mark as paid */}
      <ConfirmDialog
        open={confirmPaid}
        onClose={() => setConfirmPaid(false)}
        onConfirm={handleMarkPaid}
        title="Mark invoice as paid?"
        description={
          <>
            This records a manual payment of{' '}
            <strong className="text-gray-900 dark:text-white">
              {formatMoney(invoice.total_amount, invoice.currency)}
            </strong>{' '}
            for {invoice.invoice_number}. This can&apos;t be undone.
          </>
        }
        confirmLabel="Mark as Paid"
        loading={acting === 'paid'}
      />

      {/* Confirm: delete */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete invoice?"
        description={`Invoice ${invoice.invoice_number} will be removed from your list. This can't be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={acting === 'delete'}
      />
    </div>
  );
}
