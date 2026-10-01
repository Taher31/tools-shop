'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ORDER_STATUS_LABELS, ORDER_TRACKING_STEPS, type OrderDetail } from '@toolshop/shared';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Skeleton,
  toast,
} from '@toolshop/ui';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AddressText } from '@/components/account/address-form';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/common/status-badges';
import { ProductImage } from '@/components/product/product-image';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { date, dateTime, faNumber, price } from '@/lib/format';

function Tracker({ order }: { order: OrderDetail }) {
  const reached = new Set(order.history.map((h) => h.toStatus));
  if (!reached.has('paid')) return null;
  const current = ORDER_TRACKING_STEPS.findLastIndex((step) => reached.has(step));
  return (
    <ol className="grid grid-cols-5 gap-1">
      {ORDER_TRACKING_STEPS.map((step, index) => (
        <li key={step} className="flex flex-col items-center gap-2 text-center">
          <span
            className={cn(
              'flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold',
              index <= current
                ? 'border-success bg-success text-white'
                : 'border-border text-muted-foreground',
            )}
          >
            {index <= current ? <Check className="size-4" /> : faNumber(index + 1)}
          </span>
          <span
            className={cn(
              'text-[11px] leading-5',
              index <= current ? 'font-bold' : 'text-muted-foreground',
            )}
          >
            {ORDER_STATUS_LABELS[step]}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<OrderDetail>(`/account/orders/${id}`),
  });
  const cancel = useMutation({
    mutationFn: () => api.post<OrderDetail>(`/account/orders/${id}/cancel`, {}),
    onSuccess: (updated) => {
      queryClient.setQueryData(['order', id], updated);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('سفارش لغو شد.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const pay = useMutation({
    mutationFn: () => api.post<{ paymentUrl: string }>(`/account/orders/${id}/pay`, {}),
    onSuccess: ({ paymentUrl }) => window.location.assign(paymentUrl),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (!order) return <Alert variant="destructive">{errorMessage(error)}</Alert>;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>سفارش {faNumber(order.orderNumber)}</CardTitle>
            <p className="text-muted-foreground text-xs">ثبت‌شده در {dateTime(order.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            {order.canPay ? (
              <Button
                size="sm"
                variant="accent"
                loading={pay.isPending}
                onClick={() => pay.mutate()}
              >
                پرداخت سفارش
              </Button>
            ) : null}
            {order.canCancel ? (
              <Button
                size="sm"
                variant="outline"
                loading={cancel.isPending}
                onClick={() => {
                  if (window.confirm('آیا از لغو این سفارش اطمینان دارید؟')) cancel.mutate();
                }}
              >
                لغو سفارش
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/account/tickets/new?order=${order.id}`}>پیگیری با پشتیبانی</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {order.status === 'awaiting_payment' && order.reservationExpiresAt ? (
            <Alert variant="warning">
              کالاهای این سفارش تا {dateTime(order.reservationExpiresAt)} برای شما رزرو شده‌اند. پس
              از آن، سفارش پرداخت‌نشده به‌صورت خودکار لغو می‌شود.
            </Alert>
          ) : null}
          <Tracker order={order} />
          {order.trackingCode ? (
            <p className="text-sm">
              کد رهگیری مرسوله:{' '}
              <span className="ltr font-mono font-bold">{order.trackingCode}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>اقلام سفارش</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-border divide-y">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 px-5 py-3">
                <div className="bg-muted relative size-16 shrink-0 rounded-md">
                  <ProductImage
                    src={item.imageUrl}
                    alt={item.title}
                    sizes="64px"
                    className="p-1.5"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  {item.productSlug ? (
                    <Link
                      href={`/product/${item.productSlug}`}
                      className="hover:text-primary line-clamp-1 text-sm font-semibold"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <p className="line-clamp-1 text-sm font-semibold">{item.title}</p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {item.variantTitle ? `${item.variantTitle} · ` : ''}
                    {faNumber(item.quantity)} × {price(item.unitPrice)}
                  </p>
                </div>
                <span className="text-sm font-bold">{price(item.total)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ارسال</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-semibold">{order.shippingMethodName}</p>
            <AddressText address={order.shippingAddress} />
            {order.customerNote ? (
              <p className="text-muted-foreground text-xs">توضیحات: {order.customerNote}</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>صورت‌حساب</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">جمع کالاها</span>
              <span>{price(order.subtotal)}</span>
            </div>
            {order.discountTotal > 0 ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  تخفیف {order.couponCode ? `(${order.couponCode})` : ''}
                </span>
                <span className="text-destructive">− {price(order.discountTotal)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted-foreground">هزینه ارسال</span>
              <span>{order.shippingCost === 0 ? 'رایگان' : price(order.shippingCost)}</span>
            </div>
            <div className="border-border flex justify-between border-t pt-2 font-bold">
              <span>مبلغ کل</span>
              <span>{price(order.total)}</span>
            </div>
            {order.taxIncluded && order.taxTotal > 0 ? (
              <p className="text-muted-foreground text-[11px]">
                شامل {price(order.taxTotal)} مالیات بر ارزش افزوده
              </p>
            ) : null}
            {order.payments.length > 0 ? (
              <ul className="border-border space-y-2 border-t pt-3">
                {order.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <span>{date(payment.createdAt)}</span>
                    <PaymentStatusBadge status={payment.status} />
                    {payment.referenceId ? (
                      <span className="ltr font-mono">{payment.referenceId}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
