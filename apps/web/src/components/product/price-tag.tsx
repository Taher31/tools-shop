import { cn } from '@toolshop/ui';
import { faNumber, priceNumber } from '@/lib/format';

export function PriceTag({
  price,
  compareAtPrice,
  discountPercent,
  size = 'md',
  className,
}: {
  price: number;
  compareAtPrice?: number | null;
  discountPercent?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const hasDiscount = Boolean(compareAtPrice && compareAtPrice > price && (discountPercent ?? 0) > 0);
  return (
    <div className={cn('flex flex-col items-end gap-0.5', className)}>
      {hasDiscount && compareAtPrice ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground line-through decoration-destructive/60">{priceNumber(compareAtPrice)}</span>
          <span className="rounded-sm bg-destructive px-1.5 text-xs font-bold leading-5 text-white">
            ٪{faNumber(discountPercent ?? 0)}
          </span>
        </div>
      ) : null}
      <p className="flex items-baseline gap-1">
        <span
          className={cn(
            'font-extrabold tracking-tight text-foreground',
            size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-base',
          )}
        >
          {priceNumber(price)}
        </span>
        <span className="text-xs text-muted-foreground">تومان</span>
      </p>
    </div>
  );
}
