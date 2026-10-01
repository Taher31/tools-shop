/**
 * Build-time site configuration. Store identity (name, phone, address, socials, legal
 * info, trust badges) is NOT here: it is managed in Admin → Settings and read from the
 * API, so the database stays the single source of truth.
 */
export const siteConfig = {
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  /** Fallback used only if the settings API is unreachable. */
  fallbackName: 'فروشگاه ابزار',
  locale: 'fa_IR',
  defaultDescription:
    'خرید تخصصی ابزار برقی، ابزار دستی و ابزار مصرفی با ضمانت اصالت کالا و ارسال به سراسر ایران.',
} as const;
