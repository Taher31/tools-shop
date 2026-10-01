'use client';

import { useQuery } from '@tanstack/react-query';
import type { CustomerDetail } from '@toolshop/shared';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@toolshop/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AddressText } from '@/components/account/address-form';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminMutation } from '@/components/admin/query';
import { OrderStatusBadge } from '@/components/common/status-badges';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { date, dateTime, faNumber, price } from '@/lib/format';

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = usePermissions();
  const { data } = useQuery({
    queryKey: ['admin', 'customer', id],
    queryFn: () => api.get<CustomerDetail>(`/admin/customers/${id}`),
  });
  const toggle = useAdminMutation(
    (isActive: boolean) => api.put(`/admin/customers/${id}/status`, { isActive }),
    { success: 'وضعیت مشتری تغییر کرد.' },
  );
  if (!data) return <Skeleton className="h-96" />;

  return (
    <>
      <PageHeader
        title={data.fullName}
        description={`عضویت از ${date(data.createdAt)}${data.lastLoginAt ? ` · آخرین ورود ${dateTime(data.lastLoginAt)}` : ''}`}
        actions={
          <>
            {data.isActive ? (
              <Badge variant="success">فعال</Badge>
            ) : (
              <Badge variant="destructive">غیرفعال</Badge>
            )}
            {can('customer.update') ? (
              <ConfirmButton
                size="sm"
                variant={data.isActive ? 'destructive' : 'default'}
                title={data.isActive ? 'غیرفعال کردن حساب مشتری؟' : 'فعال کردن حساب مشتری؟'}
                description={
                  data.isActive
                    ? 'مشتری از همه دستگاه‌ها خارج می‌شود و تا فعال‌سازی مجدد امکان ورود ندارد.'
                    : undefined
                }
                loading={toggle.isPending}
                onConfirm={() => toggle.mutateAsync(!data.isActive)}
              >
                {data.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
              </ConfirmButton>
            ) : null}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>اطلاعات تماس</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              موبایل: <span className="ltr">{data.mobile ?? '—'}</span>
            </p>
            <p>
              ایمیل: <span className="ltr">{data.email ?? '—'}</span>
            </p>
            <p>
              کد ملی: <span className="ltr">{data.nationalCode ?? '—'}</span>
            </p>
            <p>تعداد سفارش: {faNumber(data.ordersCount)}</p>
            <p>
              مجموع خرید: <b>{price(data.totalSpent)}</b>
            </p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>آخرین سفارش‌ها</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-border divide-y">
              {data.recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="hover:bg-muted/40 flex items-center gap-4 px-5 py-3 text-sm"
                  >
                    <span className="font-bold">{faNumber(order.orderNumber)}</span>
                    <OrderStatusBadge status={order.status} />
                    <span className="text-muted-foreground text-xs">{date(order.createdAt)}</span>
                    <span className="ms-auto font-semibold">{price(order.total)}</span>
                  </Link>
                </li>
              ))}
              {data.recentOrders.length === 0 ? (
                <li className="text-muted-foreground px-5 py-4 text-sm">سفارشی ثبت نشده است.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>آدرس‌ها</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {data.addresses.map((address) => (
              <div key={address.id} className="border-border rounded-md border p-3">
                <AddressText address={address} />
              </div>
            ))}
            {data.addresses.length === 0 ? (
              <p className="text-muted-foreground text-sm">آدرسی ثبت نشده است.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
