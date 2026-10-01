'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TICKET_CATEGORY_LABELS, type TicketDetail } from '@toolshop/shared';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  toast,
} from '@toolshop/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TicketStatusBadge } from '@/components/common/status-badges';
import { TicketReplyForm, TicketThread } from '@/components/support/ticket-thread';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { dateTime, faNumber } from '@/lib/format';

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const key = ['tickets', 'detail', id];
  const ticket = useQuery({
    queryKey: key,
    queryFn: () => api.get<TicketDetail>(`/account/tickets/${id}`),
  });
  const onSuccess = (data: TicketDetail) => {
    queryClient.setQueryData(key, data);
    void queryClient.invalidateQueries({
      queryKey: ['tickets'],
      exact: false,
      refetchType: 'none',
    });
  };
  const reply = useMutation({
    mutationFn: (body: string) =>
      api.post<TicketDetail>(`/account/tickets/${id}/messages`, { body }),
    onSuccess,
    onError: (error) => toast.error(errorMessage(error)),
  });
  const close = useMutation({
    mutationFn: () => api.post<TicketDetail>(`/account/tickets/${id}/close`),
    onSuccess: (data) => {
      onSuccess(data);
      toast.success('درخواست بسته شد.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (ticket.isError) return <Alert variant="destructive">{errorMessage(ticket.error)}</Alert>;
  if (!ticket.data) return <Skeleton className="h-96" />;
  const t = ticket.data;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>{t.subject}</CardTitle>
          <TicketStatusBadge status={t.status} />
          {t.canReply ? (
            <Button
              variant="outline"
              size="sm"
              className="ms-auto"
              disabled={close.isPending}
              onClick={() => close.mutate()}
            >
              بستن درخواست
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">
          شماره {faNumber(t.ticketNumber)} · {TICKET_CATEGORY_LABELS[t.category]} · ثبت{' '}
          {dateTime(t.createdAt)}
          {t.orderId && t.orderNumber ? (
            <>
              {' · '}
              <Link href={`/account/orders/${t.orderId}`} className="text-info">
                سفارش {faNumber(t.orderNumber)}
              </Link>
            </>
          ) : null}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <TicketThread messages={t.messages} perspective="customer" />
        {t.canReply ? (
          <div className="border-border border-t pt-5">
            <TicketReplyForm
              pending={reply.isPending}
              onSubmit={({ body }) => reply.mutateAsync(body)}
            />
          </div>
        ) : (
          <Alert>
            این درخواست بسته شده است. برای پیگیری بیشتر{' '}
            <Link href="/account/tickets/new" className="text-info font-semibold">
              درخواست جدید
            </Link>{' '}
            ثبت کنید.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
