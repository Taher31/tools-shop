import { z } from 'zod';
import { isDateKey } from '../calendar/jalali';
import { normalizeIranianMobile, isValidPostalCode } from '../iran/validators';
import { normalizePersian, toEnglishDigits } from '../text/persian';

export const idSchema = z.uuid({ message: 'شناسه نامعتبر است.' });

export const SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(160)
  .regex(SLUG_PATTERN, 'نامک فقط می‌تواند شامل حروف، اعداد و خط تیره باشد.');

/** Trimmed, Persian-normalized single line text. */
export const textSchema = (options: { min?: number; max?: number } = {}) =>
  z
    .string()
    .transform((value) => normalizePersian(value))
    .pipe(
      z
        .string()
        .min(options.min ?? 1, options.min === 0 ? undefined : 'این فیلد الزامی است.')
        .max(options.max ?? 200, `حداکثر ${options.max ?? 200} کاراکتر مجاز است.`),
    );

export const optionalTextSchema = (max = 500) =>
  z
    .string()
    .transform((value) => normalizePersian(value))
    .pipe(z.string().max(max, `حداکثر ${max} کاراکتر مجاز است.`))
    .nullish()
    .transform((value) => (value ? value : null));

/** Multi-line text: keeps line breaks, normalizes characters. */
export const longTextSchema = (max = 20000) =>
  z
    .string()
    .transform((value) =>
      value
        .split('\n')
        .map((line) => normalizePersian(line))
        .join('\n')
        .trim(),
    )
    .pipe(z.string().max(max, `حداکثر ${max} کاراکتر مجاز است.`));

export const mobileSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeIranianMobile(value);
  if (!normalized) {
    ctx.addIssue({ code: 'custom', message: 'شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹).' });
    return z.NEVER;
  }
  return normalized;
});

export const postalCodeSchema = z
  .string()
  .transform((value) => toEnglishDigits(value).replace(/[\s-]/g, ''))
  .refine(isValidPostalCode, 'کد پستی باید ۱۰ رقم و معتبر باشد.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'ایمیل معتبر نیست.' }));

/** Amount in Rial. Accepts numeric strings with Persian digits. */
export const rialSchema = z.preprocess(
  (value) =>
    typeof value === 'string' ? Number(toEnglishDigits(value).replace(/[,٬\s]/g, '')) : value,
  z
    .number({ message: 'مبلغ معتبر نیست.' })
    .int('مبلغ باید عدد صحیح باشد.')
    .min(0, 'مبلغ نمی‌تواند منفی باشد.')
    .max(Number.MAX_SAFE_INTEGER),
);

export const urlSchema = z.url({ message: 'آدرس اینترنتی معتبر نیست.' });

/** Accepts an absolute http(s) URL or a site-relative path (e.g. /uploads/a.webp). */
export const assetUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => /^https?:\/\/[^\s]+$/i.test(value) || /^\/[^\s/][^\s]*$/.test(value),
    'آدرس فایل معتبر نیست.',
  );

const booleanFromQuery = z.preprocess((value) => {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
}, z.boolean());

export const queryBoolean = booleanFromQuery;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const listQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

/** Gregorian "YYYY-MM-DD" naming a calendar day in Tehran (see `tehranDayRange`). */
export const dateKeySchema = z.string().trim().refine(isDateKey, 'تاریخ معتبر نیست.');

/** Inclusive date-range filter shared by admin lists. */
export const dateRangeQueryFields = {
  from: dateKeySchema.optional(),
  to: dateKeySchema.optional(),
};

/** Amount filter entered in Toman (the API converts to Rial). */
export const tomanQuerySchema = z.coerce.number().int().min(0).max(1_000_000_000_000).optional();

export const queryFlag = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

/** Searchable, paginated admin list with a date range. */
export const adminListQuerySchema = listQuerySchema.extend(dateRangeQueryFields);
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
