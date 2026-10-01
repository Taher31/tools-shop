import { type CartTotals, type CouponType, formatPrice, percentOf } from '@toolshop/shared';

export interface PricingLine {
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
}

export interface CouponRule {
  code: string;
  type: CouponType;
  /** Percent for `percent`, Rial for `fixed`. */
  value: number;
  maxDiscount: number | null;
  minSubtotal: number | null;
}

export interface ShippingRule {
  cost: number;
  freeShippingThreshold: number | null;
}

export interface TaxRule {
  ratePercent: number;
  /** Catalog prices already include VAT (tax is reported, not added). */
  included: boolean;
}

export interface PricingInput {
  lines: PricingLine[];
  coupon?: CouponRule | null;
  shipping?: ShippingRule | null;
  tax: TaxRule;
}

export interface PricingResult extends CartTotals {
  lineTotals: number[];
  couponApplied: boolean;
  couponError: string | null;
}

/**
 * The only place money is calculated. Pure and deterministic: every amount is an
 * integer Rial and rounding always favours the customer (floor on discounts' cost).
 * The client never sends prices – it only receives the result of this function.
 */
export function calculateTotals(input: PricingInput): PricingResult {
  const lineTotals = input.lines.map((line) => line.unitPrice * line.quantity);
  const subtotal = lineTotals.reduce((sum, total) => sum + total, 0);
  const itemsCount = input.lines.reduce((sum, line) => sum + line.quantity, 0);
  const productSavings = input.lines.reduce(
    (sum, line) =>
      sum + (line.compareAtPrice && line.compareAtPrice > line.unitPrice ? (line.compareAtPrice - line.unitPrice) * line.quantity : 0),
    0,
  );

  let couponDiscount = 0;
  let couponApplied = false;
  let couponError: string | null = null;
  let freeShipping = false;
  const coupon = input.coupon;
  if (coupon) {
    if (coupon.minSubtotal !== null && subtotal < coupon.minSubtotal) {
      couponError = `حداقل مبلغ خرید برای استفاده از کد ${coupon.code}، ${formatPrice(coupon.minSubtotal)} است.`;
    } else {
      couponApplied = true;
      if (coupon.type === 'percent') {
        couponDiscount = percentOf(subtotal, Math.min(100, Math.max(0, coupon.value)));
      } else if (coupon.type === 'fixed') {
        couponDiscount = coupon.value;
      } else {
        freeShipping = true;
      }
      if (coupon.maxDiscount !== null) couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
      couponDiscount = Math.min(couponDiscount, subtotal);
    }
  }

  const merchandise = subtotal - couponDiscount;
  let shippingCost: number | null = null;
  if (input.shipping) {
    const threshold = input.shipping.freeShippingThreshold;
    shippingCost = freeShipping || (threshold !== null && merchandise >= threshold) ? 0 : input.shipping.cost;
  }

  const rate = Math.max(0, input.tax.ratePercent);
  const tax = input.tax.included
    ? Math.floor((merchandise * rate) / (100 + rate))
    : Math.floor((merchandise * rate) / 100);
  const total = merchandise + (input.tax.included ? 0 : tax) + (shippingCost ?? 0);

  return {
    itemsCount,
    subtotal,
    productSavings,
    couponDiscount,
    shippingCost,
    tax,
    taxIncluded: input.tax.included,
    total,
    lineTotals,
    couponApplied,
    couponError,
  };
}
