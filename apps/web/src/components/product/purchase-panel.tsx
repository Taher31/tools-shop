'use client';

import { useQuery } from '@tanstack/react-query';
import type { ProductDetail, ProductVariantView } from '@toolshop/shared';
import { Badge, Button, cn } from '@toolshop/ui';
import { CircleCheck, GitCompareArrows, Heart, Minus, Plus, ShieldCheck, ShoppingCart, Truck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useAddToCart } from '@/hooks/use-cart';
import { useCompare } from '@/hooks/use-compare';
import { useToggleWishlist, useWishlistIds } from '@/hooks/use-wishlist';
import { api } from '@/lib/api/client';
import { faNumber } from '@/lib/format';
import { PriceTag } from './price-tag';

function Availability({ variant }: { variant: ProductVariantView }) {
  if (variant.availability === 'out_of_stock') {
    return <Badge variant="destructive">ناموجود</Badge>;
  }
  if (variant.availability === 'low_stock') {
    return (
      <Badge variant="warning">
        <TriangleAlert className="size-3.5" />
        {variant.availableQuantity ? `تنها ${faNumber(variant.availableQuantity)} عدد در انبار` : 'موجودی محدود'}
      </Badge>
    );
  }
  return (
    <Badge variant="success">
      <CircleCheck className="size-3.5" /> موجود در انبار
    </Badge>
  );
}

/**
 * Variant choice, live price/stock and add-to-cart. Server-rendered data is shown
 * immediately and refreshed from the API on mount, so price and stock are never stale.
 */
export function PurchasePanel({ initial }: { initial: ProductDetail }) {
  const { data: product } = useQuery({
    queryKey: ['product', initial.slug],
    queryFn: () => api.get<ProductDetail>(`/products/${encodeURIComponent(initial.slug)}`),
    initialData: initial,
    staleTime: 0,
  });
  const firstAvailable = product.variants.find((v) => v.availability !== 'out_of_stock') ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const [quantity, setQuantity] = useState(1);
  const variant = product.variants.find((v) => v.id === variantId) ?? firstAvailable;
  const addToCart = useAddToCart();
  const { data: wishlist } = useWishlistIds();
  const wishlistToggle = useToggleWishlist();
  const compare = useCompare();
  const inWishlist = wishlist?.includes(product.id) ?? false;

  if (!variant) return null;
  const optionNames = [...new Set(product.variants.flatMap((v) => v.options.map((o) => o.name)))];
  const maxQuantity = variant.availableQuantity ?? 99;
  const soldOut = variant.availability === 'out_of_stock';

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5">
      {product.variants.length > 1 ? (
        <div>
          <p className="mb-2 text-sm font-bold">{optionNames[0] ?? 'انتخاب نوع'}:</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={optionNames[0] ?? 'انتخاب نوع'}>
            {product.variants.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={option.id === variant.id}
                onClick={() => {
                  setVariantId(option.id);
                  setQuantity(1);
                }}
                className={cn(
                  'rounded-md border px-3 py-2 text-[13px] transition-colors',
                  option.id === variant.id ? 'border-primary bg-primary/5 font-bold text-primary ring-1 ring-primary' : 'border-border hover:border-primary/60',
                  option.availability === 'out_of_stock' && 'text-muted-foreground line-through decoration-muted-foreground/50',
                )}
              >
                {option.options.map((o) => o.value).join(' / ') || option.title || option.sku}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Availability variant={variant} />
        <span className="text-xs text-muted-foreground">
          کد کالا: <span className="ltr font-mono">{variant.sku}</span>
        </span>
      </div>

      <div className="flex items-end justify-between gap-4 border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">قیمت</span>
        {soldOut ? (
          <span className="text-lg font-bold text-muted-foreground">ناموجود</span>
        ) : (
          <PriceTag price={variant.price} compareAtPrice={variant.compareAtPrice} discountPercent={variant.discountPercent} size="lg" />
        )}
      </div>

      {!soldOut ? (
        <div className="flex gap-2">
          <div className="flex shrink-0 items-center rounded-md border border-input">
            <button
              type="button"
              className="flex h-11 w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
              onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
              disabled={quantity >= maxQuantity}
              aria-label="افزایش تعداد"
            >
              <Plus className="size-4" />
            </button>
            <span className="w-8 text-center font-bold" aria-live="polite">
              {faNumber(quantity)}
            </span>
            <button
              type="button"
              className="flex h-11 w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="کاهش تعداد"
            >
              <Minus className="size-4" />
            </button>
          </div>
          <Button
            variant="accent"
            size="lg"
            className="min-w-0 flex-1 px-3"
            loading={addToCart.isPending}
            onClick={() => addToCart.mutate({ variantId: variant.id, quantity })}
          >
            <ShoppingCart className="size-5" /> افزودن به سبد
          </Button>
        </div>
      ) : (
        <p className="rounded-md bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          این کالا در حال حاضر موجود نیست. برای اطلاع از زمان تأمین با پشتیبانی تماس بگیرید.
        </p>
      )}

      {addToCart.isSuccess ? (
        <Link href="/cart" className="text-center text-sm font-medium text-info hover:underline">
          مشاهده سبد خرید و ادامه خرید
        </Link>
      ) : null}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => wishlistToggle.toggle(product.id, !inWishlist)}>
          <Heart className={cn(inWishlist && 'fill-destructive text-destructive')} />
          {inWishlist ? 'در علاقه‌مندی‌ها' : 'علاقه‌مندی'}
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => compare.toggle(product.id)}>
          <GitCompareArrows className={cn(compare.has(product.id) && 'text-info')} />
          {compare.has(product.id) ? 'در لیست مقایسه' : 'مقایسه'}
        </Button>
      </div>

      <ul className="space-y-2 border-t border-border pt-4 text-[13px] text-muted-foreground">
        {product.warranty ? (
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" /> {product.warranty}
          </li>
        ) : null}
        <li className="flex items-start gap-2">
          <Truck className="mt-0.5 size-4 shrink-0 text-info" /> ارسال به سراسر کشور؛ تحویل سریع در تهران
        </li>
      </ul>
    </div>
  );
}
