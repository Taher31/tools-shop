'use client';

import { INVOICE_TYPE_LABELS, INVOICE_TYPES, type InvoiceSummary } from '@toolshop/shared';
import { Badge, NativeSelect } from '@toolshop/ui';
import Link from 'next/link';
import { DataTable, Pager, SearchInput, TableCard } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminList } from '@/components/admin/query';
import { date, faNumber, price } from '@/lib/format';

export default function AdminInvoicesPage() {
  const list = useAdminList<InvoiceSummary>('/admin/invoices');
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
          <>
            <SearchInput
              onSearch={list.setSearch}
              placeholder="شماره فاکتور یا سفارش، نام خانوادگی"
              className="w-72"
            />
            <NativeSelect
              className="h-9 w-48"
              value={(list.params.type as string | undefined) ?? ''}
              onChange={(e) => list.update({ type: e.target.value || undefined })}
              aria-label="نوع سند"
            >
              <option value="">همه اسناد</option>
              {INVOICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {INVOICE_TYPE_LABELS[type]}
                </option>
              ))}
            </NativeSelect>
          </>
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
