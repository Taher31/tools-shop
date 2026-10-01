import { describe, expect, it } from 'vitest';
import {
  buildSearchVariants,
  normalizeForSearch,
  normalizePersian,
  slugify,
  toEnglishDigits,
  toPersianDigits,
} from '../src';

describe('digits', () => {
  it('converts Persian and Arabic digits to ASCII', () => {
    expect(toEnglishDigits('۱۸ ولت و ٢٠ آمپر')).toBe('18 ولت و 20 آمپر');
  });

  it('converts ASCII digits to Persian', () => {
    expect(toPersianDigits(1404)).toBe('۱۴۰۴');
  });
});

describe('normalizePersian', () => {
  it('maps Arabic letters to Persian and keeps ZWNJ', () => {
    expect(normalizePersian('كليد  ي  مي‌خواهم')).toBe('کلید ی می‌خواهم');
  });

  it('removes spaces around ZWNJ and tatweel', () => {
    expect(normalizePersian('میلی ‌ متر  دریـــل')).toBe('میلی‌متر دریل');
  });
});

describe('normalizeForSearch', () => {
  it('treats Persian and English digits the same', () => {
    expect(normalizeForSearch('دریل ۱۸ ولت')).toBe(normalizeForSearch('دریل 18 ولت'));
  });

  it('splits numbers glued to units', () => {
    expect(normalizeForSearch('دریل شارژی 18ولت')).toBe('دریل شارژی 18 ولت');
    expect(normalizeForSearch('18V')).toBe('18 v');
  });

  it('turns ZWNJ into a space', () => {
    expect(normalizeForSearch('بتن‌کن')).toBe('بتن کن');
  });

  it('keeps decimals intact', () => {
    expect(normalizeForSearch('مته ۶٫۵ میلیمتر')).toBe('مته 6.5 میلیمتر');
  });

  it('folds hamza and alef variants', () => {
    expect(normalizeForSearch('مسئله آچار')).toBe('مسیله اچار');
  });
});

describe('buildSearchVariants', () => {
  it('adds a joined variant for ZWNJ words', () => {
    expect(buildSearchVariants('میلی‌متر')).toBe('میلی متر میلیمتر');
  });

  it('returns a single variant when there is no ZWNJ', () => {
    expect(buildSearchVariants('دریل')).toBe('دریل');
  });
});

describe('slugify', () => {
  it('keeps Persian letters and joins words with dashes', () => {
    expect(slugify('دریل شارژی ۱۸ ولت')).toBe('دریل-شارژی-18-ولت');
  });

  it('handles latin text and ZWNJ', () => {
    expect(slugify('مینی‌فرز GWS 750')).toBe('مینی-فرز-gws-750');
  });
});
