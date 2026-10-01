import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { JsonLd } from './json-ld';

export interface Crumb {
  name: string;
  href?: string;
}

/** Visible breadcrumb trail + BreadcrumbList structured data. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ name: 'خانه', href: '/' }, ...items];
  return (
    <>
      <nav aria-label="مسیر" className="mb-4 overflow-x-auto">
        <ol className="text-muted-foreground flex items-center gap-1 whitespace-nowrap text-xs">
          {all.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <ChevronLeft className="size-3.5 opacity-60" /> : null}
              {item.href && index < all.length - 1 ? (
                <Link href={item.href} className="hover:text-primary">
                  {item.name}
                </Link>
              ) : (
                <span
                  className={index === all.length - 1 ? 'text-foreground font-medium' : undefined}
                >
                  {item.name}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: all.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            ...(item.href ? { item: `${siteConfig.url}${item.href}` } : {}),
          })),
        }}
      />
    </>
  );
}
