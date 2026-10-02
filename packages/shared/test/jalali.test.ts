import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  dateKeyToJalali,
  isDateKey,
  jalaliMonthLength,
  jalaliToDateKey,
  tehranDateKey,
  tehranDayRange,
} from '../src/calendar/jalali';

const intl = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

function viaIntl(key: string) {
  const parts = Object.fromEntries(
    intl.formatToParts(new Date(`${key}T12:00:00Z`)).map((p) => [p.type, p.value]),
  );
  return { jy: Number(parts['year']), jm: Number(parts['month']), jd: Number(parts['day']) };
}

describe('jalali calendar', () => {
  it('matches the ICU Persian calendar day by day for 1395–1415', () => {
    let key = '2016-03-20';
    for (let i = 0; i < 365 * 20 + 5; i += 1) {
      const jalali = dateKeyToJalali(key);
      expect(jalali, key).toEqual(viaIntl(key));
      expect(jalaliToDateKey(jalali)).toBe(key);
      key = addDaysToKey(key, 1);
    }
  });

  it('knows month lengths and leap years', () => {
    expect(jalaliMonthLength(1403, 1)).toBe(31);
    expect(jalaliMonthLength(1403, 7)).toBe(30);
    expect(jalaliMonthLength(1403, 12)).toBe(30); // 1403 is leap
    expect(jalaliMonthLength(1404, 12)).toBe(29);
  });

  it('converts Tehran day ranges to half-open UTC instants', () => {
    const range = tehranDayRange('2026-10-01', '2026-10-01');
    expect(range?.gte?.toISOString()).toBe('2026-09-30T20:30:00.000Z');
    expect(range?.lt?.toISOString()).toBe('2026-10-01T20:30:00.000Z');
    expect(tehranDayRange(null, undefined)).toBeUndefined();
    expect(tehranDateKey(new Date('2026-09-30T21:00:00Z'))).toBe('2026-10-01');
  });

  it('validates date keys', () => {
    expect(isDateKey('2026-02-28')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('1405/07/10')).toBe(false);
  });
});
