import { describe, expect, it } from 'vitest';
import { isValidNationalCode, isValidPostalCode, normalizeIranianMobile } from '../src';

describe('Iranian validators', () => {
  it('normalizes mobile numbers in different formats', () => {
    expect(normalizeIranianMobile('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    expect(normalizeIranianMobile('+989123456789')).toBe('09123456789');
    expect(normalizeIranianMobile('9123456789')).toBe('09123456789');
    expect(normalizeIranianMobile('0912 345 6789')).toBe('09123456789');
    expect(normalizeIranianMobile('02112345678')).toBeNull();
  });

  it('validates postal codes', () => {
    expect(isValidPostalCode('1193653471')).toBe(true);
    expect(isValidPostalCode('۱۱۹۳۶۵۳۴۷۱')).toBe(true);
    expect(isValidPostalCode('0123456789')).toBe(false);
    expect(isValidPostalCode('12345')).toBe(false);
  });

  it('validates national code checksum', () => {
    expect(isValidNationalCode('0499370899')).toBe(true);
    expect(isValidNationalCode('0499370898')).toBe(false);
    expect(isValidNationalCode('1111111111')).toBe(false);
  });
});
