import type { FaqItemView } from '@toolshop/shared';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@toolshop/ui';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { JsonLd } from '@/components/common/json-ld';
import { serverApi } from '@/lib/api/server';

export const metadata: Metadata = {
  title: 'سوالات متداول',
  description: 'پاسخ پرسش‌های رایج درباره سفارش، ارسال، پرداخت، گارانتی و مرجوعی کالا.',
  alternates: { canonical: '/faq' },
};

export default async function FaqPage() {
  const items = await serverApi<FaqItemView[]>('/faq', { revalidate: 300, tags: ['faq'] });
  const groups = new Map<string, FaqItemView[]>();
  for (const item of items)
    groups.set(item.category ?? 'عمومی', [...(groups.get(item.category ?? 'عمومی') ?? []), item]);

  return (
    <div className="container-page max-w-4xl py-6">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        }}
      />
      <Breadcrumbs items={[{ name: 'سوالات متداول' }]} />
      <h1 className="mb-6 text-2xl font-extrabold">سوالات متداول</h1>
      <div className="space-y-6">
        {[...groups.entries()].map(([group, questions]) => (
          <section key={group} className="border-border bg-card rounded-lg border px-5">
            <h2 className="border-border text-primary border-b py-3 font-bold">{group}</h2>
            <Accordion type="single" collapsible>
              {questions.map((item) => (
                <AccordionItem key={item.id} value={item.id} className="last:border-0">
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>
    </div>
  );
}
