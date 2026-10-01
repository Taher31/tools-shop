import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { getSettings } from '@/lib/store';

export const metadata: Metadata = { title: 'تماس با ما', alternates: { canonical: '/contact' } };

export default async function ContactPage() {
  const { store, legal } = await getSettings();
  const items = [
    store.supportPhone ? { icon: Phone, label: 'تلفن پشتیبانی', value: <a href={`tel:${store.supportPhone.replace(/[^\d+]/g, '')}`} className="ltr">{store.supportPhone}</a> } : null,
    store.supportEmail ? { icon: Mail, label: 'ایمیل', value: <a href={`mailto:${store.supportEmail}`}>{store.supportEmail}</a> } : null,
    store.workingHours ? { icon: Clock, label: 'ساعات پاسخگویی', value: store.workingHours } : null,
    store.address ? { icon: MapPin, label: 'آدرس', value: store.address } : null,
  ].filter((item) => item !== null);

  return (
    <div className="container-page max-w-4xl py-6">
      <Breadcrumbs items={[{ name: 'تماس با ما' }]} />
      <h1 className="mb-6 text-2xl font-extrabold">تماس با ما</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3 rounded-lg border border-border bg-card p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
              <item.icon className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <div className="mt-1 font-semibold">{item.value}</div>
            </div>
          </div>
        ))}
      </div>
      {legal.companyName ? <p className="mt-6 text-sm text-muted-foreground">{legal.companyName}</p> : null}
      <p className="mt-6 rounded-lg border border-border bg-card p-5 text-sm leading-7 text-muted-foreground">
        برای پیگیری سفارش‌ها به بخش <Link href="/account/orders" className="font-bold text-info hover:underline">سفارش‌های من</Link> مراجعه کنید.
        پاسخ پرسش‌های رایج در صفحه <Link href="/faq" className="font-bold text-info hover:underline">سوالات متداول</Link> آمده است.
      </p>
    </div>
  );
}
