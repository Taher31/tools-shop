const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

// ZWJ is matched outside the class: inside one it would join with its neighbours.
const INVISIBLE_CHARS = /[\u200B\u200E\u200F\u2066-\u2069\uFEFF]|\u200D/g;
const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;

/** Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII digits. */
export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
}

/** Converts ASCII digits to Persian digits for display. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

/**
 * Display-safe canonical Persian text: Arabic ي/ك become Persian ی/ک, tatweel and
 * invisible direction marks are removed, spaces around ZWNJ are dropped and whitespace
 * is collapsed. Spelling (hamza, ۀ, superscripts...) is left untouched.
 */
export function normalizePersian(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(TATWEEL, '')
    .replace(INVISIBLE_CHARS, '')
    .replace(/[ \t]*\u200C+[ \t]*/g, '\u200C')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Aggressive normalization applied to search documents and queries alike:
 * - digits become ASCII ("۱۸" → "18") and Persian separators are unified
 * - letter variants and diacritics are folded (ئ→ی, ؤ→و, ة/ۀ→ه, أ/إ/آ→ا)
 * - ZWNJ becomes a space ("میلی‌متر" → "میلی متر")
 * - letters and digits are split apart ("18ولت" → "18 ولت", "18V" → "18 v")
 * - latin text is lower-cased
 */
export function normalizeForSearch(input: string): string {
  return toEnglishDigits(normalizePersian(input.normalize('NFKC')))
    .replace(/ئ/g, 'ی')
    .replace(/ؤ/g, 'و')
    .replace(/[ةۀ]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/٫/g, '.')
    .replace(/[٬،]/g, ' ')
    .replace(/\u200C/g, ' ')
    .replace(/(\d)([^\d\s.,/])/gu, '$1 $2')
    .replace(/([^\d\s.,/])(\d)/gu, '$1 $2')
    .replace(/[«»"'`()[\]{}!؟?;:…]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Searchable representation of a text: the split form plus a variant where ZWNJ-joined
 * parts are glued together ("میلی‌متر" → "میلی متر میلیمتر"), so a query typed with a
 * space, a ZWNJ or nothing at all reaches the same document.
 */
export function buildSearchVariants(input: string): string {
  const normalized = normalizeForSearch(input);
  const joined = normalizeForSearch(normalizePersian(input).replace(/\u200C/g, ''));
  return joined === normalized ? normalized : `${normalized} ${joined}`;
}

/**
 * URL slug that keeps Persian letters (search engines index them fine) and is stable
 * across Arabic/Persian character variants and digit scripts.
 */
export function slugify(input: string): string {
  return toEnglishDigits(normalizePersian(input))
    .replace(ARABIC_DIACRITICS, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
