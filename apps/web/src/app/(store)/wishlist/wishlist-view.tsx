'use client';

import { useQuery } from '@tanstack/react-query';
import type { WishlistItem } from '@toolshop/shared';
import { Button, EmptyState, Skeleton } from '@toolshop/ui';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import { ProductCard } from '@/components/product/product-card';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api/client';

export function WishlistView() {
  const { user, isLoading: authLoading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['wishlist', 'items'],
    queryFn: () => api.get<WishlistItem[]>('/account/wishlist'),
    enabled: Boolean(user),
  });

  if (authLoading || (user && isLoading)) return <Skeleton className="h-72" />;
  if (!user) {
    return (
      <div className="border-border bg-card rounded-lg border">
        <EmptyState
          icon={<Heart />}
          title="برای مشاهده علاقه‌مندی‌ها وارد شوید"
          action={
            <Button asChild>
              <Link href="/login?next=/wishlist">ورود به حساب</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="border-border bg-card rounded-lg border">
        <EmptyState
          icon={<Heart />}
          title="فهرست علاقه‌مندی‌های شما خالی است"
          description="با زدن علامت قلب روی محصولات، آن‌ها را برای بعد ذخیره کنید."
        />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {data.map((item) => (
        <ProductCard key={item.productId} product={item.product} />
      ))}
    </div>
  );
}
