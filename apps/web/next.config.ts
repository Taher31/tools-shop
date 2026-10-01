import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Development: a single .env at the repository root serves every app.
loadEnvConfig(path.resolve(__dirname, '../..'));

const apiUrl = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');

function remoteImagePatterns(): NonNullable<NextConfig['images']>['remotePatterns'] {
  const base = process.env.STORAGE_PUBLIC_BASE_URL;
  if (!base || base.startsWith('/')) return [];
  try {
    const url = new URL(base);
    if (url.hostname === 'localhost') return [];
    return [
      {
        protocol: url.protocol.replace(':', '') as 'http' | 'https',
        hostname: url.hostname,
        pathname: `${url.pathname.replace(/\/$/, '')}/**`,
      },
    ];
  } catch {
    return [];
  }
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // Docker images use the standalone server (NEXT_OUTPUT=standalone in the Dockerfile).
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  transpilePackages: ['@toolshop/ui'],
  poweredByHeader: false,
  images: {
    localPatterns: [{ pathname: '/uploads/**' }, { pathname: '/placeholders/**' }],
    remotePatterns: remoteImagePatterns(),
    formats: ['image/avif', 'image/webp'],
  },
  // The browser only ever talks to this origin: API calls and uploaded files are
  // proxied, so auth cookies stay first-party (SameSite=Lax) and no CORS is needed.
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${apiUrl}/api/v1/:path*` },
      { source: '/uploads/:path*', destination: `${apiUrl}/uploads/:path*` },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
