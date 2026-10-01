'use client';

import type { CartLine } from '@toolshop/shared';
import { Alert, Button, EmptyState, Input, Skeleton } from '@toolshop/ui';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { OrderSummary } from '@/components/cart/order-summary';
import { PriceTag } from '@/components/product/price-tag';
import { ProductImage } from '@/components/product/product-image';
import { useAuth } from '@/hooks/use-auth';
import { useApplyCoupon, useCart, useRemoveCartItem, useRemoveCoupon, useUpdateCartItem } from '@/hooks/use-cart';
import { faNumber } from '@/lib/format';

const ISSUE_LABELS = {
  unavailable: 'این کالا دیگر قابل خرید نیست.',
  out_of_stock: 'این کالا ناموجود شده است.',
  insufficient_stock: 'موجودی کافی نیست.',
} as const;

function Line({ line }: { line: CartLine }) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const busy = update.isPending || remove.isPending;
  return (
    <li className="flex gap-4 py-4">
      <Link href={`/product/${line.productSlug}`} className="relative size-24 shrink-0 overflow-hidden rounded-md bg-muted">
        <ProductImage src={line.imageUrl} alt={line.title} sizes="96px" className="p-2" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Link href={`/product/${line.productSlug}`} className="line-clamp-2 text-sm font-semibold leading-6 hover:text-primary">
          {line.title}
        </Link>
        {line.variantTitle ? <p className="text-xs text-muted-foreground">{line.variantTitle}</p> : null}
        {line.issue ? <p className="text-xs font-medium text-destructive">{ISSUE_LABELS[line.issue]}{line.issue === 'insufficient_stock' ? ` (موجودی: ${faNumber(line.availableQuantity)})` : ''}</p> : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-input">
              <button
                type="button"
                className="flex size-9 items-center justify-center disabled:opacity-40"
                disabled={busy || line.quantity >= line.availableQuantity}
                onClick={() => update.mutate({ itemId: line.id, quantity: line.quantity + 1 })}
                aria-label="افزایش تعداد"
              >
                <Plus className="size-4" />
              </button>
              <span className="w-8 text-center text-sm font-bold">{faNumber(line.quantity)}</span>
              <button
                type="button"
                className="flex size-9 items-center justify-center disabled:opacity-40"
                disabled={busy}
                onClick={() =>
                  line.quantity > 1 ? update.mutate({ itemId: line.id, quantity: line.quantity - 1 }) : remove.mutate(line.id)
                }
                aria-label="کاهش تعداد"
              >
                <Minus className="size-4" />
              </button>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => remove.mutate(line.id)} disabled={busy} aria-label="حذف">
              <Trash2 className="text-muted-foreground" />
            </Button>
          </div>
          <PriceTag price={line.lineTotal} compareAtPrice={line.compareAtPrice ? line.compareAtPrice * line.quantity : null} discountPercent={line.compareAtPrice ? Math.round((1 - line.unitPrice / line.compareAtPrice) * 100) : 0} />
        </div>
      </div>
    </li>
  );
}

function CouponForm({ applied }: { applied: { code: string; description: string | null } | null }) {
  const [code, setCode] = useState('');
  const apply = useApplyCoupon();
  const remove = useRemoveCoupon();
  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-md bg-success-soft px-3 py-2 text-sm">
        <span>
          کد <b className="ltr font-mono">{applied.code}</b> اعمال شد
        </span>
        <button type="button" className="text-xs text-destructive hover:underline" onClick={() => remove.mutate(undefined)}>
          حذف
        </button>
      </div>
    );
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.trim()) apply.mutate(code.trim(), { onSuccess: () => setCode('') });
      }}
    >
      <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="کد تخفیف" dir="ltr" className="text-left uppercase" aria-label="کد تخفیف" />
      <Button type="submit" variant="secondary" loading={apply.isPending}>
        اعمال
      </Button>
    </form>
  );
}

export function CartView() {
  const { data: cart, isLoading } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-72" />
        <Skeleton className="h-60" />
      </div>
    );
  }
  if (!cart || cart.lines.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <EmptyState
          icon={<ShoppingCart />}
          title="سبد خرید شما خالی است"
          description="برای شروع، محصولات مورد نیازتان را جستجو کنید یا از دسته‌بندی‌ها دیدن کنید."
          action={
            <Button asChild variant="accent">
              <Link href="/products">مشاهده محصولات</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const blocked = cart.lines.some((line) => line.issue !== null);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="rounded-lg border border-border bg-card px-5">
        {cart.warnings.length > 0 ? (
          <Alert variant="warning" className="mt-4">
            {cart.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </Alert>
        ) : null}
        <ul className="divide-y divide-border">
          {cart.lines.map((line) => (
            <Line key={line.id} line={line} />
          ))}
        </ul>
      </div>
      <div className="space-y-3 lg:sticky lg:top-40">
        <OrderSummary totals={cart.totals}>
          <CouponForm applied={cart.coupon} />
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            disabled={blocked}
            onClick={() => router.push(user ? '/checkout' : '/login?next=/checkout')}
          >
            {user ? 'ادامه فرایند خرید' : 'ورود و ادامه خرید'}
          </Button>
          {blocked ? <p className="text-xs text-destructive">ابتدا اقلام دارای مشکل موجودی را اصلاح یا حذف کنید.</p> : null}
        </OrderSummary>
        <p className="px-1 text-xs leading-6 text-muted-foreground">
          قیمت و موجودی کالاها هنگام ثبت سفارش دوباره بررسی می‌شود و کالاها تا پایان مهلت پرداخت برای شما رزرو می‌شوند.
        </p>
      </div>
    </div>
  );
}
