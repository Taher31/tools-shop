import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, safeEqual, sha256 } from '../../src/common/utils/crypto';
import { diffSnapshots } from '../../src/common/utils/diff';
import { availabilityOf, availableQuantity, stockTotals } from '../../src/modules/inventory/stock';
import {
  startOfJalaliMonth,
  startOfTehranDay,
  tehranDateKey,
} from '../../src/modules/dashboard/tehran-time';

describe('diffSnapshots', () => {
  it('keeps only changed keys and makes values JSON-safe', () => {
    const before = {
      title: 'دریل',
      price: 10n,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      stock: 5,
    };
    const after = {
      title: 'دریل',
      price: 12n,
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      stock: 5,
    };
    expect(diffSnapshots(before, after)).toEqual({
      before: { price: 10, updatedAt: '2026-01-01T00:00:00.000Z' },
      after: { price: 12, updatedAt: '2026-01-02T00:00:00.000Z' },
    });
  });

  it('returns full sanitized snapshots for creations and deletions', () => {
    expect(diffSnapshots(null, { amount: 5n })).toEqual({ before: null, after: { amount: 5 } });
    expect(diffSnapshots({ amount: 5n }, null)).toEqual({ before: { amount: 5 }, after: null });
  });
});

describe('secret encryption', () => {
  const key = randomBytes(32);

  it('round-trips and uses a fresh IV every time', () => {
    const a = encryptSecret('sk-live-123', key);
    const b = encryptSecret('sk-live-123', key);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, key)).toBe('sk-live-123');
  });

  it('detects tampering and wrong keys', () => {
    const payload = Buffer.from(encryptSecret('secret', key), 'base64');
    const last = payload.length - 1;
    payload.writeUInt8(payload.readUInt8(last) ^ 1, last);
    expect(() => decryptSecret(payload.toString('base64'), key)).toThrow();
    expect(() => decryptSecret(encryptSecret('secret', key), randomBytes(32))).toThrow();
  });

  it('compares tokens safely', () => {
    expect(safeEqual(sha256('a'), sha256('a'))).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('stock helpers', () => {
  const levels = [
    { onHand: 5, reserved: 2 },
    { onHand: 1, reserved: 3 }, // inconsistent row must not subtract from other warehouses
  ];

  it('computes sellable quantity per warehouse', () => {
    expect(availableQuantity(levels)).toBe(3);
    expect(stockTotals(levels)).toEqual({ onHand: 6, reserved: 5, available: 3 });
  });

  it('classifies availability', () => {
    expect(availabilityOf(0, 3)).toBe('out_of_stock');
    expect(availabilityOf(3, 3)).toBe('low_stock');
    expect(availabilityOf(4, 3)).toBe('in_stock');
  });
});

describe('Tehran calendar helpers', () => {
  it('starts the day at Tehran midnight (UTC+03:30)', () => {
    expect(startOfTehranDay(new Date('2026-10-01T21:00:00Z')).toISOString()).toBe(
      '2026-10-01T20:30:00.000Z',
    );
    expect(startOfTehranDay(new Date('2026-10-01T20:00:00Z')).toISOString()).toBe(
      '2026-09-30T20:30:00.000Z',
    );
    expect(tehranDateKey(new Date('2026-10-01T21:00:00Z'))).toBe('2026-10-02');
  });

  it('finds the first day of the Jalali month', () => {
    // 1405-07-09 (Tehran) → 1 Mehr 1405 = 2026-09-23.
    expect(startOfJalaliMonth(new Date('2026-10-01T10:00:00Z')).toISOString()).toBe(
      '2026-09-22T20:30:00.000Z',
    );
  });
});
