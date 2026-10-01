'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AdminTicketDetail,
  type StaffOption,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  type TicketUpdateInput,
} from '@toolshop/shared';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  NativeSelect,
  Skeleton,
} from '@toolshop/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminMutation } from '@/components/admin/query';
import {
  OrderStatusBadge,
  TicketPriorityBadge,
  TicketStatusBadge,
} from '@/components/common/status-badges';
import {
  type ReplyValues,
  TicketReplyForm,
  TicketThread,
} from '@/components/support/ticket-thread';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { date, dateTime, faNumber, price } from '@/lib/format';

export default function AdminTicketPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const key = ['admin', 'ticket', id];
  const ticket = useQuery({
    queryKey: key,
    queryFn: () => api.get<AdminTicketDetail>(`/admin/tickets/${id}`),
  });
  const staff = useQuery({
    queryKey: ['admin', 'tickets', 'staff'],
    queryFn: () => api.get<StaffOption[]>('/admin/tickets/staff'),
    enabled: can('ticket.manage'),
    staleTime: 300_000,
  });
  const onSaved = (data: AdminTicketDetail) => queryClient.setQueryData(key, data);
  const reply = useAdminMutation(
    (values: ReplyValues) => api.post<AdminTicketDetail>(`/admin/tickets/${id}/messages`, values),
    {
      invalidate: [
        ['admin', '/admin/tickets'],
        ['admin', 'tickets'],
      ],
      onSuccess: onSaved,
    },
  );
  const update = useAdminMutation(
    (input: TicketUpdateInput) => api.put<AdminTicketDetail>(`/admin/tickets/${id}`, input),
    {
      success: 'تیکت به‌روز شد.',
      invalidate: [
        ['admin', '/admin/tickets'],
        ['admin', 'tickets'],
      ],
      onSuccess: onSaved,
    },
  );

  if (!ticket.data) return <Skeleton className="h-96" />;
  const t = ticket.data;
  const manage = can('ticket.manage');

  return (
    <>
      <PageHeader
        title={`تیکت ${faNumber(t.ticketNumber)}: ${t.subject}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={t.status} />
            <TicketPriorityBadge priority={t.priority} />
            {TICKET_CATEGORY_LABELS[t.category]} · ثبت {dateTime(t.createdAt)}
          </span>
        }
      />
      <div className="grid items-start gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardContent className="space-y-6 pt-5">
            <TicketThread messages={t.messages} perspective="staff" />
            {can('ticket.reply') ? (
              <div className="border-border border-t pt-5">
                <TicketReplyForm
                  staff
                  canClose={manage}
                  pending={reply.isPending}
                  onSubmit={(v) => reply.mutateAsync(v)}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
        <div className="space-y-5">
          {manage ? (
            <Card>
              <CardHeader>
                <CardTitle>مدیریت تیکت</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Field label="وضعیت" htmlFor="tk-status">
                  <NativeSelect
                    id="tk-status"
                    value={t.status}
                    disabled={update.isPending}
                    onChange={(e) =>
                      update.mutate({ status: e.target.value as AdminTicketDetail['status'] })
                    }
                  >
                    {TICKET_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {TICKET_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="اولویت" htmlFor="tk-priority">
                  <NativeSelect
                    id="tk-priority"
                    value={t.priority}
                    disabled={update.isPending}
                    onChange={(e) =>
                      update.mutate({ priority: e.target.value as AdminTicketDetail['priority'] })
                    }
                  >
                    {TICKET_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {TICKET_PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="موضوع" htmlFor="tk-category">
                  <NativeSelect
                    id="tk-category"
                    value={t.category}
                    disabled={update.isPending}
                    onChange={(e) =>
                      update.mutate({ category: e.target.value as AdminTicketDetail['category'] })
                    }
                  >
                    {TICKET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {TICKET_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="کارشناس مسئول" htmlFor="tk-assignee">
                  <NativeSelect
                    id="tk-assignee"
                    value={t.assignee?.id ?? ''}
                    disabled={update.isPending}
                    onChange={(e) => update.mutate({ assigneeId: e.target.value || null })}
                  >
                    <option value="">بدون مسئول</option>
                    {staff.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>مشتری</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {can('customer.read') ? (
                <Link
                  href={`/admin/customers/${t.customer.id}`}
                  className="text-info font-semibold"
                >
                  {t.customer.fullName}
                </Link>
              ) : (
                <p className="font-semibold">{t.customer.fullName}</p>
              )}
              {t.customer.mobile ? <p className="ltr text-end">{t.customer.mobile}</p> : null}
              {t.customerEmail ? <p className="ltr text-end">{t.customerEmail}</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>سفارش‌های اخیر</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {t.recentOrders.length === 0 ? (
                <p className="text-muted-foreground p-5 text-sm">سفارشی ثبت نکرده است.</p>
              ) : (
                <ul className="divide-border divide-y text-sm">
                  {t.recentOrders.map((order) => (
                    <li key={order.id} className="flex flex-wrap items-center gap-2 px-5 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="text-info font-semibold">
                        {faNumber(order.orderNumber)}
                      </Link>
                      {order.id === t.orderId ? (
                        <span className="text-xs font-bold">(مرتبط)</span>
                      ) : null}
                      <OrderStatusBadge status={order.status} />
                      <span className="text-muted-foreground ms-auto text-xs">
                        {date(order.createdAt)} · {price(order.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
