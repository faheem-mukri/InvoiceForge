'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { invoiceApi } from '@/lib/api';

import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import InvoiceEditor from '@/components/invoice/InvoiceEditor';

export default function EditInvoicePage() {
  const { token, loading: authLoading } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const params = useParams();
  const invoiceId = params?.invoiceId;

  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const res = await invoiceApi.get(token, invoiceId);
        const invoice = res.data.invoice;
        if (invoice.status !== 'DRAFT') {
          setError('Only draft invoices can be edited.');
          return;
        }
        setInitial({ ...invoice, items: res.data.items });
      } catch (err) {
        if (err.status === 401) router.replace('/login');
        else setError(err.message || 'Could not load invoice.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, token, invoiceId]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Alert variant="error">{error}</Alert>
        <Button variant="secondary" onClick={() => router.push(`/invoices/${invoiceId}`)}>
          Back to invoice
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Invoice" description={initial?.invoice_number} />
      <InvoiceEditor mode="edit" invoiceId={invoiceId} initial={initial} />
    </div>
  );
}
