'use client';

import { INVOICE_TYPE_LABELS, INVOICE_TYPES, type InvoiceSummary } from '@toolshop/shared';
import { Badge } from '@toolshop/ui';
import Link from 'next/link';
import { DataTable, Pager, TableCard } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { useUrlList } from '@/components/admin/query';
import { date, faNumber, price } from '@/lib/format';
import { FilterBar } from '@/components/admin/filter-bar';
import { Suspense } from 'react';

function AdminInvoicesPageContent() {
  const list = useUrlList<InvoiceSummary>('/admin/invoices');
  const open = (invoice: InvoiceSummary) =>
    window.open(`/print/invoice/${invoice.id}?scope=admin`, '_blank', 'noopener');

  return (
    <>
      <PageHeader
        title="فاکتورها و اسناد"
        description="فاکتور فروش هنگام تأیید پرداخت و اعلامیه برگشت هنگام بازپرداخت به‌صورت خودکار صادر می‌شود."
      />
      <TableCard
        toolbar={
          <FilterBar
            list={list}
            searchPlaceholder="شماره فاکتور یا سفارش، نام خانوادگی"
            dateLabel="تاریخ صدور"
            inline={[
              {
                type: 'select',
                key: 'type',
                label: 'نوع سند',
                allLabel: 'همه اسناد',
                options: INVOICE_TYPES.map((t) => ({ value: t, label: INVOICE_TYPE_LABELS[t] })),
              },
            ]}
          />
        }
      >
        <DataTable
          rows={list.data?.items}
          loading={list.isLoading}
          rowKey={(i) => i.id}
          onRowClick={open}
          empty="سندی یافت نشد."
          columns={[
            {
              header: 'شماره',
              cell: (i) => <span className="text-info font-bold">{faNumber(i.invoiceNumber)}</span>,
            },
            {
              header: 'نوع',
              cell: (i) => (
                <Badge variant={i.type === 'sale' ? 'info' : 'warning'}>
                  {INVOICE_TYPE_LABELS[i.type]}
                </Badge>
              ),
            },
            {
              header: 'سفارش',
              cell: (i) => (
                <Link
                  href={`/admin/orders/${i.orderId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-info"
                >
                  {faNumber(i.orderNumber)}
                </Link>
              ),
            },
            { header: 'خریدار', cell: (i) => i.buyerName },
            {
              header: 'مبلغ',
              cell: (i) => <span className="font-semibold">{price(i.total)}</span>,
            },
            {
              header: 'تاریخ صدور',
              cell: (i) => (
                <span className="text-muted-foreground text-xs">{date(i.issuedAt)}</span>
              ),
            },
          ]}
        />
        <Pager data={list.data} onPage={list.setPage} />
      </TableCard>
    </>
  );
}

export default function AdminInvoicesPage() {
  return (
    <Suspense>
      <AdminInvoicesPageContent />
    </Suspense>
  );
}
