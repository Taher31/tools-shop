/**
 * Jalali (Persian/Solar Hijri) calendar arithmetic and Tehran day boundaries.
 *
 * Conversions use the well-known 33-year-cycle algorithm (as in jalaali-js), so they
 * work identically in the browser and on the server without ICU calendar support.
 * Dates are exchanged as Gregorian "YYYY-MM-DD" keys that name a calendar day in
 * Tehran; the API turns them into UTC instants with `tehranDayRange`.
 */

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

/** Saturday-first, as on Iranian calendars. */
export const JALALI_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
];

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0] ?? -61;
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i += 1) {
    const jm = BREAKS[i] ?? 0;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): JalaliDate {
  const { gy } = d2g(jdn);
  let jy = gy - 621;
  const r = jalCal(jy);
  let k = jdn - g2d(gy, 3, r.march);
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export function isJalaliLeapYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

const pad = (value: number) => String(value).padStart(2, '0');
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateKey(value: string): boolean {
  const match = DATE_KEY.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Gregorian "YYYY-MM-DD" key for a Jalali date. */
export function jalaliToDateKey({ jy, jm, jd }: JalaliDate): string {
  const { gy, gm, gd } = d2g(j2d(jy, jm, jd));
  return `${gy}-${pad(gm)}-${pad(gd)}`;
}

export function dateKeyToJalali(key: string): JalaliDate {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return d2j(g2d(y, m, d));
}

const TEHRAN_OFFSET_MS = 210 * 60_000; // UTC+03:30 (no DST since 2022)
const DAY_MS = 86_400_000;

/** The Tehran calendar day an instant falls on, as a date key. */
export function tehranDateKey(date: Date = new Date()): string {
  return new Date(date.getTime() + TEHRAN_OFFSET_MS).toISOString().slice(0, 10);
}

/** First instant (UTC) of a Tehran calendar day. */
export function tehranDayStart(key: string): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) - TEHRAN_OFFSET_MS);
}

export function addDaysToKey(key: string, days: number): string {
  return tehranDateKey(new Date(tehranDayStart(key).getTime() + days * DAY_MS));
}

/**
 * Inclusive day range → half-open instant range for database filters:
 * `{ gte: start of from, lt: start of the day after to }`.
 */
export function tehranDayRange(
  from?: string | null,
  to?: string | null,
): { gte?: Date; lt?: Date } | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: tehranDayStart(from) } : {}),
    ...(to ? { lt: tehranDayStart(addDaysToKey(to, 1)) } : {}),
  };
}

/** "۱۴۰۵/۰۷/۱۰"-style label (Latin digits; format for display with toPersianDigits). */
export function formatJalaliKey(key: string): string {
  const { jy, jm, jd } = dateKeyToJalali(key);
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}
