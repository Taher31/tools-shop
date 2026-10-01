'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { MockPaymentSession } from '@toolshop/shared';
import { Alert, Button, Skeleton } from '@toolshop/ui';
import { CreditCard, Lock } from 'lucide-react';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { faNumber, price } from '@/lib/format';

type Result = 'success' | 'failed' | 'cancelled';

/**
 * Stand-in for a bank's payment page during development. A real PSP shows its own page
 * at the gateway's domain; the rest of the flow (callback → verify) is identical.
 */
export function MockGateway({ authority }: { authority: string }) {
  const session = useQuery({
    queryKey: ['mock-payment', authority],
    queryFn: () => api.get<MockPaymentSession>(`/payments/mock/${encodeURIComponent(authority)}`),
    retry: false,
  });
  const complete = useMutation({
    mutationFn: (result: Result) => api.post<{ redirectUrl: string }>(`/payments/mock/${encodeURIComponent(authority)}/complete`, { result }),
    onSuccess: ({ redirectUrl }) => window.location.assign(redirectUrl),
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#eef1f5] p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[#1d4f91] px-5 py-4 text-white">
          <div className="flex items-center gap-2 font-bold">
            <CreditCard className="size-5" /> درگاه پرداخت آزمایشی
          </div>
          <span className="flex items-center gap-1 text-xs opacity-80">
            <Lock className="size-3.5" /> محیط توسعه
          </span>
        </div>
        <div className="space-y-5 p-6">
          <Alert variant="warning">این صفحه فقط برای توسعه و تست است و هیچ تراکنش واقعی انجام نمی‌شود.</Alert>
          {session.isLoading ? <Skeleton className="h-24" /> : null}
          {session.error ? <Alert variant="destructive">{errorMessage(session.error)}</Alert> : null}
          {session.data ? (
            <>
              <dl className="space-y-3 rounded-lg bg-muted p-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">شماره سفارش</dt>
                  <dd className="font-bold">{faNumber(session.data.orderNumber)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">مبلغ قابل پرداخت</dt>
                  <dd className="text-lg font-extrabold">{price(session.data.amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">کد پیگیری درگاه</dt>
                  <dd className="ltr font-mono text-xs">{session.data.authority.slice(0, 16)}…</dd>
                </div>
              </dl>
              {session.data.status !== 'pending' ? (
                <Alert variant="info">این تراکنش قبلاً تعیین وضعیت شده است.</Alert>
              ) : null}
              <div className="grid gap-2">
                <Button size="lg" className="bg-success hover:bg-success/90" loading={complete.isPending && complete.variables === 'success'} disabled={complete.isPending} onClick={() => complete.mutate('success')}>
                  پرداخت موفق
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" disabled={complete.isPending} onClick={() => complete.mutate('failed')}>
                    خطای بانکی
                  </Button>
                  <Button variant="ghost" disabled={complete.isPending} onClick={() => complete.mutate('cancelled')}>
                    انصراف از پرداخت
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
