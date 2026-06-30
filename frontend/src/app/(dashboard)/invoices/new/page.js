'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/ui/PageHeader';
import InvoiceEditor from '@/components/invoice/InvoiceEditor';

export default function NewInvoicePage() {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) router.replace('/login');
  }, [loading, token, router]);

  return (
    <div className="space-y-6">
      <PageHeader title="Create Invoice" description="Build a professional invoice in under two minutes." />
      <InvoiceEditor mode="create" />
    </div>
  );
}
