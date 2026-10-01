import type { CategoryTreeNode, PublicSettings } from '@toolshop/shared';
import { Clock, Phone } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { BrandLogo } from './brand-logo';
import { CategoryNav } from './category-nav';
import { HeaderActions } from './header-actions';
import { MobileMenu } from './mobile-menu';
import { SearchBox } from './search-box';

export function SiteHeader({ settings, tree }: { settings: PublicSettings; tree: CategoryTreeNode[] }) {
  const { store } = settings;
  return (
    <header className="sticky top-0 z-30 shadow-sm">
      <div className="hidden bg-topbar text-xs text-topbar-foreground md:block">
        <div className="container-page flex h-9 items-center justify-between">
          <div className="flex items-center gap-5">
            {store.supportPhone ? (
              <a href={`tel:${store.supportPhone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1.5 hover:text-white">
                <Phone className="size-3.5" />
                <span className="ltr">{store.supportPhone}</span>
              </a>
            ) : null}
            {store.workingHours ? (
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {store.workingHours}
              </span>
            ) : null}
          </div>
          <nav className="flex items-center gap-4" aria-label="لینک‌های سریع">
            <Link href="/account/orders" className="hover:text-white">
              پیگیری سفارش
            </Link>
            <Link href="/faq" className="hover:text-white">
              سوالات متداول
            </Link>
            <Link href="/contact" className="hover:text-white">
              تماس با ما
            </Link>
          </nav>
        </div>
      </div>

      <div className="border-b border-border bg-header">
        <div className="container-page flex h-16 items-center gap-3 lg:h-20 lg:gap-6">
          <MobileMenu tree={tree} />
          <BrandLogo name={store.storeName} logoUrl={store.logoUrl} tagline={store.tagline} />
          <Suspense fallback={<div className="hidden h-11 flex-1 md:block" />}>
            <SearchBox className="hidden max-w-2xl flex-1 md:block" />
          </Suspense>
          <div className="ms-auto">
            <HeaderActions />
          </div>
        </div>
        <div className="container-page pb-3 md:hidden">
          <Suspense fallback={<div className="h-11" />}>
            <SearchBox />
          </Suspense>
        </div>
      </div>

      <CategoryNav tree={tree} />
    </header>
  );
}
