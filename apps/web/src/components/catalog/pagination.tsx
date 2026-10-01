import { cn } from '@toolshop/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { faNumber } from '@/lib/format';

function pages(current: number, total: number): (number | 'gap')[] {
  const result: (number | 'gap')[] = [];
  for (let page = 1; page <= total; page += 1) {
    if (page === 1 || page === total || Math.abs(page - current) <= 1) result.push(page);
    else if (result[result.length - 1] !== 'gap') result.push('gap');
  }
  return result;
}

export function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (page: number) => string }) {
  if (totalPages <= 1) return null;
  const item = 'flex h-9 min-w-9 items-center justify-center rounded-md border border-border bg-card px-2 text-sm';
  return (
    <nav aria-label="صفحه‌بندی" className="mt-8 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(item, 'hover:border-primary')} aria-label="صفحه قبل" rel="prev">
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
      {pages(page, totalPages).map((entry, index) =>
        entry === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={hrefFor(entry)}
            aria-current={entry === page ? 'page' : undefined}
            className={cn(item, entry === page ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary')}
          >
            {faNumber(entry)}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={cn(item, 'hover:border-primary')} aria-label="صفحه بعد" rel="next">
          <ChevronLeft className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
