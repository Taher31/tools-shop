import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { ProductListing } from '@/components/catalog/product-listing';
import { parseListingParams, type RawSearchParams } from '@/lib/listing';

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }): Promise<Metadata> {
  const { q } = parseListingParams(await searchParams);
  return { title: q ? `جستجوی «${q}»` : 'جستجو', robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const state = parseListingParams(await searchParams);
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ name: 'جستجو' }]} />
      <h1 className="mb-5 text-xl font-extrabold">
        {state.q ? (
          <>
            نتایج جستجو برای <span className="text-primary">«{state.q}»</span>
          </>
        ) : (
          'جستجو'
        )}
      </h1>
      <ProductListing state={state} basePath="/search" />
    </div>
  );
}
