/**
 * Domain vocabulary for the tools market. Each group lists terms customers use
 * interchangeably; the search module normalizes them and registers every term of a
 * group as a synonym of the others. Extend freely – reindexing is not required,
 * only a settings sync (done automatically on API start).
 */
export const SEARCH_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['دریل', 'drill'],
  ['شارژی', 'باتری‌دار', 'بی‌سیم', 'cordless'],
  ['بتن‌کن', 'هیلتی', 'روتاری', 'rotary hammer'],
  ['چکشی', 'ضربه‌ای', 'impact'],
  ['پیچ‌گوشتی', 'پیچ‌بند', 'screwdriver'],
  ['فرز', 'سنگ‌فرز', 'سنگ فرز', 'grinder'],
  ['مینی‌فرز', 'فرز کوچک', 'mini grinder'],
  ['اره', 'saw'],
  ['عمودبر', 'اره عمودبر', 'jigsaw'],
  ['اره گرد', 'اره دیسکی', 'circular saw'],
  ['مته', 'bit', 'drill bit'],
  ['صفحه برش', 'صفحه سنگ', 'cutting disc'],
  ['آچار', 'wrench', 'spanner'],
  ['انبردست', 'pliers'],
  ['ولت', 'v', 'volt'],
  ['وات', 'w', 'watt'],
  ['آمپر ساعت', 'ah'],
  ['نیوتن متر', 'nm'],
  ['دور در دقیقه', 'rpm'],
  ['میلی‌متر', 'میل', 'mm'],
  ['سانتی‌متر', 'سانت', 'cm'],
  ['کیلوگرم', 'کیلو', 'kg'],
  ['اینچ', 'inch'],
];
