'use client';

import { Badge, Button, cn, Dialog, DialogTrigger, SheetContent, Skeleton } from '@toolshop/ui';
import { ExternalLink, LogOut, Menu, Wrench } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useLogout } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { faNumber } from '@/lib/format';
import { ADMIN_NAV } from './nav';

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = usePermissions();
  const phaseLabel = { 2: 'فاز ۲', 3: 'فاز ۳', 4: 'فاز ۴' } as const;
  const tickets = useQuery({
    queryKey: ['admin', 'tickets', 'counters'],
    queryFn: () => api.get<{ unread: number }>('/admin/tickets/counters'),
    enabled: can('ticket.read'),
    refetchInterval: 60_000,
  });
  const counters = { tickets: tickets.data?.unread ?? 0 };
  return (
    <nav className="space-y-5 p-3 text-sm" aria-label="منوی مدیریت">
      {ADMIN_NAV.map((group) => {
        const items = group.items.filter(
          (item) => item.phase || !item.permission || can(item.permission),
        );
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="text-sidebar-foreground/50 mb-1.5 px-3 text-[11px] font-semibold tracking-wide">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active =
                  item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                if (item.phase) {
                  return (
                    <li key={item.href}>
                      <span
                        className="text-sidebar-foreground/35 flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2"
                        title="در فازهای بعدی توسعه"
                      >
                        <item.icon className="size-4" />
                        {item.label}
                        <Badge
                          variant="outline"
                          className="text-sidebar-foreground/40 ms-auto border-white/10 px-1.5 text-[10px]"
                        >
                          {phaseLabel[item.phase]}
                        </Badge>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors',
                        active
                          ? 'bg-accent text-accent-foreground font-semibold'
                          : 'text-sidebar-foreground hover:bg-white/5 hover:text-white',
                      )}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                      {item.counter && counters[item.counter] > 0 ? (
                        <Badge variant="info" className="ms-auto px-1.5 text-[10px]">
                          {faNumber(counters[item.counter])}
                        </Badge>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (user.type !== 'staff') router.replace('/');
  }, [isLoading, user, router, pathname]);

  const ready = user?.type === 'staff';
  const brand = (
    <Link
      href="/admin"
      className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5 font-extrabold text-white"
    >
      <span className="bg-accent text-accent-foreground flex size-8 items-center justify-center rounded-md">
        <Wrench className="size-4" />
      </span>
      پنل مدیریت
    </Link>
  );

  return (
    <div className="bg-background flex min-h-dvh">
      <aside className="bg-sidebar sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto lg:flex">
        {brand}
        {ready ? <SidebarNav /> : null}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-card sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 lg:px-6">
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="منو">
                <Menu />
              </Button>
            </DialogTrigger>
            <SheetContent
              title="منوی مدیریت"
              className="bg-sidebar text-sidebar-foreground"
              aria-describedby={undefined}
            >
              <SidebarNav onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Dialog>
          <div className="ms-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/" target="_blank">
                <ExternalLink /> مشاهده فروشگاه
              </Link>
            </Button>
            {user ? (
              <div className="hidden text-end text-xs sm:block">
                <p className="font-bold">{user.fullName}</p>
                <p className="text-muted-foreground">{user.roles.join('، ')}</p>
              </div>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-label="خروج"
              onClick={() =>
                logout.mutate(undefined, { onSettled: () => router.replace('/login') })
              }
            >
              <LogOut />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">
          {ready ? children : <Skeleton className="h-96" />}
        </main>
      </div>
    </div>
  );
}
