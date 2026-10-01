'use client';

import { useQuery } from '@tanstack/react-query';
import type { SearchSuggestion } from '@toolshop/shared';
import { cn } from '@toolshop/ui';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { api, toQueryString } from '@/lib/api/client';
import { price } from '@/lib/format';

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Header search with instant suggestions (products + categories) from the search engine. */
export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get('q') ?? '');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const term = useDebounced(value.trim(), 200);

  const { data } = useQuery({
    queryKey: ['suggest', term],
    queryFn: ({ signal }) => api.get<SearchSuggestion>(`/search/suggest${toQueryString({ q: term })}`, signal),
    enabled: term.length >= 2,
    staleTime: 60_000,
  });

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = value.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/search${toQueryString({ q })}`);
  };

  const hasResults = Boolean(data && (data.products.length > 0 || data.categories.length > 0));

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <form role="search" onSubmit={submit} className="relative">
        <input
          type="search"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="جستجوی محصول، مدل، برند یا کد کالا…"
          aria-label="جستجو"
          aria-controls={listId}
          aria-expanded={open && hasResults}
          autoComplete="off"
          className="h-11 w-full rounded-md border border-input bg-muted/60 ps-4 pe-12 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <button
          type="submit"
          className="absolute end-1 top-1 flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary-hover"
          aria-label="جستجو"
        >
          <Search className="size-4" />
        </button>
      </form>

      {open && term.length >= 2 && hasResults && data ? (
        <div id={listId} className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-xl">
          {data.categories.length > 0 ? (
            <div className="border-b border-border p-2">
              <p className="px-2 pb-1 text-xs text-muted-foreground">دسته‌بندی‌ها</p>
              <div className="flex flex-wrap gap-1.5 px-2">
                {data.categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/category/${category.slug}`}
                    onClick={() => setOpen(false)}
                    className="rounded-sm bg-secondary px-2.5 py-1 text-xs hover:bg-primary hover:text-primary-foreground"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          <ul className="max-h-96 overflow-y-auto py-1">
            {data.products.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/product/${product.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt="" className="size-10 object-contain" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-sm">{product.title}</span>
                    <span className={cn('text-xs', product.inStock ? 'text-foreground' : 'text-muted-foreground')}>
                      {product.inStock ? price(product.price) : 'ناموجود'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={submit}
            className="w-full border-t border-border bg-muted/50 px-3 py-2 text-center text-xs font-medium text-info hover:bg-muted"
          >
            مشاهده همه نتایج «{value.trim()}»
          </button>
        </div>
      ) : null}
    </div>
  );
}
