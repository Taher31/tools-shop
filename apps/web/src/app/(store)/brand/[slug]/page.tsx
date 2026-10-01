import type { BrandSummary } from '@toolshop/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { ProductListing } from '@/components/catalog/product-listing';
import { serverApiOrNull } from '@/lib/api/server';
import { hasActiveFilters, parseListingParams, type RawSearchParams } from '@/lib/listing';

type BrandPage = BrandSummary & { description: string | null; country: string | null };

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}

const loadBrand = (slug: string) => serverApiOrNull<BrandPage>(`/brands/${encodeURIComponent(slug)}`, { revalidate: 300 });

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const brand = await loadBrand(decodeURIComponent((await params).slug));
  if (!brand) return { title: 'برند یافت نشد' };
  return {
    title: `محصولات ${brand.name}${brand.englishName ? ` (${brand.englishName})` : ''}`,
    description: brand.description ?? `خرید ابزار ${brand.name} با گارانتی معتبر.`,
    alternates: { canonical: `/brand/${brand.slug}` },
    robots: hasActiveFilters(parseListingParams(await searchParams)) ? { index: false, follow: true } : undefined,
  };
}

export default async function BrandRoute({ params, searchParams }: Props) {
  const brand = await loadBrand(decodeURIComponent((await params).slug));
  if (!brand) notFound();
  const state = parseListingParams(await searchParams);
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ name: 'برندها', href: '/products' }, { name: brand.name }]} />
      <div className="mb-5 rounded-lg border border-border bg-card p-5">
        <h1 className="text-xl font-extrabold">
          {brand.name}
          {brand.englishName ? <span className="ms-2 text-sm font-medium text-muted-foreground uppercase">{brand.englishName}</span> : null}
        </h1>
        {brand.description ? <p className="mt-1 text-sm leading-7 text-muted-foreground">{brand.description}</p> : null}
        {brand.country ? <p className="mt-1 text-xs text-muted-foreground">کشور: {brand.country}</p> : null}
      </div>
      <ProductListing state={state} basePath={`/brand/${brand.slug}`} brand={brand.slug} />
    </div>
  );
}
