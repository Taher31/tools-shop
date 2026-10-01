'use client';

import { useQuery } from '@tanstack/react-query';
import { type Paginated, TICKET_CATEGORY_LABELS, type TicketSummary } from '@toolshop/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@toolshop/ui';
import { ChevronLeft, LifeBuoy, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { TicketStatusBadge } from '@/components/common/status-badges';
import { api } from '@/lib/api/client';
import { dateTime, faNumber } from '@/lib/format';

export default function TicketsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['tickets', page],
    queryFn: () => api.get<Paginated<TicketSummary>>(`/account/tickets?page=${page}&pageSize=10`),
  });

  const newButton = (
    <Button asChild variant="accent">
      <Link href="/account/tickets/new">
        <Plus /> درخواست جدید
      </Link>
    </Button>
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>پشتیبانی</CardTitle>
        {data && data.items.length > 0 ? newButton : null}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<LifeBuoy />}
            title="درخواست پشتیبانی ندارید"
            description="سوال درباره کالا، پیگیری سفارش، پرداخت یا گارانتی را از اینجا با کارشناسان ما مطرح کنید."
            action={newButton}
          />
        ) : (
          <>
            <ul className="divide-border divide-y">
              {data.items.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/account/tickets/${ticket.id}`}
                    className="hover:bg-muted/40 flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4"
                  >
                    <span className="text-muted-foreground text-sm">
                      #{faNumber(ticket.ticketNumber)}
                    </span>
                    <span className="font-bold">{ticket.subject}</span>
                    {ticket.unread ? <Badge variant="info">پاسخ جدید</Badge> : null}
                    <TicketStatusBadge status={ticket.status} />
                    <span className="text-muted-foreground text-xs">
                      {TICKET_CATEGORY_LABELS[ticket.category]}
                      {ticket.orderNumber ? ` · سفارش ${faNumber(ticket.orderNumber)}` : ''}
                    </span>
                    <span className="text-muted-foreground ms-auto text-xs">
                      {dateTime(ticket.lastMessageAt)}
                    </span>
                    <ChevronLeft className="text-muted-foreground size-4" />
                  </Link>
                </li>
              ))}
            </ul>
            {data.totalPages > 1 ? (
              <div className="border-border flex justify-center gap-2 border-t p-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  قبلی
                </Button>
                <span className="self-center text-sm">
                  {faNumber(page)} از {faNumber(data.totalPages)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  بعدی
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
