import type { CategoryTreeNode, PublicSettings } from '@toolshop/shared';
import { Headphones, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { BrandLogo } from './brand-logo';

const SERVICE_LINKS = [
  { href: '/faq', label: 'سوالات متداول' },
  { href: '/returns', label: 'شرایط مرجوعی کالا' },
  { href: '/shipping', label: 'شیوه‌های ارسال' },
  { href: '/warranty', label: 'گارانتی و خدمات پس از فروش' },
  { href: '/account/orders', label: 'پیگیری سفارش' },
];

const ABOUT_LINKS = [
  { href: '/about', label: 'درباره ما' },
  { href: '/contact', label: 'تماس با ما' },
  { href: '/terms', label: 'قوانین و مقررات' },
  { href: '/privacy', label: 'حریم خصوصی' },
];

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'اینستاگرام',
  telegram: 'تلگرام',
  eitaa: 'ایتا',
  bale: 'بله',
  aparat: 'آپارات',
  linkedin: 'لینکدین',
};

export function SiteFooter({
  settings,
  tree,
}: {
  settings: PublicSettings;
  tree: CategoryTreeNode[];
}) {
  const { store, legal } = settings;
  const socials = Object.entries(store.socials).filter((entry): entry is [string, string] =>
    Boolean(entry[1]),
  );
  const year = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    timeZone: 'Asia/Tehran',
  }).format(new Date());

  return (
    <footer className="bg-footer text-footer-foreground mt-16">
      <div className="border-b border-white/10">
        <div className="container-page grid gap-4 py-6 text-sm sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: 'ضمانت اصالت کالا',
              text: 'تأمین مستقیم از نمایندگی‌های معتبر',
            },
            {
              icon: Headphones,
              title: 'مشاوره فنی پیش از خرید',
              text: 'انتخاب ابزار مناسب کار شما',
            },
            { icon: MapPin, title: 'ارسال به سراسر کشور', text: 'پست، تیپاکس، باربری و پیک' },
          ].map((item) => (
            <div key={item.title} className="flex items-center gap-3">
              <item.icon className="text-accent size-8 shrink-0" strokeWidth={1.6} />
              <div>
                <p className="font-bold text-white">{item.title}</p>
                <p className="text-xs">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="container-page grid gap-10 py-10 md:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <BrandLogo name={store.storeName} logoUrl={store.logoUrl} inverted />
          {store.tagline ? <p className="mt-4 text-sm leading-7">{store.tagline}</p> : null}
          <ul className="mt-5 space-y-2.5 text-sm">
            {store.supportPhone ? (
              <li className="flex items-center gap-2">
                <Phone className="text-accent size-4" />
                <a
                  href={`tel:${store.supportPhone.replace(/[^\d+]/g, '')}`}
                  className="ltr hover:text-white"
                >
                  {store.supportPhone}
                </a>
              </li>
            ) : null}
            {store.supportEmail ? (
              <li className="flex items-center gap-2">
                <Mail className="text-accent size-4" />
                <a href={`mailto:${store.supportEmail}`} className="hover:text-white">
                  {store.supportEmail}
                </a>
              </li>
            ) : null}
            {store.address ? (
              <li className="flex items-start gap-2">
                <MapPin className="text-accent mt-1 size-4 shrink-0" />
                <span>{store.address}</span>
              </li>
            ) : null}
          </ul>
        </div>

        <FooterColumn title="خدمات مشتریان" links={SERVICE_LINKS} className="lg:col-span-2" />
        <FooterColumn
          title="دسته‌بندی‌ها"
          links={tree.map((category) => ({
            href: `/category/${category.slug}`,
            label: category.name,
          }))}
          className="lg:col-span-2"
        />
        <FooterColumn title="فروشگاه" links={ABOUT_LINKS} className="lg:col-span-2" />

        <div className="lg:col-span-2">
          <p className="mb-4 font-bold text-white">نمادهای اعتماد</p>
          <div className="flex flex-wrap gap-3">
            {legal.trustBadges.length > 0
              ? legal.trustBadges.map((badge) => (
                  <a
                    key={badge.title}
                    href={badge.linkUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer origin"
                    referrerPolicy="origin"
                    className="flex size-24 items-center justify-center rounded-md bg-white p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={badge.imageUrl}
                      alt={badge.title}
                      referrerPolicy="origin"
                      className="max-h-full max-w-full"
                    />
                  </a>
                ))
              : ['اینماد', 'ساماندهی'].map((label) => (
                  <div
                    key={label}
                    className="flex size-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-white/25 text-center text-[11px]"
                  >
                    <ShieldCheck className="size-6 text-white/40" />
                    محل نماد {label}
                  </div>
                ))}
          </div>
          {socials.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              {socials.map(([key, url]) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:border-accent rounded-sm border border-white/20 px-2.5 py-1 hover:text-white"
                >
                  {SOCIAL_LABELS[key] ?? key}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {store.storeName}. تمامی حقوق محفوظ است.
          </p>
          {legal.companyName || legal.licenses ? (
            <p className="text-footer-foreground/70">
              {[
                legal.companyName,
                legal.registrationNumber && `شماره ثبت ${legal.registrationNumber}`,
                legal.licenses,
              ]
                .filter(Boolean)
                .join(' — ')}
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  className,
}: {
  title: string;
  links: { href: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-4 font-bold text-white">{title}</p>
      <ul className="space-y-2.5 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
