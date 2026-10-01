'use client';

import { cn } from '@toolshop/ui';
import { GitCompareArrows, Heart } from 'lucide-react';
import { useCompare } from '@/hooks/use-compare';
import { useToggleWishlist, useWishlistIds } from '@/hooks/use-wishlist';

/** Wishlist / compare quick actions shown on product cards. */
export function ProductCardActions({ productId }: { productId: string }) {
  const { data: wishlist } = useWishlistIds();
  const wishlistToggle = useToggleWishlist();
  const compare = useCompare();
  const inWishlist = wishlist?.includes(productId) ?? false;
  const inCompare = compare.has(productId);

  return (
    <div className="absolute end-2 top-2 flex flex-col gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
      <button
        type="button"
        onClick={() => wishlistToggle.toggle(productId, !inWishlist)}
        className={cn(
          'flex size-8 items-center justify-center rounded-full border border-border bg-card/95 shadow-sm hover:text-destructive',
          inWishlist && 'text-destructive',
        )}
        aria-label={inWishlist ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
        aria-pressed={inWishlist}
      >
        <Heart className={cn('size-4', inWishlist && 'fill-current')} />
      </button>
      <button
        type="button"
        onClick={() => compare.toggle(productId)}
        className={cn(
          'flex size-8 items-center justify-center rounded-full border border-border bg-card/95 shadow-sm hover:text-info',
          inCompare && 'border-info text-info',
        )}
        aria-label={inCompare ? 'حذف از مقایسه' : 'افزودن به مقایسه'}
        aria-pressed={inCompare}
      >
        <GitCompareArrows className="size-4" />
      </button>
    </div>
  );
}
