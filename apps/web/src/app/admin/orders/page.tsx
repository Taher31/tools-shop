'use client';

import { type AdminOrderSummary, ORDER_STATUS_LABELS, ORDER_STATUSES, type OrderStatus } from '@toolshop/shared';
import { NativeSelect } from '@toolshop/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { DataTable, Pager, SearchInput, TableCard } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminList } from '@/components/admin/query';
import { OrderStatusBadge } from '@/components/common/status-badges';
import { dateTime, faNumber, price } from '@/lib/format';

function OrdersList() {
  const router = useRouter();
  const initialStatus = useSearchParams().get('status') ?? undefined;
  const list = useAdminList<AdminOrderSummary>('/admin/orders', { status: initialStatus });

  return (
    <TableCard
      toolbar={
        <>
          <SearchInput onSearch={list.setSearch} placeholder="شماره سفارش، موبایل یا نام خانوادگی" className="w-72" />
          <NativeSelect
            className="h-9 w-48"
            value={(list.params.status as string | undefined) ?? ''}
            onChange={(e) => list.update({ status: e.target.value || undefined })}
            aria-label="وضعیت"
          >
            <option value="">همه وضعیت‌ها</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABELS[status as OrderStatus]}
              </option>
            ))}
          </NativeSelect>
        </>
      }
    >
      <DataTable
        rows={list.data?.items}
        loading={list.isLoading}
        rowKey={(o) => o.id}
        onRowClick={(o) => router.push(`/admin/orders/${o.id}`)}
        columns={[
          { header: 'شماره', cell: (o) => <Link href={`/admin/orders/${o.id}`} className="font-bold text-info">{faNumber(o.orderNumber)}</Link> },
          { header: 'مشتری', cell: (o) => <div><p>{o.customer.fullName}</p><p className="ltr text-end text-xs text-muted-foreground">{o.customer.mobile}</p></div> },
          { header: 'اقلام', cell: (o) => faNumber(o.itemsCount) },
          { header: 'مبلغ', cell: (o) => <span className="font-semibold">{price(o.total)}</span> },
          { header: 'وضعیت', cell: (o) => <OrderStatusBadge status={o.status} /> },
          { header: 'ثبت', cell: (o) => <span className="text-xs text-muted-foreground">{dateTime(o.createdAt)}</span> },
        ]}
      />
      <Pager data={list.data} onPage={list.setPage} />
    </TableCard>
  );
}

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="سفارش‌ها" description="مدیریت و پیگیری سفارش‌ها بر اساس چرخه وضعیت" />
      <Suspense>
        <OrdersList />
      </Suspense>
    </>
  );
}
