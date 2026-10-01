'use client';

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@toolshop/ui';
import {
  Heart,
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingCart,
  User,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useLogout } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import { faNumber } from '@/lib/format';

export function HeaderActions() {
  const { user } = useAuth();
  const logout = useLogout();
  const router = useRouter();
  const { data: cart } = useCart();
  const count = cart?.totals.itemsCount ?? 0;

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2 sm:px-3" aria-label="حساب کاربری">
              <UserRound className="size-5" />
              <span className="hidden max-w-28 truncate lg:inline">{user.firstName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>{user.fullName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user.type === 'staff' ? (
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <LayoutDashboard /> پنل مدیریت
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link href="/account">
                <User /> حساب کاربری
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/orders">
                <Package /> سفارش‌های من
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/wishlist">
                <Heart /> علاقه‌مندی‌ها
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => logout.mutate(undefined, { onSettled: () => router.push('/') })}
            >
              <LogOut /> خروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button asChild variant="outline" className="gap-2 px-2.5 sm:px-3">
          <Link href="/login">
            <User className="size-5" />
            <span className="hidden sm:inline">ورود | ثبت‌نام</span>
          </Link>
        </Button>
      )}

      <Button
        asChild
        variant="ghost"
        size="icon"
        className="hidden sm:inline-flex"
        aria-label="علاقه‌مندی‌ها"
      >
        <Link href="/wishlist">
          <Heart className="size-5" />
        </Link>
      </Button>

      <Button
        asChild
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={`سبد خرید، ${count} کالا`}
      >
        <Link href="/cart">
          <ShoppingCart className="size-5" />
          {count > 0 ? (
            <Badge
              variant="accent"
              className="absolute -end-1 -top-1 min-w-5 justify-center rounded-full px-1 text-[11px] leading-4"
            >
              {faNumber(count)}
            </Badge>
          ) : null}
        </Link>
      </Button>
    </div>
  );
}
