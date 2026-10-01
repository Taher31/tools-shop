'use client';

import { PRODUCT_SORT_LABELS, PRODUCT_SORTS, type ProductSort, type ProductSearchResult } from '@toolshop/shared';
import { cn, NativeSelect } from '@toolshop/ui';
import { X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { faNumber, priceNumber } from '@/lib/format';
import { type ListingState, listingSearchParams } from '@/lib/listing';
import { MobileFilters } from './listing-filters';

interface Chip {
  key: string;
  label: string;
  remove: Partial<ListingState>;
}

export function ListingToolbar({
  state,
  result,
  hideBrand,
  linkCategories,
}: {
  state: ListingState;
  result: ProductSearchResult;
  hideBrand?: boolean;
  linkCategories?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const go = (patch: Partial<ListingState>) => {
    const query = listingSearchParams({ ...state, ...patch, page: 1 }).toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const labelFor = (code: string, value: string) =>
    result.facets.attributes.find((f) => f.code === code)?.values.find((v) => v.value === value)?.label ?? value;
  const chips: Chip[] = [
    ...state.brand.map((brand) => ({
      key: `brand-${brand}`,
      label: result.facets.brands.find((b) => b.value === brand)?.label ?? brand,
      remove: { brand: state.brand.filter((b) => b !== brand) },
    })),
    ...Object.entries(state.attributes).flatMap(([code, values]) =>
      values.map((value) => ({
        key: `${code}-${value}`,
        label: labelFor(code, value),
        remove: {
          attributes: Object.fromEntries(
            Object.entries({ ...state.attributes, [code]: values.filter((v) => v !== value) }).filter(([, v]) => v.length > 0),
          ),
        },
      })),
    ),
    ...(state.minPrice !== undefined ? [{ key: 'min', label: `از ${priceNumber(state.minPrice)} تومان`, remove: { minPrice: undefined } }] : []),
    ...(state.maxPrice !== undefined ? [{ key: 'max', label: `تا ${priceNumber(state.maxPrice)} تومان`, remove: { maxPrice: undefined } }] : []),
    ...(state.inStock ? [{ key: 'stock', label: 'فقط موجود', remove: { inStock: false } }] : []),
    ...(state.onSale ? [{ key: 'sale', label: 'تخفیف‌دار', remove: { onSale: false } }] : []),
  ];

  return (
    <div className={cn('mb-4 space-y-3 transition-opacity', pending && 'opacity-60')}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <MobileFilters state={state} facets={result.facets} activeCount={chips.length} hideBrand={hideBrand} linkCategories={linkCategories} />
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{faNumber(result.total)}</span> کالا
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="hidden text-muted-foreground sm:inline">مرتب‌سازی:</span>
          <NativeSelect
            value={state.sort}
            onChange={(event) => go({ sort: event.target.value as ProductSort })}
            className="h-9 w-40 text-[13px]"
            aria-label="مرتب‌سازی"
          >
            {PRODUCT_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {PRODUCT_SORT_LABELS[sort]}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => go(chip.remove)}
              className="flex items-center gap-1 rounded-full border border-primary/30 bg-secondary px-3 py-1 text-xs hover:border-destructive hover:text-destructive"
            >
              {chip.label}
              <X className="size-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => go({ brand: [], attributes: {}, minPrice: undefined, maxPrice: undefined, inStock: false, onSale: false })}
            className="text-xs text-destructive hover:underline"
          >
            حذف همه فیلترها
          </button>
        </div>
      ) : null}
    </div>
  );
}
