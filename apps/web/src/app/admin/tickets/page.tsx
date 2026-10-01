'use client';

import { useQuery } from '@tanstack/react-query';
import {
  type AdminTicketSummary,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
} from '@toolshop/shared';
import { Badge, Button, Card, cn, NativeSelect } from '@toolshop/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataTable, Pager, SearchInput, TableCard } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminList } from '@/components/admin/query';
import { TicketPriorityBadge, TicketStatusBadge } from '@/components/common/status-badges';
import { api } from '@/lib/api/client';
import { dateTime, faNumber } from '@/lib/format';

interface Counters {
  open: number;
  unread: number;
  mine: number;
  unassigned: number;
}

type Preset = 'queue' | 'unread' | 'mine' | 'unassigned' | 'all';

const PRESETS: {
  key: Preset;
  label: string;
  counter?: keyof Counters;
  params: Record<string, string | undefined>;
}[] = [
  { key: 'queue', label: 'در انتظار پاسخ', counter: 'open', params: { status: 'open' } },
  { key: 'unread', label: 'خوانده‌نشده', counter: 'unread', params: { unread: 'true' } },
  { key: 'mine', label: 'ارجاع به من', counter: 'mine', params: { assignee: 'me' } },
  { key: 'unassigned', label: 'بدون مسئول', counter: 'unassigned', params: { assignee: 'none' } },
  { key: 'all', label: 'همه', params: {} },
];

const RESET = { status: undefined, unread: undefined, assignee: undefined, priority: undefined };

export default function AdminTicketsPage() {
  const router = useRouter();
  const list = useAdminList<AdminTicketSummary>('/admin/tickets', { status: 'open' });
  const counters = useQuery({
    queryKey: ['admin', 'tickets', 'counters'],
    queryFn: () => api.get<Counters>('/admin/tickets/counters'),
  });
  const active = PRESETS.find((preset) =>
    Object.entries({ ...RESET, ...preset.params }).every(([k, v]) => list.params[k] === v),
  )?.key;

  return (
    <>
      <PageHeader
        title="پشتیبانی"
        description="تیکت‌های مشتریان؛ ابتدا قدیمی‌ترین و فوری‌ترین درخواست‌های بی‌پاسخ"
      />
      <Card className="mb-4 flex flex-wrap gap-1 p-1.5">
        {PRESETS.map((preset) => (
          <Button
            key={preset.key}
            size="sm"
            variant={active === preset.key ? 'default' : 'ghost'}
            onClick={() => list.update({ ...RESET, ...preset.params })}
          >
            {preset.label}
            {preset.counter && counters.data ? (
              <span
                className={cn(
                  'text-xs',
                  active === preset.key ? 'opacity-80' : 'text-muted-foreground',
                )}
              >
                ({faNumber(counters.data[preset.counter])})
              </span>
            ) : null}
          </Button>
        ))}
      </Card>
      <TableCard
        toolbar={
          <>
            <SearchInput
              onSearch={list.setSearch}
              placeholder="شماره تیکت یا سفارش، موبایل، عنوان"
              className="w-72"
            />
            <NativeSelect
              className="h-9 w-44"
              value={(list.params.status as string | undefined) ?? ''}
              onChange={(e) => list.update({ status: e.target.value || undefined })}
              aria-label="وضعیت"
            >
              <option value="">همه وضعیت‌ها</option>
              {TICKET_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TICKET_STATUS_LABELS[status]}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              className="h-9 w-36"
              value={(list.params.priority as string | undefined) ?? ''}
              onChange={(e) => list.update({ priority: e.target.value || undefined })}
              aria-label="اولویت"
            >
              <option value="">همه اولویت‌ها</option>
              {TICKET_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {TICKET_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </NativeSelect>
          </>
        }
      >
        <DataTable
          rows={list.data?.items}
          loading={list.isLoading}
          rowKey={(t) => t.id}
          onRowClick={(t) => router.push(`/admin/tickets/${t.id}`)}
          empty="تیکتی با این شرایط وجود ندارد."
          columns={[
            {
              header: 'شماره',
              cell: (t) => (
                <Link href={`/admin/tickets/${t.id}`} className="text-info font-bold">
                  {faNumber(t.ticketNumber)}
                </Link>
              ),
            },
            {
              header: 'عنوان',
              cell: (t) => (
                <div className="min-w-48">
                  <p className={cn(t.unread && 'font-bold')}>
                    {t.unread ? (
                      <span
                        className="bg-info me-1.5 inline-block size-2 rounded-full"
                        aria-label="خوانده‌نشده"
                      />
                    ) : null}
                    {t.subject}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {TICKET_CATEGORY_LABELS[t.category]}
                    {t.orderNumber ? ` · سفارش ${faNumber(t.orderNumber)}` : ''} ·{' '}
                    {faNumber(t.messagesCount)} پیام
                  </p>
                </div>
              ),
            },
            {
              header: 'مشتری',
              cell: (t) => (
                <div>
                  <p>{t.customer.fullName}</p>
                  <p className="ltr text-muted-foreground text-end text-xs">{t.customer.mobile}</p>
                </div>
              ),
            },
            { header: 'وضعیت', cell: (t) => <TicketStatusBadge status={t.status} /> },
            { header: 'اولویت', cell: (t) => <TicketPriorityBadge priority={t.priority} /> },
            {
              header: 'مسئول',
              cell: (t) =>
                t.assignee ? t.assignee.fullName : <Badge variant="outline">بدون مسئول</Badge>,
            },
            {
              header: 'آخرین فعالیت',
              cell: (t) => (
                <span className="text-muted-foreground text-xs">{dateTime(t.lastMessageAt)}</span>
              ),
            },
          ]}
        />
        <Pager data={list.data} onPage={list.setPage} />
      </TableCard>
    </>
  );
}
