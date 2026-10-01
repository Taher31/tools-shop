'use client';

import {
  type AdminReviewView,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUSES,
  type ReviewStatus,
} from '@toolshop/shared';
import { Badge, Button, NativeSelect } from '@toolshop/ui';
import Link from 'next/link';
import { DataTable, Pager, TableCard } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminList, useAdminMutation } from '@/components/admin/query';
import { Stars } from '@/components/product/rating';
import { api } from '@/lib/api/client';
import { date } from '@/lib/format';

const VARIANT = { pending: 'warning', approved: 'success', rejected: 'destructive' } as const;

export default function ReviewsPage() {
  const list = useAdminList<AdminReviewView>('/admin/reviews', { status: 'pending' });
  const moderate = useAdminMutation(
    ({ id, status }: { id: string; status: ReviewStatus }) =>
      api.put(`/admin/reviews/${id}/status`, { status }),
    { success: 'وضعیت نظر به‌روز شد.' },
  );

  return (
    <>
      <PageHeader
        title="نظرات کاربران"
        description="نظرات پس از تأیید در صفحه محصول منتشر و در امتیاز محصول محاسبه می‌شوند."
      />
      <TableCard
        toolbar={
          <NativeSelect
            className="h-9 w-44"
            value={(list.params.status as string) ?? ''}
            onChange={(e) => list.update({ status: e.target.value || undefined })}
            aria-label="وضعیت"
          >
            <option value="">همه</option>
            {REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {REVIEW_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        }
      >
        <DataTable
          rows={list.data?.items}
          loading={list.isLoading}
          rowKey={(r) => r.id}
          empty="نظری برای بررسی وجود ندارد"
          columns={[
            {
              header: 'محصول',
              cell: (r) => (
                <Link
                  href={`/product/${r.product.slug}`}
                  target="_blank"
                  className="text-info line-clamp-1 max-w-48 hover:underline"
                >
                  {r.product.title}
                </Link>
              ),
            },
            { header: 'امتیاز', cell: (r) => <Stars value={r.rating} /> },
            {
              header: 'نظر',
              cell: (r) => (
                <div className="max-w-md">
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-muted-foreground line-clamp-3 text-xs leading-6">{r.body}</p>
                </div>
              ),
            },
            {
              header: 'کاربر',
              cell: (r) => (
                <div className="text-xs">
                  <p>{r.authorName}</p>
                  {r.isVerifiedBuyer ? (
                    <Badge variant="success" className="mt-1">
                      خریدار
                    </Badge>
                  ) : null}
                </div>
              ),
            },
            { header: 'تاریخ', cell: (r) => <span className="text-xs">{date(r.createdAt)}</span> },
            {
              header: 'وضعیت',
              cell: (r) => (
                <Badge variant={VARIANT[r.status]}>{REVIEW_STATUS_LABELS[r.status]}</Badge>
              ),
            },
            {
              header: '',
              cell: (r) => (
                <div className="flex gap-1">
                  {r.status !== 'approved' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moderate.mutate({ id: r.id, status: 'approved' })}
                    >
                      تأیید
                    </Button>
                  ) : null}
                  {r.status !== 'rejected' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => moderate.mutate({ id: r.id, status: 'rejected' })}
                    >
                      رد
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
        <Pager data={list.data} onPage={list.setPage} />
      </TableCard>
    </>
  );
}
