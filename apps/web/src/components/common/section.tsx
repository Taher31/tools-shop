import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function Section({
  title,
  href,
  linkLabel = 'مشاهده همه',
  children,
  className,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="border-border mb-4 flex items-center justify-between gap-4 border-b pb-3">
        <h2 className="before:bg-accent relative ps-3 text-lg font-extrabold before:absolute before:inset-y-1 before:start-0 before:w-1 before:rounded-full">
          {title}
        </h2>
        {href ? (
          <Link
            href={href}
            className="text-info flex items-center gap-0.5 text-sm font-medium hover:underline"
          >
            {linkLabel}
            <ChevronLeft className="size-4" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
