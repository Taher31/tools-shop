import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';
import { serverApi } from '@/lib/api/server';

interface SitemapData {
  products: { slug: string; updatedAt: string }[];
  categories: { slug: string; updatedAt: string }[];
  brands: { slug: string; updatedAt: string }[];
}

// Rendered per request (API data is cached for an hour by the fetch below), so builds
// never depend on a running API and a fresh deploy never serves an empty sitemap.
export const dynamic = 'force-dynamic';

const STATIC_PAGES = [
  '',
  '/products',
  '/about',
  '/contact',
  '/faq',
  '/terms',
  '/returns',
  '/shipping',
  '/warranty',
  '/privacy',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const pages: MetadataRoute.Sitemap = STATIC_PAGES.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.5,
  }));
  try {
    const data = await serverApi<SitemapData>('/catalog/sitemap', { revalidate: 3600 });
    return [
      ...pages,
      ...data.categories.map((c) => ({
        url: `${base}/category/${c.slug}`,
        lastModified: c.updatedAt,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      })),
      ...data.products.map((p) => ({
        url: `${base}/product/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: 'daily' as const,
        priority: 0.9,
      })),
      ...data.brands.map((b) => ({
        url: `${base}/brand/${b.slug}`,
        lastModified: b.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return pages;
  }
}
