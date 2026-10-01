'use client';

import { useQuery } from '@tanstack/react-query';
import type { CompareResult } from '@toolshop/shared';
import { Button, EmptyState, Skeleton } from '@toolshop/ui';
import { GitCompareArrows, X } from 'lucide-react';
import Link from 'next/link';
import { ProductImage } from '@/components/product/product-image';
import { useCompare } from '@/hooks/use-compare';
import { api } from '@/lib/api/client';
import { price } from '@/lib/format';

export function CompareView() {
  const compare = useCompare();
  const { data, isLoading } = useQuery({
    queryKey: ['compare', compare.ids],
    queryFn: () => api.get<CompareResult>(`/products/compare?ids=${compare.ids.join(',')}`),
    enabled: compare.ids.length > 0,
  });

  if (compare.ids.length === 0) {
    return (
      <div className="border-border bg-card rounded-lg border">
        <EmptyState
          icon={<GitCompareArrows />}
          title="لیست مقایسه خالی است"
          description="با زدن دکمه مقایسه روی کارت محصولات (تا ۴ کالا)، مشخصات فنی آن‌ها را کنار هم ببینید."
          action={
            <Button asChild variant="outline">
              <Link href="/products">مشاهده محصولات</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (isLoading || !data) return <Skeleton className="h-96" />;

  return (
    <div className="border-border bg-card overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-border w-44 border-b p-3" />
            {data.products.map((product) => (
              <th
                key={product.id}
                className="border-border border-b border-s p-3 align-top font-normal"
              >
                <div className="bg-muted relative mx-auto mb-2 aspect-square w-32 rounded-md">
                  <ProductImage src={product.imageUrl} alt={product.title} sizes="128px" />
                  <button
                    type="button"
                    onClick={() => compare.remove(product.id)}
                    className="border-border bg-card absolute -end-2 -top-2 flex size-6 items-center justify-center rounded-full border"
                    aria-label="حذف از مقایسه"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <Link
                  href={`/product/${product.slug}`}
                  className="hover:text-primary line-clamp-2 font-semibold"
                >
                  {product.title}
                </Link>
                <p className="mt-1 font-bold">
                  {product.inStock ? price(product.price) : 'ناموجود'}
                </p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="bg-muted/40">
            <th className="text-muted-foreground p-3 text-start font-medium">برند</th>
            {data.products.map((product) => (
              <td key={product.id} className="border-border border-s p-3 text-center">
                {product.brand ?? '—'}
              </td>
            ))}
          </tr>
          {data.attributes.map((attribute, index) => (
            <tr key={attribute.code} className={index % 2 ? 'bg-muted/40' : undefined}>
              <th className="text-muted-foreground p-3 text-start font-medium">{attribute.name}</th>
              {data.products.map((product) => (
                <td key={product.id} className="border-border border-s p-3 text-center">
                  {product.specs[attribute.code] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-border flex justify-end border-t p-3">
        <Button variant="ghost" size="sm" onClick={compare.clear}>
          پاک کردن لیست مقایسه
        </Button>
      </div>
    </div>
  );
}
