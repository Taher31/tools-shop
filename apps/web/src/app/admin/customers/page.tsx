'use client';

import type { CustomerListItem } from '@toolshop/shared';
import { Badge } from '@toolshop/ui';
import { useRouter } from 'next/navigation';
import { DataTable, Pager, TableCard } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { useUrlList } from '@/components/admin/query';
import { date, faNumber, price } from '@/lib/format';
import { FilterBar } from '@/components/admin/filter-bar';
import { Suspense } from 'react';
import { ExportButton } from '@/components/admin/export-button';

function CustomersPageContent() {
  const router = useRouter();
  const list = useUrlList<CustomerListItem>('/admin/customers');
  return (
    <>
      <PageHeader title="مشتریان" />
      <TableCard
        toolbar={
          <FilterBar
            actions={<ExportButton entity="customers" params={list.params} />}
            list={list}
            searchPlaceholder="نام، موبایل یا ایمیل"
            dateLabel="تاریخ عضویت"
            inline={[
              {
                type: 'select',
                key: 'hasOrders',
                label: 'خرید',
                allLabel: 'همه مشتریان',
                options: [
                  { value: 'true', label: 'دارای سفارش' },
                  { value: 'false', label: 'بدون سفارش' },
                ],
              },
              {
                type: 'select',
                key: 'active',
                label: 'وضعیت حساب',
                options: [
                  { value: 'true', label: 'فعال' },
                  { value: 'false', label: 'مسدود' },
                ],
              },
            ]}
            sorts={[
              { value: '', label: 'جدیدترین' },
              { value: 'oldest', label: 'قدیمی‌ترین' },
              { value: 'name', label: 'نام خانوادگی' },
            ]}
          />
        }
      >
        <DataTable
          rows={list.data?.items}
          loading={list.isLoading}
          rowKey={(c) => c.id}
          onRowClick={(c) => router.push(`/admin/customers/${c.id}`)}
          columns={[
            { header: 'نام', cell: (c) => <span className="font-semibold">{c.fullName}</span> },
            { header: 'موبایل', cell: (c) => <span className="ltr">{c.mobile ?? '—'}</span> },
            { header: 'ایمیل', cell: (c) => <span className="ltr text-xs">{c.email ?? '—'}</span> },
            { header: 'سفارش‌ها', cell: (c) => faNumber(c.ordersCount) },
            { header: 'مجموع خرید', cell: (c) => price(c.totalSpent) },
            {
              header: 'وضعیت',
              cell: (c) =>
                c.isActive ? (
                  <Badge variant="success">فعال</Badge>
                ) : (
                  <Badge variant="destructive">غیرفعال</Badge>
                ),
            },
            {
              header: 'عضویت',
              cell: (c) => (
                <span className="text-muted-foreground text-xs">{date(c.createdAt)}</span>
              ),
            },
          ]}
        />
        <Pager data={list.data} onPage={list.setPage} />
      </TableCard>
    </>
  );
}

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersPageContent />
    </Suspense>
  );
}
