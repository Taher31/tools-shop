'use client';

import type { AuditLogView } from '@toolshop/shared';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  NativeSelect,
} from '@toolshop/ui';
import { useState } from 'react';
import { DataTable, Pager, SearchInput, TableCard } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminList } from '@/components/admin/query';
import { dateTime } from '@/lib/format';

const ENTITY_LABELS: Record<string, string> = {
  product: 'محصول',
  variant: 'موجودی',
  order: 'سفارش',
  payment: 'پرداخت',
  category: 'دسته‌بندی',
  brand: 'برند',
  attribute: 'ویژگی',
  coupon: 'کد تخفیف',
  role: 'نقش',
  user: 'کاربر',
  settings: 'تنظیمات',
  warehouse: 'انبار',
  shipping_method: 'ارسال',
  review: 'نظر',
  question: 'پرسش',
  page: 'صفحه',
};

function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">—</span>;
  return (
    <pre className="ltr bg-muted max-h-80 overflow-auto rounded-md p-3 text-left text-[11px] leading-5">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function AuditLogsPage() {
  const list = useAdminList<AuditLogView>('/admin/audit-logs');
  const [detail, setDetail] = useState<AuditLogView | null>(null);

  return (
    <>
      <PageHeader
        title="گزارش رویدادها"
        description="چه کسی، چه زمانی، چه چیزی را تغییر داد (قیمت، موجودی، سفارش، بازپرداخت، نقش‌ها، تنظیمات…)"
      />
      <TableCard
        toolbar={
          <>
            <SearchInput
              onSearch={list.setSearch}
              placeholder="جستجو در شرح رویداد"
              className="w-64"
            />
            <NativeSelect
              className="h-9 w-44"
              value={(list.params.entityType as string) ?? ''}
              onChange={(e) => list.update({ entityType: e.target.value || undefined })}
              aria-label="نوع"
            >
              <option value="">همه موجودیت‌ها</option>
              {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </>
        }
      >
        <DataTable
          rows={list.data?.items}
          loading={list.isLoading}
          rowKey={(a) => a.id}
          onRowClick={setDetail}
          columns={[
            {
              header: 'زمان',
              cell: (a) => (
                <span className="whitespace-nowrap text-xs">{dateTime(a.createdAt)}</span>
              ),
            },
            {
              header: 'کاربر',
              cell: (a) =>
                a.actor?.fullName ?? (
                  <Badge variant="secondary">
                    {a.actorType === 'system' ? 'سیستم' : a.actorType}
                  </Badge>
                ),
            },
            {
              header: 'رویداد',
              cell: (a) => <span className="ltr font-mono text-xs">{a.action}</span>,
            },
            { header: 'موجودیت', cell: (a) => ENTITY_LABELS[a.entityType] ?? a.entityType },
            {
              header: 'شرح',
              cell: (a) => (
                <span className="line-clamp-1 max-w-md text-sm">{a.summary ?? '—'}</span>
              ),
            },
            {
              header: 'IP',
              cell: (a) => (
                <span className="ltr text-muted-foreground text-xs">{a.ipAddress ?? '—'}</span>
              ),
            },
            {
              header: '',
              cell: () => (
                <Button size="sm" variant="ghost">
                  جزئیات
                </Button>
              ),
            },
          ]}
        />
        <Pager data={list.data} onPage={list.setPage} />
      </TableCard>
      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{detail?.summary ?? detail?.action}</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {dateTime(detail.createdAt)} · {detail.actor?.fullName ?? detail.actorType} ·{' '}
                <span className="ltr font-mono">{detail.action}</span> ·{' '}
                <span className="ltr font-mono">{detail.entityId}</span>
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 font-bold">قبل</p>
                  <Json value={detail.before} />
                </div>
                <div>
                  <p className="mb-1 font-bold">بعد</p>
                  <Json value={detail.after} />
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
