'use client';

import { useQuery } from '@tanstack/react-query';
import type { AdminProductDetail } from '@toolshop/shared';
import { Skeleton } from '@toolshop/ui';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/admin/page-header';
import { ProductForm } from '@/components/admin/product-form';
import { api } from '@/lib/api/client';
import { dateTime } from '@/lib/format';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: () => api.get<AdminProductDetail>(`/admin/products/${id}`),
  });
  if (!data) return <Skeleton className="h-96" />;
  return (
    <>
      <PageHeader title={data.title} description={`آخرین ویرایش: ${dateTime(data.updatedAt)}`} />
      <ProductForm key={data.updatedAt} product={data} />
    </>
  );
}
