import {
  dateKeyToJalali,
  isDateKey,
  jalaliToDateKey,
  normalizePersian,
  tehranDayStart,
  toEnglishDigits,
} from '@toolshop/shared';

/** Lower-cased, digit/letter-normalised text for matching headers and names. */
export function norm(value: string): string {
  return normalizePersian(toEnglishDigits(value))
    .toLowerCase()
    .replace(/[‌‏‎\s_\-:]+/g, '');
}

const TRUE = new Set(['بله', 'بلی', 'آری', 'فعال', 'دارد', 'true', 'yes', 'y', '1', 'ok', 'بله✓']);
const FALSE = new Set(['خیر', 'نه', 'نخیر', 'غیرفعال', 'ندارد', 'false', 'no', 'n', '0']);

/** Empty → undefined (keep current value); unknown text → null (error). */
export function parseBool(value: string): boolean | undefined | null {
  if (value === '') return undefined;
  const key = norm(value);
  if (TRUE.has(key)) return true;
  if (FALSE.has(key)) return false;
  return null;
}

export function parseIntStrict(value: string): number | undefined | null {
  if (value === '') return undefined;
  const text = toEnglishDigits(value).replace(/[,٬،\s]/g, '');
  return /^-?\d+$/.test(text) ? Number(text) : null;
}

/** Toman text ("1,250,000", "۱۲۵۰۰۰۰") → Rial. */
export function parseTomanToRial(value: string): number | undefined | null {
  const toman = parseIntStrict(value);
  if (toman === undefined || toman === null) return toman;
  return toman < 0 ? null : toman * 10;
}

export function parseList(value: string): string[] {
  return value
    .split(/[|،;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** "2026-10-01", "1405/07/09" or "۱۴۰۵-۷-۹" → first instant of that Tehran day. */
export function parseDay(value: string): Date | undefined | null {
  if (value === '') return undefined;
  const text = toEnglishDigits(value).trim();
  const parts = text.split(/[/\-.]/).map(Number);
  if (parts.length === 3 && parts.every(Number.isInteger)) {
    const [a, b, c] = parts as [number, number, number];
    if (a >= 1300 && a <= 1500) {
      const key = jalaliToDateKey({ jy: a, jm: b, jd: c });
      // Reject impossible Jalali days (e.g. 31 Mehr) that wrapped into another month.
      const back = dateKeyToJalali(key);
      return back.jy === a && back.jm === b && back.jd === c ? tehranDayStart(key) : null;
    }
    const key = `${a}-${String(b).padStart(2, '0')}-${String(c).padStart(2, '0')}`;
    return isDateKey(key) ? tehranDayStart(key) : null;
  }
  return null;
}

/** Day as Jalali "1405/07/09" for exports. */
export function formatDayJalali(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const key = new Date(d.getTime() + 210 * 60_000).toISOString().slice(0, 10);
  const { jy, jm, jd } = dateKeyToJalali(key);
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

/** Plain text → minimal HTML paragraphs; HTML passes through (sanitised on save). */
export function textToHtml(text: string): string {
  if (/<\/?[a-z][\s\S]*>/i.test(text)) return text;
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escape(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Rial → Toman text for exports. */
export const toTomanText = (rial: number | bigint | null | undefined): string =>
  rial === null || rial === undefined ? '' : String(Math.round(Number(rial) / 10));
