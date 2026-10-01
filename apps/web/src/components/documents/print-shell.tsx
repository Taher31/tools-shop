'use client';

import { Button } from '@toolshop/ui';
import { ArrowRight, Printer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

/** A4 page with a toolbar that is hidden when printing (browser "Save as PDF" works too). */
export function PrintShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <div className="bg-muted min-h-dvh py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-between gap-2 px-4 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowRight /> بازگشت
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> چاپ / ذخیره PDF
        </Button>
      </div>
      <article className="mx-auto max-w-[210mm] bg-white p-[12mm] text-[12px] leading-6 text-black shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {children}
      </article>
    </div>
  );
}

export function PartyBox({
  title,
  rows,
}: {
  title: string;
  rows: [string, string | null | undefined][];
}) {
  const visible = rows.filter(([, value]) => value);
  return (
    <section className="border border-black/70">
      <h2 className="border-b border-black/70 bg-black/5 px-3 py-1 text-center font-bold">
        {title}
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5 px-3 py-2 sm:grid-cols-3">
        {visible.map(([label, value]) => (
          <div key={label} className="flex gap-1.5">
            <dt className="text-black/60">{label}:</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
