'use client';

import { useQuery } from '@tanstack/react-query';
import type { OrderSummary, Paginated } from '@toolshop/shared';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@toolshop/ui';
import { ChevronLeft, Package } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { OrderStatusBadge } from '@/components/common/status-badges';
import { api } from '@/lib/api/client';
import { date, faNumber, price } from '@/lib/format';

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['orders', page],
    queryFn: () => api.get<Paginated<OrderSummary>>(`/account/orders?page=${page}&pageSize=10`),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>سفارش‌های من</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<Package />}
            title="هنوز سفارشی ثبت نکرده‌اید"
            action={
              <Button asChild variant="accent">
                <Link href="/products">شروع خرید</Link>
              </Button>
            }
          />
        ) : (
          <>
            <ul className="divide-border divide-y">
              {data.items.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="hover:bg-muted/40 flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4"
                  >
                    <span className="font-bold">سفارش {faNumber(order.orderNumber)}</span>
                    <OrderStatusBadge status={order.status} />
                    <span className="text-muted-foreground text-sm">{date(order.createdAt)}</span>
                    <span className="text-muted-foreground text-sm">
                      {faNumber(order.itemsCount)} کالا
                    </span>
                    <span className="ms-auto font-bold">{price(order.total)}</span>
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
