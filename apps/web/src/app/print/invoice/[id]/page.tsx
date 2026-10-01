'use client';

import { useQuery } from '@tanstack/react-query';
import type { InvoiceView } from '@toolshop/shared';
import { Alert, Skeleton } from '@toolshop/ui';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { InvoiceDocument } from '@/components/documents/invoice-document';
import { PrintShell } from '@/components/documents/print-shell';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';

function InvoicePrint() {
  const { id } = useParams<{ id: string }>();
  const admin = useSearchParams().get('scope') === 'admin';
  const invoice = useQuery({
    queryKey: ['invoice', admin ? 'admin' : 'account', id],
    queryFn: () =>
      api.get<InvoiceView>(admin ? `/admin/invoices/${id}` : `/account/invoices/${id}`),
    retry: false,
  });
  return (
    <PrintShell>
      {invoice.isError ? (
        <Alert variant="destructive">{errorMessage(invoice.error)}</Alert>
      ) : invoice.data ? (
        <InvoiceDocument invoice={invoice.data} />
      ) : (
        <Skeleton className="h-[200mm]" />
      )}
    </PrintShell>
  );
}

export default function InvoicePrintPage() {
  return (
    <Suspense>
      <InvoicePrint />
    </Suspense>
  );
}
