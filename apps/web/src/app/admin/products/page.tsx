'use client';

import { useQuery } from '@tanstack/react-query';
import {
  type AdminBrandView,
  type AdminCategoryView,
  type AdminProductListItem,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUSES,
  type ProductStatus,
} from '@toolshop/shared';
import { Badge, Button } from '@toolshop/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataTable, Pager, TableCard } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { useUrlList } from '@/components/admin/query';
import { ProductImage } from '@/components/product/product-image';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { faNumber, price } from '@/lib/format';
import { FilterBar } from '@/components/admin/filter-bar';
import { Suspense } from 'react';
import { ExportButton } from '@/components/admin/export-button';

const STATUS_VARIANT = { active: 'success', draft: 'secondary', archived: 'outline' } as const;

function flatten(nodes: AdminCategoryView[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, label: `${'— '.repeat(depth)}${n.name}` },
    ...flatten(n.children as AdminCategoryView[], depth + 1),
  ]);
}

function ProductsPageContent() {
  const router = useRouter();
  const { can } = usePermissions();
  const list = useUrlList<AdminProductListItem>('/admin/products');
  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api.get<AdminCategoryView[]>('/admin/categories'),
  });
  const brands = useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: () => api.get<AdminBrandView[]>('/admin/brands'),
  });

  return (
    <>
      <PageHeader
        title="محصولات"
        description="کاتالوگ محصولات، تنوع‌ها و قیمت‌ها"
        actions={
          can('product.create') ? (
            <Button asChild>
              <Link href="/admin/products/new">
                <Plus /> محصول جدید
              </Link>
            </Button>
          ) : null
        }
      />
      <TableCard
        toolbar={
          <FilterBar
            actions={<ExportButton entity="products" params={list.params} />}
            list={list}
            searchPlaceholder="نام، مدل، SKU یا بارکد"
            dateLabel="تاریخ ایجاد"
            inline={[
              {
                type: 'select',
                key: 'status',
                label: 'وضعیت',
                options: PRODUCT_STATUSES.map((s) => ({
                  value: s,
                  label: PRODUCT_STATUS_LABELS[s as ProductStatus],
                })),
              },
              {
                type: 'select',
                key: 'categoryId',
                label: 'دسته‌بندی',
                options: flatten(categories.data ?? []).map((c) => ({
                  value: c.id,
                  label: c.label,
                })),
              },
            ]}
            more={[
              {
                type: 'select',
                key: 'brandId',
                label: 'برند',
                options: (brands.data ?? []).map((b) => ({ value: b.id, label: b.name })),
              },
              {
                type: 'select',
                key: 'lowStock',
                label: 'موجودی',
                options: [{ value: 'true', label: 'فقط کم‌موجود' }],
              },
              {
                type: 'select',
                key: 'outOfStock',
                label: 'ناموجود',
                options: [
                  { value: 'true', label: 'فقط ناموجود' },
                  { value: 'false', label: 'فقط موجود' },
                ],
              },
              {
                type: 'select',
                key: 'featured',
                label: 'ویژه',
                options: [
                  { value: 'true', label: 'فقط ویژه' },
                  { value: 'false', label: 'غیر ویژه' },
                ],
              },
            ]}
            sorts={[
              { value: '', label: 'آخرین ویرایش' },
              { value: 'newest', label: 'جدیدترین' },
              { value: 'oldest', label: 'قدیمی‌ترین' },
              { value: 'title', label: 'عنوان' },
              { value: 'best_selling', label: 'پرفروش‌ترین' },
            ]}
          />
        }
      >
        <DataTable
          rows={list.data?.items}
          loading={list.isLoading}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/admin/products/${p.id}`)}
          columns={[
            {
              header: '',
              className: 'w-14',
              cell: (p) => (
                <div className="bg-muted relative size-10 rounded">
                  <ProductImage src={p.imageUrl} alt="" sizes="40px" className="p-0.5" />
                </div>
              ),
            },
            {
              header: 'محصول',
              cell: (p) => (
                <div className="max-w-sm">
                  <p className="line-clamp-1 font-semibold">{p.title}</p>
                  <p className="ltr text-muted-foreground line-clamp-1 text-end font-mono text-[11px]">
                    {p.skus.join(' · ')}
                  </p>
                </div>
              ),
            },
            {
              header: 'دسته / برند',
              cell: (p) => (
                <div className="text-xs">
                  <p>{p.categoryName}</p>
                  <p className="text-muted-foreground">{p.brandName ?? '—'}</p>
                </div>
              ),
            },
            {
              header: 'قیمت',
              cell: (p) => (
                <span className="text-xs">
                  {p.minPrice === p.maxPrice
                    ? price(p.minPrice)
                    : `${price(p.minPrice)} تا ${price(p.maxPrice)}`}
                </span>
              ),
            },
            {
              header: 'موجودی',
              cell: (p) => (
                <span className={p.isLowStock ? 'text-warning font-bold' : undefined}>
                  {faNumber(p.stock.available)}
                  {p.stock.reserved > 0 ? (
                    <span className="text-muted-foreground text-xs">
                      {' '}
                      (رزرو {faNumber(p.stock.reserved)})
                    </span>
                  ) : null}
                </span>
              ),
            },
            {
              header: 'وضعیت',
              cell: (p) => (
                <Badge variant={STATUS_VARIANT[p.status]}>{PRODUCT_STATUS_LABELS[p.status]}</Badge>
              ),
            },
          ]}
        />
        <Pager data={list.data} onPage={list.setPage} />
      </TableCard>
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsPageContent />
    </Suspense>
  );
}
