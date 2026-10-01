import type { HomePageData } from '@toolshop/shared';
import { Button } from '@toolshop/ui';
import { BadgePercent, Headphones, ShieldCheck, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { JsonLd } from '@/components/common/json-ld';
import { Section } from '@/components/common/section';
import { ProductGrid } from '@/components/product/product-card';
import { siteConfig } from '@/config/site';
import { serverApi } from '@/lib/api/server';
import { getSettings } from '@/lib/store';

const TRUST_ITEMS = [
  { icon: ShieldCheck, title: 'ضمانت اصالت', text: 'کالای اصلی با گارانتی معتبر' },
  { icon: Truck, title: 'ارسال سریع', text: 'به سراسر کشور' },
  { icon: Headphones, title: 'مشاوره فنی', text: 'پیش و پس از خرید' },
  { icon: BadgePercent, title: 'قیمت رقابتی', text: 'برای همکاران و پروژه‌ها' },
];

export default async function HomePage() {
  const [home, settings] = await Promise.all([
    serverApi<HomePageData>('/home', { tags: ['home'] }),
    getSettings(),
  ]);
  const storeName = settings.store.storeName;

  return (
    <>
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: storeName,
            url: siteConfig.url,
            ...(settings.store.supportPhone ? { telephone: settings.store.supportPhone } : {}),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: storeName,
            url: siteConfig.url,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${siteConfig.url}/search?q={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          },
        ]}
      />

      <section className="bg-primary text-primary-foreground relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'repeating-linear-gradient(135deg, #fff 0 2px, transparent 2px 18px)',
          }}
        />
        <div className="container-page relative grid items-center gap-8 py-10 md:grid-cols-2 md:py-16">
          <div>
            <p className="bg-accent text-accent-foreground mb-3 inline-block rounded-sm px-2.5 py-1 text-xs font-bold">
              تأمین‌کننده تخصصی ابزار
            </p>
            <h1 className="text-3xl font-extrabold leading-[1.5] md:text-4xl">
              ابزار حرفه‌ای برای
              <br />
              کار دقیق و بدون توقف
            </h1>
            <p className="text-primary-foreground/80 mt-4 max-w-lg text-sm leading-8 md:text-base">
              {settings.store.tagline ??
                'ابزار برقی، دستی و مصرفی با مشخصات فنی کامل، موجودی واقعی انبار و ارسال به سراسر کشور.'}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild variant="accent" size="lg">
                <Link href="/products">مشاهده محصولات</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-white/30 bg-transparent text-white hover:bg-white/10"
              >
                <Link href="/products?onSale=true">پیشنهادهای ویژه</Link>
              </Button>
            </div>
          </div>
          <div className="relative mx-auto hidden aspect-square w-full max-w-sm md:block">
            <div className="absolute inset-6 rounded-full bg-white/5" />
            <Image
              src="/placeholders/drill.svg"
              alt=""
              fill
              unoptimized
              priority
              className="object-contain p-6 drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

      <div className="border-border bg-card border-b">
        <div className="container-page grid grid-cols-2 gap-4 py-5 lg:grid-cols-4">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title} className="flex items-center gap-3">
              <span className="bg-secondary text-primary flex size-11 shrink-0 items-center justify-center rounded-md">
                <item.icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-bold">{item.title}</p>
                <p className="text-muted-foreground text-xs">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="container-page space-y-12 py-10">
        <Section title="دسته‌بندی محصولات">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {home.categories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="border-border bg-card hover:border-primary group flex flex-col items-center gap-3 rounded-lg border p-4 text-center transition-colors"
              >
                <span className="bg-muted group-hover:bg-secondary relative size-20 rounded-full transition-colors">
                  {category.imageUrl ? (
                    <Image
                      src={category.imageUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-contain p-3"
                    />
                  ) : null}
                </span>
                <span className="text-sm font-bold">{category.name}</span>
              </Link>
            ))}
          </div>
        </Section>

        {home.featured.length > 0 ? (
          <Section title="محصولات منتخب" href="/products?sort=bestselling">
            <ProductGrid products={home.featured} />
          </Section>
        ) : null}

        {home.onSale.length > 0 ? (
          <Section title="تخفیف‌دار" href="/products?onSale=true">
            <ProductGrid products={home.onSale.slice(0, 4)} />
          </Section>
        ) : null}

        <Section title="جدیدترین محصولات" href="/products?sort=newest">
          <ProductGrid products={home.newest} />
        </Section>

        {home.brands.length > 0 ? (
          <Section title="برندها">
            <div className="flex flex-wrap gap-3">
              {home.brands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/brand/${brand.slug}`}
                  className="border-border bg-card hover:border-primary flex min-w-36 flex-col items-center rounded-lg border px-5 py-4 transition-colors"
                >
                  <span className="text-primary font-extrabold">{brand.name}</span>
                  {brand.englishName ? (
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">
                      {brand.englishName}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </>
  );
}
