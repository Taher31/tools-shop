import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { getCategoryTree, getSettings } from '@/lib/store';

export default async function StoreLayout({ children }: { children: ReactNode }) {
  // Rendered per request (data comes from the API, cached in the Next.js data cache),
  // so builds never depend on a running API.
  await connection();
  const [settings, tree] = await Promise.all([getSettings(), getCategoryTree()]);
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader settings={settings} tree={tree} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter settings={settings} tree={tree} />
    </div>
  );
}
