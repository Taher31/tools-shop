import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { ProductListing } from '@/components/catalog/product-listing';
import { hasActiveFilters, parseListingParams, type RawSearchParams } from '@/lib/listing';

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }): Promise<Metadata> {
  const state = parseListingParams(await searchParams);
  return {
    title: state.onSale ? 'ابزارآلات تخفیف‌دار' : 'همه محصولات',
    description: 'فهرست کامل ابزار برقی، ابزار دستی و ابزار مصرفی با امکان فیلتر بر اساس برند، مشخصات فنی و قیمت.',
    alternates: { canonical: '/products' },
    robots: hasActiveFilters({ ...state, onSale: false }) ? { index: false, follow: true } : undefined,
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const state = parseListingParams(await searchParams);
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ name: 'همه محصولات' }]} />
      <h1 className="mb-5 text-xl font-extrabold">{state.onSale ? 'محصولات تخفیف‌دار' : 'همه محصولات'}</h1>
      <ProductListing state={state} basePath="/products" />
    </div>
  );
}
