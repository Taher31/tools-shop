import '@fontsource-variable/vazirmatn';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.fallbackName, template: `%s | ${siteConfig.fallbackName}` },
  description: siteConfig.defaultDescription,
  applicationName: siteConfig.fallbackName,
  formatDetection: { telephone: false },
  openGraph: { type: 'website', locale: siteConfig.locale, siteName: siteConfig.fallbackName },
};

export const viewport: Viewport = {
  themeColor: '#0f2a44',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
