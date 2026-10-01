import type { ProductDetail } from '@toolshop/shared';
import { USAGE_TYPE_LABELS } from '@toolshop/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@toolshop/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { JsonLd } from '@/components/common/json-ld';
import { Section } from '@/components/common/section';
import { QuestionsSection, ReviewsSection } from '@/components/product/feedback-sections';
import { ProductGallery } from '@/components/product/gallery';
import { ProductGrid } from '@/components/product/product-card';
import { PurchasePanel } from '@/components/product/purchase-panel';
import { RatingSummary } from '@/components/product/rating';
import { SpecTable } from '@/components/product/spec-table';
import { siteConfig } from '@/config/site';
import { serverApiOrNull } from '@/lib/api/server';
import { faNumber } from '@/lib/format';

interface Props {
  params: Promise<{ slug: string }>;
}

const loadProduct = (slug: string) =>
  serverApiOrNull<ProductDetail>(`/products/${encodeURIComponent(slug)}`, { revalidate: 30, tags: [`product:${slug}`] });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await loadProduct(decodeURIComponent((await params).slug));
  if (!product) return { title: 'محصول یافت نشد' };
  const image = product.images[0]?.url;
  return {
    title: product.seo.title,
    description: product.seo.description ?? undefined,
    alternates: { canonical: product.seo.canonicalUrl ?? `/product/${product.slug}` },
    openGraph: {
      type: 'website',
      title: product.title,
      description: product.seo.description ?? undefined,
      images: image ? [{ url: image, alt: product.title }] : undefined,
    },
  };
}

function productJsonLd(product: ProductDetail) {
  const prices = product.variants.map((v) => v.price);
  const inStock = product.variants.some((v) => v.availability !== 'out_of_stock');
  const url = `${siteConfig.url}/product/${product.slug}`;
  const availability = inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.shortDescription ?? undefined,
    sku: product.variants[0]?.sku,
    mpn: product.model ?? undefined,
    image: product.images.map((image) => (image.url.startsWith('http') ? image.url : `${siteConfig.url}${image.url}`)),
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    category: product.breadcrumbs.map((b) => b.name).join(' > '),
    offers:
      product.variants.length > 1
        ? {
            '@type': 'AggregateOffer',
            priceCurrency: 'IRR',
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: product.variants.length,
            availability,
            url,
          }
        : { '@type': 'Offer', priceCurrency: 'IRR', price: prices[0], availability, url, itemCondition: 'https://schema.org/NewCondition' },
    aggregateRating:
      product.rating.average && product.rating.count > 0
        ? { '@type': 'AggregateRating', ratingValue: product.rating.average, reviewCount: product.rating.count }
        : undefined,
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await loadProduct(decodeURIComponent((await params).slug));
  if (!product) notFound();

  const crumbs = [
    ...product.breadcrumbs.map((crumb) => ({ name: crumb.name, href: `/category/${crumb.slug}` })),
    { name: product.title },
  ];
  const facts = [
    product.brand ? { label: 'برند', value: product.brand.name, href: `/brand/${product.brand.slug}` } : null,
    product.model ? { label: 'مدل', value: product.model } : null,
    product.usageType ? { label: 'کاربری', value: USAGE_TYPE_LABELS[product.usageType] } : null,
    product.countryOfOrigin ? { label: 'کشور سازنده', value: product.countryOfOrigin } : null,
  ].filter((fact): fact is { label: string; value: string; href?: string } => fact !== null);

  return (
    <div className="container-page py-6">
      <JsonLd data={productJsonLd(product)} />
      <Breadcrumbs items={crumbs} />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <ProductGallery images={product.images} title={product.title} />
        </div>

        <div className="lg:col-span-4">
          <h1 className="text-xl leading-9 font-extrabold">{product.title}</h1>
          {product.englishTitle ? <p className="ltr mt-1 text-end text-sm text-muted-foreground">{product.englishTitle}</p> : null}
          <div className="mt-2">
            <RatingSummary average={product.rating.average} count={product.rating.count} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {facts.map((fact) => (
              <div key={fact.label} className="rounded-md bg-card px-3 py-2 ring-1 ring-border">
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd className="font-semibold">
                  {fact.href ? (
                    <Link href={fact.href} className="text-info hover:underline">
                      {fact.value}
                    </Link>
                  ) : (
                    fact.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {product.shortDescription ? <p className="mt-4 text-sm leading-8 text-foreground/85">{product.shortDescription}</p> : null}
          {product.specs.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-sm font-bold">ویژگی‌های کلیدی</p>
              <ul className="space-y-1.5 text-sm">
                {product.specs.slice(0, 6).map((spec) => (
                  <li key={spec.attributeId} className="flex gap-2">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="text-muted-foreground">{spec.name}:</span>
                    <span className="font-medium">{spec.value}</span>
                  </li>
                ))}
              </ul>
              {product.specs.length > 6 ? (
                <a href="#specs" className="mt-2 inline-block text-xs text-info hover:underline">
                  مشاهده همه {faNumber(product.specs.length)} مشخصه فنی
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-3">
          <div className="lg:sticky lg:top-40">
            <PurchasePanel initial={product} />
          </div>
        </div>
      </div>

      <div id="specs" className="mt-10 scroll-mt-40 rounded-lg border border-border bg-card px-4 pb-6 sm:px-6">
        <Tabs defaultValue={product.specs.length > 0 ? 'specs' : 'description'} dir="rtl">
          <TabsList>
            {product.specs.length > 0 ? <TabsTrigger value="specs">مشخصات فنی</TabsTrigger> : null}
            <TabsTrigger value="description">معرفی محصول</TabsTrigger>
            <TabsTrigger value="reviews">نظرات {product.rating.count > 0 ? `(${faNumber(product.rating.count)})` : ''}</TabsTrigger>
            <TabsTrigger value="questions">پرسش و پاسخ</TabsTrigger>
          </TabsList>
          {product.specs.length > 0 ? (
            <TabsContent value="specs">
              <SpecTable specs={product.specs} />
            </TabsContent>
          ) : null}
          <TabsContent value="description">
            {product.description ? (
              <div className="prose-content max-w-4xl" dangerouslySetInnerHTML={{ __html: product.description }} />
            ) : (
              <p className="text-sm text-muted-foreground">توضیحاتی برای این محصول ثبت نشده است.</p>
            )}
            {product.videoUrl ? (
              <a href={product.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-info hover:underline">
                مشاهده ویدیوی معرفی محصول
              </a>
            ) : null}
          </TabsContent>
          <TabsContent value="reviews">
            <ReviewsSection productId={product.id} />
          </TabsContent>
          <TabsContent value="questions">
            <QuestionsSection productId={product.id} />
          </TabsContent>
        </Tabs>
      </div>

      {product.accessories.length > 0 ? (
        <Section title="لوازم جانبی و اقلام سازگار" className="mt-10">
          <ProductGrid products={product.accessories} />
        </Section>
      ) : null}
      {product.related.length > 0 ? (
        <Section title="محصولات مرتبط" className="mt-10">
          <ProductGrid products={product.related} />
        </Section>
      ) : null}
    </div>
  );
}
