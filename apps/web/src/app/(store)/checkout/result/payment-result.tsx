'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { OrderDetail, PaymentResultView } from '@toolshop/shared';
import { Alert, Button, Skeleton, toast } from '@toolshop/ui';
import { CircleCheck, CircleX } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { faNumber, price } from '@/lib/format';

export function PaymentResult() {
  const params = useSearchParams();
  const orderId = params.get('order');
  const result = useQuery({
    queryKey: ['payment-result', orderId],
    queryFn: () => api.get<PaymentResultView>(`/payments/result?order=${orderId}`),
    enabled: Boolean(orderId),
    retry: false,
  });
  const order = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.get<OrderDetail>(`/account/orders/${orderId}`),
    enabled: Boolean(orderId),
  });
  const payAgain = useMutation({
    mutationFn: () => api.post<{ paymentUrl: string }>(`/account/orders/${orderId}/pay`, {}),
    onSuccess: ({ paymentUrl }) => window.location.assign(paymentUrl),
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!orderId || params.get('error')) {
    return (
      <div className="w-full max-w-lg">
        <Alert variant="destructive" title="تراکنش یافت نشد">
          اگر مبلغی از حساب شما کسر شده، حداکثر تا ۷۲ ساعت بازمی‌گردد. در غیر این صورت با پشتیبانی تماس بگیرید.
        </Alert>
      </div>
    );
  }
  if (result.isLoading) return <Skeleton className="h-72 w-full max-w-lg" />;
  if (!result.data) {
    return <Alert variant="destructive">{errorMessage(result.error)}</Alert>;
  }

  const success = result.data.status === 'succeeded';
  return (
    <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 text-center">
      {success ? <CircleCheck className="mx-auto size-16 text-success" strokeWidth={1.5} /> : <CircleX className="mx-auto size-16 text-destructive" strokeWidth={1.5} />}
      <h1 className="mt-4 text-xl font-extrabold">{success ? 'پرداخت موفق' : 'پرداخت ناموفق'}</h1>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{result.data.message}</p>
      <dl className="mx-auto mt-6 max-w-xs space-y-2 rounded-md bg-muted p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">شماره سفارش</dt>
          <dd className="font-bold">{faNumber(result.data.orderNumber)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">مبلغ</dt>
          <dd className="font-bold">{price(result.data.amount)}</dd>
        </div>
        {result.data.referenceId ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">کد پیگیری</dt>
            <dd className="ltr font-mono font-bold">{result.data.referenceId}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {!success && order.data?.canPay ? (
          <Button variant="accent" loading={payAgain.isPending} onClick={() => payAgain.mutate()}>
            تلاش مجدد برای پرداخت
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={`/account/orders/${orderId}`}>جزئیات سفارش</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">بازگشت به فروشگاه</Link>
        </Button>
      </div>
    </div>
  );
}
