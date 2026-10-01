import type { ProductSearchResult } from '@toolshop/shared';
import { Alert, Button, EmptyState } from '@toolshop/ui';
import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { ProductGrid } from '@/components/product/product-card';
import { serverApi } from '@/lib/api/server';
import { type ListingState, listingSearchParams } from '@/lib/listing';
import { ListingFilters } from './listing-filters';
import { ListingToolbar } from './listing-toolbar';
import { Pagination } from './pagination';

interface ProductListingProps {
  state: ListingState;
  /** Base path of the page (pagination links keep the current filters). */
  basePath: string;
  /** Fixed filters coming from the route (category or brand page). */
  category?: string;
  brand?: string;
}

export async function ProductListing({ state, basePath, category, brand }: ProductListingProps) {
  const apiParams = listingSearchParams({ ...state, brand: brand ? [brand] : state.brand });
  if (category) apiParams.set('category', category);
  apiParams.set('pageSize', '24');
  const result = await serverApi<ProductSearchResult>(`/products?${apiParams.toString()}`, { revalidate: 30 });
  const hrefFor = (page: number) => {
    const query = listingSearchParams({ ...state, page }).toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <div className="flex items-start gap-6">
      <ListingFilters state={state} facets={result.facets} hideBrand={Boolean(brand)} linkCategories />
      <div className="min-w-0 flex-1">
        <ListingToolbar state={state} result={result} hideBrand={Boolean(brand)} linkCategories />
        {result.engine === 'database' ? (
          <Alert variant="warning" className="mb-4">
            جستجوی پیشرفته موقتاً در دسترس نیست؛ نتایج به‌صورت ساده نمایش داده می‌شوند.
          </Alert>
        ) : null}
        {result.items.length > 0 ? (
          <>
            <ProductGrid products={result.items} className="xl:grid-cols-3 2xl:grid-cols-4" />
            <Pagination page={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />
          </>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState
              icon={<SearchX />}
              title="کالایی با این مشخصات پیدا نشد"
              description="فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید. می‌توانید از نام برند، مدل یا کد کالا هم استفاده کنید."
              action={
                <Button asChild variant="outline">
                  <Link href={basePath}>حذف فیلترها</Link>
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
