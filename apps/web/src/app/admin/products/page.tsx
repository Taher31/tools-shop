'use client';

import { useQuery } from '@tanstack/react-query';
import {
  type AdminCategoryView,
  type AdminProductListItem,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUSES,
  type ProductStatus,
} from '@toolshop/shared';
import { Badge, Button, NativeSelect, Switch } from '@toolshop/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataTable, Pager, SearchInput, TableCard } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminList } from '@/components/admin/query';
import { ProductImage } from '@/components/product/product-image';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { faNumber, price } from '@/lib/format';

const STATUS_VARIANT = { active: 'success', draft: 'secondary', archived: 'outline' } as const;

function flatten(nodes: AdminCategoryView[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, label: `${'— '.repeat(depth)}${n.name}` },
    ...flatten(n.children as AdminCategoryView[], depth + 1),
  ]);
}

export default function ProductsPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const list = useAdminList<AdminProductListItem>('/admin/products');
  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api.get<AdminCategoryView[]>('/admin/categories'),
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
          <>
            <SearchInput
              onSearch={list.setSearch}
              placeholder="نام، مدل، SKU یا بارکد"
              className="w-64"
            />
            <NativeSelect
              className="h-9 w-40"
              value={(list.params.status as string) ?? ''}
              onChange={(e) => list.update({ status: e.target.value || undefined })}
              aria-label="وضعیت"
            >
              <option value="">همه وضعیت‌ها</option>
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PRODUCT_STATUS_LABELS[s as ProductStatus]}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              className="h-9 w-52"
              value={(list.params.categoryId as string) ?? ''}
              onChange={(e) => list.update({ categoryId: e.target.value || undefined })}
              aria-label="دسته‌بندی"
            >
              <option value="">همه دسته‌ها</option>
              {flatten(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={list.params.lowStock === 'true'}
                onCheckedChange={(v) => list.update({ lowStock: v ? 'true' : undefined })}
              />
              فقط کم‌موجود
            </label>
          </>
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
