import { describe, expect, it } from 'vitest';
import { assertRial, discountPercent, formatPrice, percentOf, rialToToman } from '../src';

describe('money', () => {
  it('converts rial to toman', () => {
    expect(rialToToman(125_000)).toBe(12_500);
  });

  it('formats prices in toman with Persian digits', () => {
    expect(formatPrice(12_500_000)).toBe('۱٬۲۵۰٬۰۰۰ تومان');
    expect(formatPrice(12_500_000, { currency: 'IRR', withUnit: false })).toBe('۱۲٬۵۰۰٬۰۰۰');
  });

  it('rounds percentages down', () => {
    expect(percentOf(999, 10)).toBe(99);
  });

  it('computes discount percent', () => {
    expect(discountPercent(1_000_000, 850_000)).toBe(15);
    expect(discountPercent(null, 850_000)).toBe(0);
    expect(discountPercent(800_000, 850_000)).toBe(0);
  });

  it('rejects non-integer amounts', () => {
    expect(() => assertRial(10.5)).toThrow(RangeError);
    expect(() => assertRial(-1)).toThrow(RangeError);
  });
});
