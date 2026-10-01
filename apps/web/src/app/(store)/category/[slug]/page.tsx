import type { CategoryPage } from '@toolshop/shared';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { ProductListing } from '@/components/catalog/product-listing';
import { serverApiOrNull } from '@/lib/api/server';
import { hasActiveFilters, parseListingParams, type RawSearchParams } from '@/lib/listing';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}

const loadCategory = (slug: string) =>
  serverApiOrNull<CategoryPage>(`/categories/${encodeURIComponent(slug)}`, {
    revalidate: 300,
    tags: ['categories'],
  });

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadCategory(decodeURIComponent(slug));
  if (!page) return { title: 'دسته‌بندی یافت نشد' };
  const state = parseListingParams(await searchParams);
  return {
    title: page.category.seoTitle ?? `خرید ${page.category.name}`,
    description:
      page.category.seoDescription ??
      page.category.description ??
      `خرید انواع ${page.category.name} با مشخصات فنی کامل، مقایسه قیمت و موجودی واقعی.`,
    alternates: { canonical: `/category/${page.category.slug}` },
    robots: hasActiveFilters(state) ? { index: false, follow: true } : undefined,
    openGraph: {
      title: page.category.name,
      images: page.category.imageUrl ? [page.category.imageUrl] : undefined,
    },
  };
}

export default async function CategoryRoute({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = await loadCategory(decodeURIComponent(slug));
  if (!page) notFound();
  const state = parseListingParams(await searchParams);
  const crumbs = page.breadcrumbs.map((crumb, index) => ({
    name: crumb.name,
    href: index < page.breadcrumbs.length - 1 ? `/category/${crumb.slug}` : undefined,
  }));

  return (
    <div className="container-page py-6">
      <Breadcrumbs items={crumbs} />
      <div className="border-border bg-card mb-5 flex flex-col gap-4 rounded-lg border p-5 md:flex-row md:items-center">
        {page.category.imageUrl ? (
          <div className="bg-muted relative hidden size-16 shrink-0 rounded-full md:block">
            <Image
              src={page.category.imageUrl}
              alt=""
              fill
              unoptimized
              className="object-contain p-2"
            />
          </div>
        ) : null}
        <div className="flex-1">
          <h1 className="text-xl font-extrabold">{page.category.name}</h1>
          {page.category.description ? (
            <p className="text-muted-foreground mt-1 text-sm leading-7">
              {page.category.description}
            </p>
          ) : null}
        </div>
      </div>
      {page.children.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          {page.children.map((child) => (
            <Link
              key={child.id}
              href={`/category/${child.slug}`}
              className="border-border bg-card hover:border-primary hover:text-primary rounded-full border px-4 py-1.5 text-sm"
            >
              {child.name}
            </Link>
          ))}
        </div>
      ) : null}
      <ProductListing
        state={state}
        basePath={`/category/${page.category.slug}`}
        category={page.category.slug}
      />
    </div>
  );
}
