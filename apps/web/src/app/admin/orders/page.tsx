'use client';

import {
  type AdminOrderSummary,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
  type ShippingMethodView,
} from '@toolshop/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { DataTable, Pager, TableCard } from '@/components/admin/data-table';
import { FilterBar } from '@/components/admin/filter-bar';
import { PageHeader } from '@/components/admin/page-header';
import { useUrlList } from '@/components/admin/query';
import { api } from '@/lib/api/client';
import { OrderStatusBadge } from '@/components/common/status-badges';
import { dateTime, faNumber, price } from '@/lib/format';

function OrdersList() {
  const router = useRouter();
  const list = useUrlList<AdminOrderSummary>('/admin/orders');
  const shipping = useQuery({
    queryKey: ['admin', 'shipping-methods'],
    queryFn: () => api.get<ShippingMethodView[]>('/admin/shipping-methods'),
    staleTime: 300_000,
  });

  return (
    <TableCard
      toolbar={
        <FilterBar
          list={list}
          searchPlaceholder="شماره سفارش، موبایل، نام یا کد رهگیری"
          dateLabel="تاریخ ثبت"
          inline={[
            {
              type: 'select',
              key: 'status',
              label: 'وضعیت',
              options: ORDER_STATUSES.map((s) => ({
                value: s,
                label: ORDER_STATUS_LABELS[s as OrderStatus],
              })),
            },
          ]}
          more={[
            {
              type: 'range',
              label: 'مبلغ سفارش',
              minKey: 'minTotal',
              maxKey: 'maxTotal',
              unit: 'تومان',
            },
            {
              type: 'select',
              key: 'shippingMethodId',
              label: 'روش ارسال',
              options: (shipping.data ?? []).map((m) => ({ value: m.id, label: m.name })),
            },
          ]}
          sorts={[
            { value: '', label: 'جدیدترین' },
            { value: 'oldest', label: 'قدیمی‌ترین' },
            { value: 'total_desc', label: 'بیشترین مبلغ' },
            { value: 'total_asc', label: 'کمترین مبلغ' },
          ]}
        />
      }
    >
      <DataTable
        rows={list.data?.items}
        loading={list.isLoading}
        rowKey={(o) => o.id}
        onRowClick={(o) => router.push(`/admin/orders/${o.id}`)}
        columns={[
          {
            header: 'شماره',
            cell: (o) => (
              <Link href={`/admin/orders/${o.id}`} className="text-info font-bold">
                {faNumber(o.orderNumber)}
              </Link>
            ),
          },
          {
            header: 'مشتری',
            cell: (o) => (
              <div>
                <p>{o.customer.fullName}</p>
                <p className="ltr text-muted-foreground text-end text-xs">{o.customer.mobile}</p>
              </div>
            ),
          },
          { header: 'اقلام', cell: (o) => faNumber(o.itemsCount) },
          { header: 'مبلغ', cell: (o) => <span className="font-semibold">{price(o.total)}</span> },
          { header: 'وضعیت', cell: (o) => <OrderStatusBadge status={o.status} /> },
          {
            header: 'ثبت',
            cell: (o) => (
              <span className="text-muted-foreground text-xs">{dateTime(o.createdAt)}</span>
            ),
          },
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
