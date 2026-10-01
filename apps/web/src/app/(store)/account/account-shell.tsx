'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge, Skeleton, cn } from '@toolshop/ui';
import { Heart, KeyRound, LifeBuoy, LogOut, MapPin, Package, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useAuth, useLogout } from '@/hooks/use-auth';
import { api } from '@/lib/api/client';
import { faNumber } from '@/lib/format';

const NAV = [
  { href: '/account', label: 'اطلاعات حساب', icon: UserRound, exact: true },
  { href: '/account/orders', label: 'سفارش‌های من', icon: Package },
  { href: '/account/tickets', label: 'پشتیبانی', icon: LifeBuoy },
  { href: '/account/addresses', label: 'آدرس‌ها', icon: MapPin },
  { href: '/wishlist', label: 'علاقه‌مندی‌ها', icon: Heart },
  { href: '/account/security', label: 'تغییر رمز عبور', icon: KeyRound },
];

export function AccountShell({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const unread = useQuery({
    queryKey: ['tickets', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/account/tickets/unread-count'),
    enabled: Boolean(user),
    refetchInterval: 120_000,
  });

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isLoading, user, router, pathname]);

  return (
    <div className="container-page grid grid-cols-[minmax(0,1fr)] items-start gap-6 py-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="border-border bg-card min-w-0 rounded-lg border">
        <div className="border-border border-b p-4">
          {user ? (
            <>
              <p className="font-bold">{user.fullName}</p>
              <p className="ltr text-muted-foreground text-end text-xs">
                {user.mobile ?? user.email}
              </p>
            </>
          ) : (
            <Skeleton className="h-10" />
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto p-2 lg:flex-col" aria-label="حساب کاربری">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2.5 text-sm',
                  active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                <item.icon className="size-4" /> {item.label}
                {item.href === '/account/tickets' && unread.data && unread.data.count > 0 ? (
                  <Badge
                    variant="info"
                    className="ms-auto px-1.5"
                    aria-label="پاسخ‌های خوانده‌نشده"
                  >
                    {faNumber(unread.data.count)}
                  </Badge>
                ) : null}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => logout.mutate(undefined, { onSettled: () => router.push('/') })}
            className="text-destructive hover:bg-destructive-soft flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2.5 text-sm"
          >
            <LogOut className="size-4" /> خروج
          </button>
        </nav>
      </aside>
      <div className="min-w-0">{user ? children : <Skeleton className="h-80" />}</div>
    </div>
  );
}
