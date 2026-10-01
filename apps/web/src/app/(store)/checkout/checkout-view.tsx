'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CartTotals, CheckoutPreview, CheckoutResult } from '@toolshop/shared';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, cn, EmptyState, RadioGroup, RadioGroupItem, Skeleton, Textarea, toast } from '@toolshop/ui';
import { CreditCard, MapPin, Plus, ShoppingCart, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AddressDialog, AddressText } from '@/components/account/address-form';
import { OrderSummary } from '@/components/cart/order-summary';
import { CART_QUERY_KEY } from '@/hooks/use-cart';
import { api, toQueryString } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { faNumber, price } from '@/lib/format';

export function CheckoutView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [addressId, setAddressId] = useState<string | undefined>();
  const [shippingId, setShippingId] = useState<string | undefined>();
  const [provider, setProvider] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [addressDialog, setAddressDialog] = useState(false);

  const preview = useQuery({
    queryKey: ['checkout', addressId ?? 'default'],
    queryFn: () => api.get<CheckoutPreview>(`/checkout${toQueryString({ addressId })}`),
    retry: false,
  });
  const data = preview.data;

  useEffect(() => {
    if (!data) return;
    if (!addressId && data.addresses[0]) setAddressId(data.addresses[0].id);
    if (shippingId && !data.shippingOptions.some((o) => o.id === shippingId)) setShippingId(undefined);
    if (!provider && data.paymentProviders[0]) setProvider(data.paymentProviders[0].code);
  }, [data, addressId, shippingId, provider]);

  const quote = useQuery({
    queryKey: ['checkout-quote', addressId, shippingId, data?.cart.totals.total],
    queryFn: () => api.post<CartTotals>('/checkout/quote', { addressId, shippingMethodId: shippingId }),
    enabled: Boolean(addressId && shippingId),
  });

  const place = useMutation({
    mutationFn: () =>
      api.post<CheckoutResult>('/checkout', {
        addressId,
        shippingMethodId: shippingId,
        paymentProvider: provider,
        note: note.trim() || undefined,
        expectedTotal: quote.data?.total,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      window.location.assign(result.paymentUrl);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'PAYMENT_PROVIDER_UNAVAILABLE') {
        const orderId = error.details.find((d) => d.path === 'orderId')?.message;
        toast.error(error.message);
        void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
        if (orderId) router.push(`/account/orders/${orderId}`);
        return;
      }
      toast.error(errorMessage(error));
      void queryClient.invalidateQueries({ queryKey: ['checkout'] });
      void queryClient.invalidateQueries({ queryKey: ['checkout-quote'] });
    },
  });

  if (preview.isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-96" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (preview.error) {
    const empty = preview.error instanceof ApiError && preview.error.code === 'CART_EMPTY';
    return (
      <div className="rounded-lg border border-border bg-card">
        <EmptyState
          icon={<ShoppingCart />}
          title={empty ? 'سبد خرید شما خالی است' : 'امکان نمایش صفحه پرداخت نیست'}
          description={empty ? undefined : errorMessage(preview.error)}
          action={
            <Button asChild variant="outline">
              <Link href={empty ? '/products' : '/cart'}>{empty ? 'مشاهده محصولات' : 'بازگشت به سبد خرید'}</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (!data) return null;

  const blocked = data.cart.lines.some((line) => line.issue !== null);
  const totals = quote.data ?? data.cart.totals;
  const canPlace = Boolean(addressId && shippingId && provider && quote.data && !blocked);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-5">
        {data.cart.warnings.length > 0 ? (
          <Alert variant="warning" title="برخی اقلام سبد خرید تغییر کرده‌اند">
            {data.cart.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
            <Link href="/cart" className="font-bold text-info hover:underline">
              اصلاح سبد خرید
            </Link>
          </Alert>
        ) : null}

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="size-5 text-primary" /> آدرس تحویل
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setAddressDialog(true)}>
              <Plus /> آدرس جدید
            </Button>
          </CardHeader>
          <CardContent>
            {data.addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">هنوز آدرسی ثبت نکرده‌اید. برای ادامه یک آدرس اضافه کنید.</p>
            ) : (
              <RadioGroup value={addressId} onValueChange={setAddressId} className="grid gap-3 sm:grid-cols-2">
                {data.addresses.map((address) => (
                  <label
                    key={address.id}
                    className={cn(
                      'flex cursor-pointer gap-3 rounded-md border p-3 transition-colors',
                      address.id === addressId ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                    )}
                  >
                    <RadioGroupItem value={address.id} className="mt-1" />
                    <div>
                      {address.title ? <p className="mb-1 text-sm font-bold">{address.title}</p> : null}
                      <AddressText address={address} />
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="size-5 text-primary" /> روش ارسال
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.shippingOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">برای این آدرس روش ارسالی در دسترس نیست.</p>
            ) : (
              <RadioGroup value={shippingId} onValueChange={setShippingId} className="space-y-2">
                {data.shippingOptions.map((option) => (
                  <label
                    key={option.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors',
                      option.id === shippingId ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                    )}
                  >
                    <RadioGroupItem value={option.id} />
                    <div className="flex-1">
                      <p className="text-sm font-bold">{option.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                        {option.description ? ' · ' : ''}
                        {option.estimatedDaysMax === 0
                          ? 'تحویل امروز'
                          : option.estimatedDaysMin === 0
                            ? `حداکثر ${faNumber(option.estimatedDaysMax)} روز کاری`
                            : `${faNumber(option.estimatedDaysMin)} تا ${faNumber(option.estimatedDaysMax)} روز کاری`}
                      </p>
                    </div>
                    <span className={cn('text-sm font-bold', option.isFree && 'text-success')}>
                      {option.isFree ? 'رایگان' : price(option.cost)}
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" /> پرداخت
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={provider} onValueChange={setProvider} className="flex flex-wrap gap-2">
              {data.paymentProviders.map((option) => (
                <label
                  key={option.code}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-4 py-3 text-sm',
                    option.code === provider ? 'border-primary bg-primary/5 font-bold' : 'border-border',
                  )}
                >
                  <RadioGroupItem value={option.code} /> {option.name}
                </label>
              ))}
            </RadioGroup>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="توضیحات سفارش (اختیاری)" aria-label="توضیحات سفارش" />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3 lg:sticky lg:top-40">
        <OrderSummary totals={totals} shippingPending={!shippingId}>
          <ul className="max-h-48 space-y-1.5 overflow-y-auto border-t border-border pt-3 text-xs text-muted-foreground">
            {data.cart.lines.map((line) => (
              <li key={line.id} className="flex justify-between gap-2">
                <span className="line-clamp-1">
                  {faNumber(line.quantity)} × {line.title}
                </span>
              </li>
            ))}
          </ul>
          <Button variant="accent" size="lg" className="w-full" disabled={!canPlace || quote.isFetching} loading={place.isPending} onClick={() => place.mutate()}>
            ثبت سفارش و پرداخت
          </Button>
          {!shippingId ? <p className="text-xs text-muted-foreground">برای ادامه، روش ارسال را انتخاب کنید.</p> : null}
        </OrderSummary>
        <p className="px-1 text-xs leading-6 text-muted-foreground">
          با ثبت سفارش، <Link href="/terms" className="text-info hover:underline">قوانین و مقررات</Link> فروشگاه را می‌پذیرید.
        </p>
      </div>

      <AddressDialog open={addressDialog} onOpenChange={setAddressDialog} onSaved={(address) => setAddressId(address.id)} />
    </div>
  );
}
