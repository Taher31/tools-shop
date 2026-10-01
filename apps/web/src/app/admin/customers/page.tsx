'use client';

import type { CustomerListItem } from '@toolshop/shared';
import { Badge } from '@toolshop/ui';
import { useRouter } from 'next/navigation';
import { DataTable, Pager, SearchInput, TableCard } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminList } from '@/components/admin/query';
import { date, faNumber, price } from '@/lib/format';

export default function CustomersPage() {
  const router = useRouter();
  const list = useAdminList<CustomerListItem>('/admin/customers');
  return (
    <>
      <PageHeader title="مشتریان" />
      <TableCard toolbar={<SearchInput onSearch={list.setSearch} placeholder="نام، موبایل یا ایمیل" className="w-72" />}>
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
            { header: 'وضعیت', cell: (c) => (c.isActive ? <Badge variant="success">فعال</Badge> : <Badge variant="destructive">غیرفعال</Badge>) },
            { header: 'عضویت', cell: (c) => <span className="text-xs text-muted-foreground">{date(c.createdAt)}</span> },
          ]}
        />
        <Pager data={list.data} onPage={list.setPage} />
      </TableCard>
    </>
  );
}
