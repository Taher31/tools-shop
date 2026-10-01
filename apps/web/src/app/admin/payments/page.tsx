'use client';

import type { AdminPaymentView } from '@toolshop/shared';
import Link from 'next/link';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { DataTable, Pager, SearchInput, TableCard } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminList, useAdminMutation } from '@/components/admin/query';
import { PaymentStatusBadge } from '@/components/common/status-badges';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { dateTime, faNumber, price } from '@/lib/format';

export default function PaymentsPage() {
  const list = useAdminList<AdminPaymentView>('/admin/payments');
  const { can } = usePermissions();
  const refund = useAdminMutation((id: string) => api.post(`/admin/payments/${id}/refund`, {}), {
    success: 'بازپرداخت انجام شد.',
  });

  return (
    <>
      <PageHeader
        title="پرداخت‌ها"
        description="تراکنش‌های درگاه پرداخت؛ بازپرداخت‌ها در گزارش رویدادها ثبت می‌شوند."
      />
      <TableCard
        toolbar={
          <SearchInput
            onSearch={list.setSearch}
            placeholder="شماره سفارش، کد پیگیری یا شناسه درگاه"
            className="w-80"
          />
        }
      >
        <DataTable
          rows={list.data?.items}
          loading={list.isLoading}
          rowKey={(p) => p.id}
          columns={[
            {
              header: 'سفارش',
              cell: (p) => (
                <Link href={`/admin/orders/${p.order.id}`} className="text-info font-bold">
                  {faNumber(p.order.orderNumber)}
                </Link>
              ),
            },
            { header: 'مشتری', cell: (p) => p.customerName },
            { header: 'مبلغ', cell: (p) => price(p.amount) },
            { header: 'وضعیت', cell: (p) => <PaymentStatusBadge status={p.status} /> },
            { header: 'درگاه', cell: (p) => p.provider },
            {
              header: 'کد پیگیری',
              cell: (p) => <span className="ltr font-mono text-xs">{p.referenceId ?? '—'}</span>,
            },
            {
              header: 'زمان',
              cell: (p) => (
                <span className="text-muted-foreground text-xs">{dateTime(p.createdAt)}</span>
              ),
            },
            {
              header: '',
              cell: (p) =>
                p.status === 'succeeded' && can('payment.refund') ? (
                  <ConfirmButton
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    title="بازپرداخت کامل این تراکنش؟"
                    description={`مبلغ ${price(p.amount)} از طریق درگاه به مشتری بازگردانده می‌شود. این عملیات در گزارش رویدادها ثبت می‌شود.`}
                    confirmLabel="بازپرداخت"
                    loading={refund.isPending}
                    onConfirm={() => refund.mutateAsync(p.id)}
                  >
                    بازپرداخت
                  </ConfirmButton>
                ) : null,
            },
          ]}
        />
        <Pager data={list.data} onPage={list.setPage} />
      </TableCard>
    </>
  );
}
