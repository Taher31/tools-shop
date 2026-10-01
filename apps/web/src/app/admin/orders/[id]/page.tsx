'use client';

import { useQuery } from '@tanstack/react-query';
import {
  type AdminOrderDetail,
  type InvoiceSummary,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from '@toolshop/shared';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Skeleton,
  Textarea,
} from '@toolshop/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AddressText } from '@/components/account/address-form';
import { PageHeader } from '@/components/admin/page-header';
import { InvoiceLinks } from '@/components/documents/invoice-links';
import { useAdminMutation } from '@/components/admin/query';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/common/status-badges';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { dateTime, faNumber, price } from '@/lib/format';

export default function AdminOrderPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = usePermissions();
  const order = useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: () => api.get<AdminOrderDetail>(`/admin/orders/${id}`),
  });
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState('');
  const [tracking, setTracking] = useState('');
  const [adminNote, setAdminNote] = useState<string | null>(null);
  const transition = useAdminMutation(
    (input: { status: OrderStatus; note?: string; trackingCode?: string }) =>
      api.post<AdminOrderDetail>(`/admin/orders/${id}/status`, input),
    { success: 'وضعیت سفارش به‌روز شد.', onSuccess: () => setTarget(null) },
  );
  const saveNote = useAdminMutation(
    (value: string) => api.put(`/admin/orders/${id}/note`, { note: value }),
    { success: 'یادداشت ذخیره شد.' },
  );
  const invoices = useQuery({
    queryKey: ['admin', 'order', id, 'invoices'],
    queryFn: () => api.get<InvoiceSummary[]>(`/admin/invoices/orders/${id}`),
    enabled: can('invoice.read'),
  });
  const issueInvoice = useAdminMutation(() => api.post(`/admin/invoices/orders/${id}`), {
    success: 'فاکتور صادر شد.',
    invalidate: [['admin', 'order', id, 'invoices']],
  });
  const refund = useAdminMutation(
    (paymentId: string) =>
      api.post(`/admin/payments/${paymentId}/refund`, { reason: note || undefined }),
    { success: 'بازپرداخت ثبت شد.' },
  );

  if (!order.data) return <Skeleton className="h-96" />;
  const o = order.data;
  const refundable = o.payments.find((p) => p.status === 'succeeded');

  return (
    <>
      <PageHeader
        title={`سفارش ${faNumber(o.orderNumber)}`}
        description={`ثبت‌شده در ${dateTime(o.createdAt)}`}
        actions={
          <>
            <OrderStatusBadge status={o.status} />
            <Button size="sm" variant="outline" asChild>
              <Link href={`/print/packing-slip/${o.id}`} target="_blank">
                برگه آماده‌سازی
              </Link>
            </Button>
            {can('order.update')
              ? o.allowedTransitions
                  .filter((s) => s !== 'cancelled' || can('order.cancel'))
                  .map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={status === 'cancelled' ? 'destructive' : 'default'}
                      onClick={() => {
                        setTarget(status);
                        setNote('');
                        setTracking(o.trackingCode ?? '');
                      }}
                    >
                      {status === 'cancelled'
                        ? 'لغو سفارش'
                        : `تغییر به «${ORDER_STATUS_LABELS[status]}»`}
                    </Button>
                  ))
              : null}
            {refundable &&
            (o.status === 'cancelled' || o.status === 'returned') &&
            can('payment.refund') ? (
              <Button
                size="sm"
                variant="outline"
                loading={refund.isPending}
                onClick={() => refund.mutate(refundable.id)}
              >
                بازپرداخت وجه
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>اقلام سفارش</CardTitle>
            </CardHeader>
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground text-xs">
                <tr>
                  <th className="p-3 text-start">کالا</th>
                  <th className="p-3 text-start">SKU</th>
                  <th className="p-3 text-start">تعداد</th>
                  <th className="p-3 text-start">قیمت واحد</th>
                  <th className="p-3 text-start">جمع</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((item) => (
                  <tr key={item.id} className="border-border border-t">
                    <td className="p-3">
                      {item.productId ? (
                        <Link
                          href={`/admin/products/${item.productId}`}
                          className="hover:text-primary"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                      {item.variantTitle ? (
                        <span className="text-muted-foreground block text-xs">
                          {item.variantTitle}
                        </span>
                      ) : null}
                    </td>
                    <td className="ltr p-3 text-end font-mono text-xs">{item.sku}</td>
                    <td className="p-3">{faNumber(item.quantity)}</td>
                    <td className="p-3">{price(item.unitPrice)}</td>
                    <td className="p-3 font-semibold">{price(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <CardContent className="border-border space-y-1.5 border-t text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">جمع کالاها</span>
                <span>{price(o.subtotal)}</span>
              </div>
              {o.discountTotal > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تخفیف ({o.couponCode})</span>
                  <span className="text-destructive">− {price(o.discountTotal)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-muted-foreground">ارسال ({o.shippingMethodName})</span>
                <span>{price(o.shippingCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  مالیات بر ارزش افزوده {o.taxIncluded ? '(در قیمت)' : ''}
                </span>
                <span>{price(o.taxTotal)}</span>
              </div>
              <div className="border-border flex justify-between border-t pt-2 text-base font-extrabold">
                <span>مبلغ کل</span>
                <span>{price(o.total)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>تاریخچه وضعیت</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="border-border relative space-y-4 border-s ps-5">
                {o.history.map((entry, index) => (
                  <li key={index} className="relative">
                    <span className="bg-primary absolute -start-[1.6rem] top-1.5 size-2.5 rounded-full" />
                    <p className="text-sm font-semibold">{ORDER_STATUS_LABELS[entry.toStatus]}</p>
                    <p className="text-muted-foreground text-xs">
                      {dateTime(entry.createdAt)} · {entry.actorName ?? 'سیستم/مشتری'}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>مشتری</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Link
                href={`/admin/customers/${o.customer.id}`}
                className="text-info font-bold hover:underline"
              >
                {o.customer.fullName}
              </Link>
              <p className="ltr text-end">{o.customer.mobile}</p>
              {o.customer.email ? (
                <p className="ltr text-muted-foreground text-end">{o.customer.email}</p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>ارسال</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-semibold">{o.shippingMethodName}</p>
              <AddressText address={o.shippingAddress} />
              {o.trackingCode ? (
                <p className="text-sm">
                  کد رهگیری: <span className="ltr font-mono">{o.trackingCode}</span>
                </p>
              ) : null}
              {o.customerNote ? (
                <p className="bg-warning-soft rounded-md p-2 text-xs">
                  یادداشت مشتری: {o.customerNote}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>پرداخت‌ها</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {o.payments.length === 0 ? (
                <p className="text-muted-foreground text-sm">پرداختی ثبت نشده است.</p>
              ) : null}
              {o.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="border-border space-y-1 rounded-md border p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <PaymentStatusBadge status={payment.status} />
                    <span className="font-semibold">{price(payment.amount)}</span>
                  </div>
                  <p className="text-muted-foreground">
                    {dateTime(payment.createdAt)} · {payment.provider}
                  </p>
                  {payment.referenceId ? (
                    <p>
                      کد پیگیری: <span className="ltr font-mono">{payment.referenceId}</span>
                    </p>
                  ) : null}
                  {payment.cardMask ? (
                    <p>
                      کارت: <span className="ltr font-mono">{payment.cardMask}</span>
                    </p>
                  ) : null}
                  {payment.failureReason ? (
                    <p className="text-destructive">{payment.failureReason}</p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
          {can('invoice.read') ? (
            <Card>
              <CardHeader>
                <CardTitle>اسناد</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoices.data && invoices.data.length > 0 ? (
                  <InvoiceLinks invoices={invoices.data} admin />
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {o.paidAt
                      ? 'فاکتوری برای این سفارش صادر نشده است.'
                      : 'فاکتور پس از پرداخت صادر می‌شود.'}
                  </p>
                )}
                {o.paidAt && invoices.data?.length === 0 && can('invoice.issue') ? (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={issueInvoice.isPending}
                    onClick={() => issueInvoice.mutate(undefined)}
                  >
                    صدور فاکتور فروش
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>یادداشت داخلی</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                rows={3}
                value={adminNote ?? o.adminNote ?? ''}
                onChange={(e) => setAdminNote(e.target.value)}
                disabled={!can('order.update')}
              />
              {can('order.update') ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={saveNote.isPending}
                  onClick={() => saveNote.mutate(adminNote ?? o.adminNote ?? '')}
                >
                  ذخیره یادداشت
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {target ? `تغییر وضعیت به «${ORDER_STATUS_LABELS[target]}»` : ''}
            </DialogTitle>
          </DialogHeader>
          {target === 'shipped' ? (
            <Field label="کد رهگیری مرسوله" htmlFor="tracking" required>
              <Input
                id="tracking"
                dir="ltr"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
              />
            </Field>
          ) : null}
          {target === 'cancelled' ? (
            <p className="bg-destructive-soft text-destructive rounded-md p-3 text-sm">
              با لغو سفارش، کالاها به انبار بازمی‌گردند. در صورت پرداخت، بازپرداخت را از همین صفحه
              ثبت کنید.
            </p>
          ) : null}
          <Field label="توضیحات (در تاریخچه ثبت می‌شود)" htmlFor="note">
            <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              انصراف
            </Button>
            <Button
              variant={target === 'cancelled' ? 'destructive' : 'default'}
              loading={transition.isPending}
              onClick={() =>
                target &&
                transition.mutate({
                  status: target,
                  note: note || undefined,
                  trackingCode: tracking || undefined,
                })
              }
            >
              تأیید
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
