import type { CartTotals } from '@toolshop/shared';
import { cn } from '@toolshop/ui';
import type { ReactNode } from 'react';
import { faNumber, price } from '@/lib/format';

function Row({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 text-sm', className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/** Totals exactly as calculated by the API (the client never computes money). */
export function OrderSummary({ totals, children, shippingPending = false }: { totals: CartTotals; children?: ReactNode; shippingPending?: boolean }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-5">
      <Row label={`قیمت کالاها (${faNumber(totals.itemsCount)})`} value={price(totals.subtotal + totals.productSavings)} />
      {totals.productSavings > 0 ? <Row label="تخفیف کالاها" value={`− ${price(totals.productSavings)}`} className="[&>span:last-child]:text-destructive" /> : null}
      {totals.couponDiscount > 0 ? <Row label="کد تخفیف" value={`− ${price(totals.couponDiscount)}`} className="[&>span:last-child]:text-destructive" /> : null}
      <Row
        label="هزینه ارسال"
        value={totals.shippingCost === null ? (shippingPending ? 'پس از انتخاب روش ارسال' : 'در مرحله بعد') : totals.shippingCost === 0 ? 'رایگان' : price(totals.shippingCost)}
      />
      {!totals.taxIncluded && totals.tax > 0 ? <Row label="مالیات بر ارزش افزوده" value={price(totals.tax)} /> : null}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="font-bold">مبلغ قابل پرداخت</span>
        <span className="text-lg font-extrabold">{price(totals.total)}</span>
      </div>
      {totals.taxIncluded && totals.tax > 0 ? (
        <p className="text-[11px] text-muted-foreground">شامل {price(totals.tax)} مالیات بر ارزش افزوده</p>
      ) : null}
      {children}
    </div>
  );
}
