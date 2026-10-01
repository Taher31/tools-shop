import { describe, expect, it } from 'vitest';
import { calculateTotals, type PricingInput } from '../../src/modules/pricing/pricing';

const NO_TAX = { ratePercent: 0, included: true };

function input(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    lines: [
      { unitPrice: 1_000_000, compareAtPrice: 1_200_000, quantity: 2 },
      { unitPrice: 500_000, compareAtPrice: null, quantity: 1 },
    ],
    tax: NO_TAX,
    ...overrides,
  };
}

describe('calculateTotals', () => {
  it('sums lines, items and product savings', () => {
    const result = calculateTotals(input());
    expect(result.lineTotals).toEqual([2_000_000, 500_000]);
    expect(result.subtotal).toBe(2_500_000);
    expect(result.itemsCount).toBe(3);
    expect(result.productSavings).toBe(400_000);
    expect(result.total).toBe(2_500_000);
    expect(result.shippingCost).toBeNull();
  });

  it('ignores a compare-at price that is not higher than the selling price', () => {
    const result = calculateTotals(
      input({ lines: [{ unitPrice: 100, compareAtPrice: 90, quantity: 3 }] }),
    );
    expect(result.productSavings).toBe(0);
  });

  it('applies a percent coupon with floor rounding and a discount cap', () => {
    const coupon = {
      code: 'P10',
      type: 'percent' as const,
      value: 10,
      maxDiscount: null,
      minSubtotal: null,
    };
    expect(
      calculateTotals(
        input({ lines: [{ unitPrice: 999, compareAtPrice: null, quantity: 1 }], coupon }),
      ).couponDiscount,
    ).toBe(99);

    const capped = calculateTotals(input({ coupon: { ...coupon, maxDiscount: 100_000 } }));
    expect(capped.couponApplied).toBe(true);
    expect(capped.couponDiscount).toBe(100_000);
    expect(capped.total).toBe(2_400_000);
  });

  it('clamps out-of-range percentages and never discounts below zero', () => {
    const coupon = {
      code: 'ALL',
      type: 'percent' as const,
      value: 250,
      maxDiscount: null,
      minSubtotal: null,
    };
    expect(calculateTotals(input({ coupon })).total).toBe(0);
    const fixed = {
      code: 'BIG',
      type: 'fixed' as const,
      value: 9_000_000,
      maxDiscount: null,
      minSubtotal: null,
    };
    const result = calculateTotals(input({ coupon: fixed }));
    expect(result.couponDiscount).toBe(2_500_000);
    expect(result.total).toBe(0);
  });

  it('rejects a coupon below its minimum subtotal with a Persian message', () => {
    const coupon = {
      code: 'MIN',
      type: 'fixed' as const,
      value: 50_000,
      maxDiscount: null,
      minSubtotal: 3_000_000,
    };
    const result = calculateTotals(input({ coupon }));
    expect(result.couponApplied).toBe(false);
    expect(result.couponDiscount).toBe(0);
    expect(result.couponError).toContain('MIN');
  });

  it('charges shipping until the free-shipping threshold is reached after discounts', () => {
    const shipping = { cost: 600_000, freeShippingThreshold: 2_500_000 };
    expect(calculateTotals(input({ shipping })).shippingCost).toBe(0);

    const coupon = {
      code: 'F1',
      type: 'fixed' as const,
      value: 1,
      maxDiscount: null,
      minSubtotal: null,
    };
    const belowThreshold = calculateTotals(input({ shipping, coupon }));
    expect(belowThreshold.shippingCost).toBe(600_000);
    expect(belowThreshold.total).toBe(2_499_999 + 600_000);
  });

  it('makes shipping free with a free_shipping coupon without discounting merchandise', () => {
    const coupon = {
      code: 'SHIP',
      type: 'free_shipping' as const,
      value: 0,
      maxDiscount: null,
      minSubtotal: null,
    };
    const result = calculateTotals(
      input({ coupon, shipping: { cost: 600_000, freeShippingThreshold: null } }),
    );
    expect(result.couponDiscount).toBe(0);
    expect(result.shippingCost).toBe(0);
    expect(result.total).toBe(2_500_000);
  });

  it('reports VAT that is included in catalog prices without adding it', () => {
    const result = calculateTotals(input({ tax: { ratePercent: 10, included: true } }));
    expect(result.tax).toBe(Math.floor((2_500_000 * 10) / 110));
    expect(result.total).toBe(2_500_000);
  });

  it('adds VAT on top of the discounted merchandise when prices exclude it', () => {
    const coupon = {
      code: 'F',
      type: 'fixed' as const,
      value: 500_000,
      maxDiscount: null,
      minSubtotal: null,
    };
    const result = calculateTotals(
      input({
        coupon,
        tax: { ratePercent: 10, included: false },
        shipping: { cost: 100_000, freeShippingThreshold: null },
      }),
    );
    expect(result.tax).toBe(200_000);
    expect(result.total).toBe(2_000_000 + 200_000 + 100_000);
  });

  it('only produces integer amounts', () => {
    const result = calculateTotals({
      lines: [{ unitPrice: 333_333, compareAtPrice: null, quantity: 7 }],
      coupon: { code: 'P', type: 'percent', value: 7, maxDiscount: null, minSubtotal: null },
      tax: { ratePercent: 9, included: false },
    });
    for (const amount of [result.subtotal, result.couponDiscount, result.tax, result.total]) {
      expect(Number.isInteger(amount)).toBe(true);
    }
  });
});
