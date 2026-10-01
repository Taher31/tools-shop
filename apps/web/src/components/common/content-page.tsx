import type { ContentPageView } from '@toolshop/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serverApiOrNull } from '@/lib/api/server';
import { date } from '@/lib/format';
import { Breadcrumbs } from './breadcrumbs';

export const loadContentPage = (slug: string) =>
  serverApiOrNull<ContentPageView>(`/pages/${slug}`, { revalidate: 300, tags: [`page:${slug}`] });

export async function contentPageMetadata(slug: string): Promise<Metadata> {
  const page = await loadContentPage(slug);
  return page
    ? {
        title: page.seoTitle ?? page.title,
        description: page.seoDescription ?? undefined,
        alternates: { canonical: `/${slug}` },
      }
    : { title: 'صفحه یافت نشد' };
}

/** CMS page (body is sanitized HTML stored by the API). */
export async function ContentPage({ slug }: { slug: string }) {
  const page = await loadContentPage(slug);
  if (!page) notFound();
  return (
    <div className="container-page max-w-4xl py-6">
      <Breadcrumbs items={[{ name: page.title }]} />
      <article className="border-border bg-card rounded-lg border p-6 md:p-10">
        <h1 className="mb-2 text-2xl font-extrabold">{page.title}</h1>
        <p className="text-muted-foreground mb-6 text-xs">
          آخرین به‌روزرسانی: {date(page.updatedAt)}
        </p>
        <div className="prose-content" dangerouslySetInnerHTML={{ __html: page.body }} />
      </article>
    </div>
  );
}
