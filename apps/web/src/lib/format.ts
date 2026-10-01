import { formatPrice as formatRial, toPersianDigits, type DisplayCurrency } from '@toolshop/shared';

const dateFormatter = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeZone: 'Asia/Tehran' });
const dateTimeFormatter = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});

/** Price in Toman with Persian digits: "۱٬۲۵۰٬۰۰۰ تومان". */
export function price(amountRial: number, currency: DisplayCurrency = 'IRT'): string {
  return formatRial(amountRial, { currency });
}

export function priceNumber(amountRial: number, currency: DisplayCurrency = 'IRT'): string {
  return formatRial(amountRial, { currency, withUnit: false });
}

export function faNumber(value: number | string): string {
  return typeof value === 'number' ? new Intl.NumberFormat('fa-IR').format(value) : toPersianDigits(value);
}

/** Jalali date in Tehran time. */
export function date(iso: string | Date): string {
  return dateFormatter.format(typeof iso === 'string' ? new Date(iso) : iso);
}

export function dateTime(iso: string | Date): string {
  return dateTimeFormatter.format(typeof iso === 'string' ? new Date(iso) : iso);
}
