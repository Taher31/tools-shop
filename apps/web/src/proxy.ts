import { type NextRequest, NextResponse } from 'next/server';

const SESSION_HINT = 'ts_session';
const CUSTOMER_AREAS = ['/account', '/checkout', '/print'];

/**
 * Optimistic routing only: sends visitors without a session hint to the login page.
 * It never grants access – the API authorizes every request (see apps/api guards).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hint = request.cookies.get(SESSION_HINT)?.value;
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${pathname}${search}`);

  if (pathname.startsWith('/admin')) {
    if (hint !== 'staff') return NextResponse.redirect(loginUrl);
    return NextResponse.next();
  }
  if (CUSTOMER_AREAS.some((area) => pathname === area || pathname.startsWith(`${area}/`))) {
    if (pathname.startsWith('/checkout/result')) return NextResponse.next();
    if (!hint) return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/checkout/:path*', '/checkout', '/print/:path*'],
};
