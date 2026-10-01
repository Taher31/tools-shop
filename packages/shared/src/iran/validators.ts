import { toEnglishDigits } from '../text/persian';

/** Normalizes an Iranian mobile number to the `09xxxxxxxxx` form, or returns null. */
export function normalizeIranianMobile(input: string): string | null {
  const digits = toEnglishDigits(input).replace(/[\s\-()]/g, '');
  const match = /^(?:\+98|0098|98|0)?(9\d{9})$/.exec(digits);
  return match ? `0${match[1]}` : null;
}

export function isValidIranianMobile(input: string): boolean {
  return normalizeIranianMobile(input) !== null;
}

/** Iranian postal codes are 10 digits; the first five never contain 0 or 2. */
export function isValidPostalCode(input: string): boolean {
  const digits = toEnglishDigits(input).replace(/[\s-]/g, '');
  return /^(?!(\d)\1{9})[13-9]{5}\d{5}$/.test(digits);
}

/** Validates the checksum of an Iranian national code (کد ملی). */
export function isValidNationalCode(input: string): boolean {
  const code = toEnglishDigits(input).replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(code) || /^(\d)\1{9}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits[9] ?? -1;
  const sum = digits.slice(0, 9).reduce((acc, digit, index) => acc + digit * (10 - index), 0);
  const remainder = sum % 11;
  return remainder < 2 ? check === remainder : check === 11 - remainder;
}
