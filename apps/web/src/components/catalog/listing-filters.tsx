'use client';

import type { ProductSearchResult } from '@toolshop/shared';
import { Button, Checkbox, cn, Dialog, DialogTrigger, Input, Label, SheetContent, Switch } from '@toolshop/ui';
import { SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useState, useTransition } from 'react';
import { faNumber, priceNumber } from '@/lib/format';
import { type ListingState, listingSearchParams } from '@/lib/listing';

interface FiltersProps {
  state: ListingState;
  facets: ProductSearchResult['facets'];
  /** Show the category facet as links to /category/{slug}. */
  linkCategories?: boolean;
  hideBrand?: boolean;
}

function useListingNavigation(state: ListingState) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const navigate = (patch: Partial<ListingState>) => {
    const next = listingSearchParams({ ...state, ...patch, page: 1 });
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  return { navigate, pending };
}

function FacetGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="border-b border-border py-4 first:pt-0 last:border-0 last:pb-0">
      <p className="mb-3 text-sm font-bold">{title}</p>
      {children}
    </div>
  );
}

function CheckboxList({
  name,
  options,
  selected,
  onChange,
}: {
  name: string;
  options: { value: string; label: string; count: number }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, 8);
  return (
    <div className="space-y-2.5">
      {visible.map((option) => {
        const id = `${name}-${option.value}`;
        const checked = selected.includes(option.value);
        return (
          <div key={option.value} className="flex items-center gap-2.5">
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={(value) =>
                onChange(value ? [...selected, option.value] : selected.filter((item) => item !== option.value))
              }
            />
            <Label htmlFor={id} className="flex flex-1 cursor-pointer items-center justify-between text-[13px] font-normal">
              <span>{option.label}</span>
              <span className="text-xs text-muted-foreground">{faNumber(option.count)}</span>
            </Label>
          </div>
        );
      })}
      {options.length > 8 ? (
        <button type="button" onClick={() => setExpanded(!expanded)} className="text-xs text-info hover:underline">
          {expanded ? 'نمایش کمتر' : `نمایش همه (${faNumber(options.length)})`}
        </button>
      ) : null}
    </div>
  );
}

function PriceFilter({ state, range, onApply }: { state: ListingState; range: { min: number; max: number } | null; onApply: (min?: number, max?: number) => void }) {
  const toToman = (rial?: number) => (rial === undefined ? '' : String(Math.floor(rial / 10)));
  const [min, setMin] = useState(toToman(state.minPrice));
  const [max, setMax] = useState(toToman(state.maxPrice));
  const parse = (value: string) => {
    const digits = value.replace(/[^\d۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    return digits ? Number(digits) * 10 : undefined;
  };
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(parse(min), parse(max));
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <Input inputMode="numeric" placeholder="از (تومان)" value={min} onChange={(e) => setMin(e.target.value)} aria-label="حداقل قیمت" className="h-9 text-xs" />
        <Input inputMode="numeric" placeholder="تا (تومان)" value={max} onChange={(e) => setMax(e.target.value)} aria-label="حداکثر قیمت" className="h-9 text-xs" />
      </div>
      {range ? (
        <p className="text-[11px] text-muted-foreground">
          محدوده: {priceNumber(range.min)} تا {priceNumber(range.max)} تومان
        </p>
      ) : null}
      <Button type="submit" variant="secondary" size="sm" className="w-full">
        اعمال قیمت
      </Button>
    </form>
  );
}

function FiltersBody({ state, facets, linkCategories, hideBrand }: FiltersProps) {
  const { navigate, pending } = useListingNavigation(state);
  return (
    <div className={cn('transition-opacity', pending && 'pointer-events-none opacity-60')}>
      <FacetGroup title="وضعیت کالا">
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center justify-between text-[13px]">
            فقط کالاهای موجود
            <Switch checked={state.inStock} onCheckedChange={(inStock) => navigate({ inStock })} aria-label="فقط کالاهای موجود" />
          </label>
          <label className="flex cursor-pointer items-center justify-between text-[13px]">
            فقط تخفیف‌دار
            <Switch checked={state.onSale} onCheckedChange={(onSale) => navigate({ onSale })} aria-label="فقط تخفیف‌دار" />
          </label>
        </div>
      </FacetGroup>

      {facets.categories.length > 0 && linkCategories ? (
        <FacetGroup title="دسته‌بندی">
          <ul className="space-y-2 text-[13px]">
            {facets.categories.map((category) => (
              <li key={category.value}>
                <Link href={`/category/${category.value}`} className="flex items-center justify-between hover:text-primary">
                  <span>{category.label}</span>
                  <span className="text-xs text-muted-foreground">{faNumber(category.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </FacetGroup>
      ) : null}

      {!hideBrand && facets.brands.length > 0 ? (
        <FacetGroup title="برند">
          <CheckboxList name="brand" options={facets.brands} selected={state.brand} onChange={(brand) => navigate({ brand })} />
        </FacetGroup>
      ) : null}

      <FacetGroup title="محدوده قیمت">
        <PriceFilter state={state} range={facets.price} onApply={(minPrice, maxPrice) => navigate({ minPrice, maxPrice })} />
      </FacetGroup>

      {facets.attributes.map((facet) => (
        <FacetGroup key={facet.code} title={facet.name}>
          <CheckboxList
            name={facet.code}
            options={facet.values}
            selected={state.attributes[facet.code] ?? []}
            onChange={(values) => {
              const attributes = { ...state.attributes, [facet.code]: values };
              if (values.length === 0) delete attributes[facet.code];
              navigate({ attributes });
            }}
          />
        </FacetGroup>
      ))}
    </div>
  );
}

export function ListingFilters(props: FiltersProps) {
  return (
    <aside className="hidden w-64 shrink-0 lg:block" aria-label="فیلترها">
      <div className="sticky top-40 max-h-[calc(100vh-11rem)] overflow-y-auto rounded-lg border border-border bg-card p-4">
        <FiltersBody {...props} />
      </div>
    </aside>
  );
}

export function MobileFilters(props: FiltersProps & { activeCount: number }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <SlidersHorizontal /> فیلترها
          {props.activeCount > 0 ? <span className="rounded-full bg-accent px-1.5 text-[11px] text-accent-foreground">{faNumber(props.activeCount)}</span> : null}
        </Button>
      </DialogTrigger>
      <SheetContent title="فیلترها" side="end" aria-describedby={undefined}>
        <div className="p-4">
          <FiltersBody {...props} />
        </div>
      </SheetContent>
    </Dialog>
  );
}
