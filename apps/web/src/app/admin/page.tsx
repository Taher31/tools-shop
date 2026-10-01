'use client';

import { useQuery } from '@tanstack/react-query';
import type { DashboardStats } from '@toolshop/shared';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@toolshop/ui';
import { Boxes, CircleAlert, ClipboardList, Clock, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import type { ComponentType } from 'react';
import { DataTable } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { SalesChart } from '@/components/admin/sales-chart';
import { OrderStatusBadge } from '@/components/common/status-badges';
import { api } from '@/lib/api/client';
import { dateTime, faNumber, price } from '@/lib/format';

function StatTile({ label, value, icon: Icon, href, tone }: { label: string; value: string; icon: ComponentType<{ className?: string }>; href?: string; tone?: 'warning' }) {
  const body = (
    <Card className="flex items-center gap-4 p-4 transition-colors hover:border-primary/40">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-md ${tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-secondary text-primary'}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-extrabold">{value}</p>
      </div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api.get<DashboardStats>('/admin/dashboard'), refetchInterval: 60_000 });

  return (
    <>
      <PageHeader title="داشبورد" description="خلاصه فروش و وضعیت عملیات فروشگاه (روز و ماه بر اساس تقویم شمسی و ساعت تهران)" />
      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile label="فروش امروز" value={price(data.salesToday)} icon={TrendingUp} />
            <StatTile label="فروش ماه جاری" value={price(data.salesMonth)} icon={TrendingUp} />
            <StatTile label="سفارش‌های پرداخت‌شده امروز / ماه" value={`${faNumber(data.ordersToday)} / ${faNumber(data.ordersMonth)}`} icon={ClipboardList} href="/admin/orders" />
            <StatTile label="در انتظار پردازش و ارسال" value={faNumber(data.awaitingFulfillment)} icon={Clock} href="/admin/orders?status=paid" />
            <StatTile label="کالاهای کم‌موجودی" value={faNumber(data.lowStockCount)} icon={CircleAlert} href="/admin/inventory?lowStock=true" tone={data.lowStockCount > 0 ? 'warning' : undefined} />
            <StatTile label="مشتریان / در انتظار پرداخت" value={`${faNumber(data.customersCount)} / ${faNumber(data.awaitingPayment)}`} icon={Users} href="/admin/customers" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>فروش روزانه (۱۴ روز اخیر، تومان)</CardTitle>
            </CardHeader>
            <CardContent>
              <SalesChart data={data.salesByDay} />
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>آخرین سفارش‌ها</CardTitle>
                <Link href="/admin/orders" className="text-xs text-info hover:underline">همه سفارش‌ها</Link>
              </CardHeader>
              <DataTable
                rows={data.recentOrders}
                rowKey={(o) => o.id}
                columns={[
                  { header: 'شماره', cell: (o) => <Link href={`/admin/orders/${o.id}`} className="font-bold text-info hover:underline">{faNumber(o.orderNumber)}</Link> },
                  { header: 'مشتری', cell: (o) => o.customer.fullName },
                  { header: 'مبلغ', cell: (o) => price(o.total) },
                  { header: 'وضعیت', cell: (o) => <OrderStatusBadge status={o.status} /> },
                  { header: 'زمان', cell: (o) => <span className="text-xs text-muted-foreground">{dateTime(o.createdAt)}</span> },
                ]}
              />
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>کالاهای کم‌موجودی</CardTitle>
                <Link href="/admin/inventory?lowStock=true" className="text-xs text-info hover:underline">مدیریت موجودی</Link>
              </CardHeader>
              <DataTable
                rows={data.lowStockItems}
                rowKey={(r) => r.variantId}
                empty="همه کالاها موجودی کافی دارند"
                columns={[
                  { header: 'کالا', cell: (r) => <span className="line-clamp-1">{r.productTitle}{r.variantTitle ? ` – ${r.variantTitle}` : ''}</span> },
                  { header: 'SKU', cell: (r) => <span className="ltr font-mono text-xs">{r.sku}</span> },
                  {
                    header: 'قابل فروش',
                    cell: (r) => (
                      <Badge variant={r.available === 0 ? 'destructive' : 'warning'}>
                        <Boxes className="size-3" /> {faNumber(r.available)}
                      </Badge>
                    ),
                  },
                  { header: 'حداقل', cell: (r) => faNumber(r.lowStockThreshold) },
                ]}
              />
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>پرفروش‌ترین محصولات (۳۰ روز اخیر)</CardTitle>
            </CardHeader>
            <DataTable
              rows={data.topProducts}
              rowKey={(p) => p.productId}
              empty="هنوز فروشی ثبت نشده است"
              columns={[
                { header: 'محصول', cell: (p) => <Link href={`/admin/products/${p.productId}`} className="hover:text-primary">{p.title}</Link> },
                { header: 'تعداد فروش', cell: (p) => faNumber(p.quantity) },
                { header: 'مبلغ فروش', cell: (p) => price(p.revenue) },
              ]}
            />
          </Card>
        </div>
      )}
    </>
  );
}
