'use client';

import { useQuery } from '@tanstack/react-query';
import type { AdminOrderDetail } from '@toolshop/shared';
import { Alert, Skeleton } from '@toolshop/ui';
import { useParams } from 'next/navigation';
import { PartyBox, PrintShell } from '@/components/documents/print-shell';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { dateTime, faNumber } from '@/lib/format';

/** Warehouse document: what to pick and where to send it (no prices). */
export default function PackingSlipPage() {
  const { id } = useParams<{ id: string }>();
  const order = useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: () => api.get<AdminOrderDetail>(`/admin/orders/${id}`),
    retry: false,
  });
  const o = order.data;
  return (
    <PrintShell>
      {order.isError ? (
        <Alert variant="destructive">{errorMessage(order.error)}</Alert>
      ) : !o ? (
        <Skeleton className="h-[200mm]" />
      ) : (
        <>
          <header className="mb-4 flex items-end justify-between">
            <h1 className="text-lg font-extrabold">برگه آماده‌سازی و ارسال</h1>
            <div className="text-xs">
              <p>
                سفارش: <b className="text-base">{faNumber(o.orderNumber)}</b>
              </p>
              <p>ثبت: {dateTime(o.createdAt)}</p>
              <p>روش ارسال: {o.shippingMethodName}</p>
            </div>
          </header>
          <PartyBox
            title="گیرنده"
            rows={[
              ['نام', o.shippingAddress.recipientName],
              ['موبایل', o.shippingAddress.recipientMobile],
              ['کد پستی', o.shippingAddress.postalCode],
              [
                'نشانی',
                [
                  o.shippingAddress.province,
                  o.shippingAddress.city,
                  o.shippingAddress.addressLine,
                  o.shippingAddress.plaque ? `پلاک ${o.shippingAddress.plaque}` : null,
                  o.shippingAddress.unit ? `واحد ${o.shippingAddress.unit}` : null,
                ]
                  .filter(Boolean)
                  .join('، '),
              ],
            ]}
          />
          <table className="mt-3 w-full border-collapse border border-black/70 text-center">
            <thead className="bg-black/5">
              <tr>
                {['ردیف', 'کالا', 'SKU', 'تعداد', 'برداشته شد'].map((h) => (
                  <th key={h} className="border border-black/70 px-2 py-1 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {o.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="border border-black/70 px-2 py-1">{faNumber(index + 1)}</td>
                  <td className="border border-black/70 px-2 py-1 text-start">
                    {item.title}
                    {item.variantTitle ? ` – ${item.variantTitle}` : ''}
                  </td>
                  <td className="ltr border border-black/70 px-2 py-1 font-semibold">{item.sku}</td>
                  <td className="border border-black/70 px-2 py-1 text-base font-bold">
                    {faNumber(item.quantity)}
                  </td>
                  <td className="border border-black/70 px-2 py-1">☐</td>
                </tr>
              ))}
            </tbody>
          </table>
          {o.customerNote ? (
            <p className="mt-3 border border-black/70 px-3 py-1.5">
              یادداشت مشتری: {o.customerNote}
            </p>
          ) : null}
          <footer className="mt-8 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="h-20 border border-dashed border-black/50 pt-2">
              آماده‌سازی: نام و امضا
            </div>
            <div className="h-20 border border-dashed border-black/50 pt-2">
              کنترل و بسته‌بندی: نام و امضا
            </div>
          </footer>
        </>
      )}
    </PrintShell>
  );
}
