import { toPersianDigits } from '../text/persian';

/**
 * All monetary amounts in the system are integers in Iranian Rial (IRR), the legal
 * currency and the unit expected by Iranian payment gateways. Toman (= 10 Rial) is a
 * display concern only.
 */
export type Rial = number;

export type DisplayCurrency = 'IRT' | 'IRR';

export const CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  IRT: 'تومان',
  IRR: 'ریال',
};

export function assertRial(amount: number): Rial {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError(`Invalid Rial amount: ${amount}`);
  }
  return amount;
}

export function rialToToman(amount: Rial): number {
  return Math.floor(amount / 10);
}

export function tomanToRial(amount: number): Rial {
  return Math.round(amount) * 10;
}

/** Formats a number with Persian digits and thousand separators (۱۲٬۳۴۵). */
export function formatNumberFa(value: number): string {
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(value);
}

export function formatPrice(
  amount: Rial,
  options: { currency?: DisplayCurrency; withUnit?: boolean } = {},
): string {
  const currency = options.currency ?? 'IRT';
  const value = currency === 'IRT' ? rialToToman(amount) : amount;
  const formatted = formatNumberFa(value);
  return options.withUnit === false ? formatted : `${formatted} ${CURRENCY_LABELS[currency]}`;
}

/** Percentage of `amount` rounded down to a whole Rial (never over-charges the customer). */
export function percentOf(amount: Rial, percent: number): Rial {
  return Math.floor((amount * percent) / 100);
}

/** Discount percentage between a reference price and the selling price, rounded. */
export function discountPercent(compareAtPrice: Rial | null | undefined, price: Rial): number {
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

export function formatPercentFa(percent: number): string {
  return `٪${toPersianDigits(percent)}`;
}
