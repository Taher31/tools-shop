import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  SYSTEM_ROLES,
  addressUpsertSchema,
  hasPermission,
  productUpsertSchema,
  registerSchema,
} from '../src';

const baseProduct = {
  title: 'دريل شارژی ۱۸ ولت',
  categoryId: '0198d7a2-3f1e-7c4b-9a51-2b6f0c1d2e3f',
  variants: [{ sku: 'tsd-18v', price: '45000000' }],
};

describe('productUpsertSchema', () => {
  it('normalizes text and coerces prices', () => {
    const parsed = productUpsertSchema.parse(baseProduct);
    expect(parsed.title).toBe('دریل شارژی ۱۸ ولت');
    expect(parsed.variants[0]?.sku).toBe('TSD-18V');
    expect(parsed.variants[0]?.price).toBe(45_000_000);
    expect(parsed.status).toBe('draft');
  });

  it('rejects duplicate SKUs', () => {
    const result = productUpsertSchema.safeParse({
      ...baseProduct,
      variants: [
        { sku: 'A-1', price: 10 },
        { sku: 'a-1', price: 20 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects compare-at price lower than price', () => {
    const result = productUpsertSchema.safeParse({
      ...baseProduct,
      variants: [{ sku: 'A-1', price: 100, compareAtPrice: 90 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('normalizes the mobile number', () => {
    const parsed = registerSchema.parse({
      firstName: 'علی',
      lastName: 'رضایی',
      mobile: '۰۹۱۲۱۲۳۴۵۶۷',
      password: 'secret123',
    });
    expect(parsed.mobile).toBe('09121234567');
  });
});

describe('addressUpsertSchema', () => {
  it('requires a known province and a valid postal code', () => {
    const result = addressUpsertSchema.safeParse({
      recipientName: 'علی رضایی',
      recipientMobile: '09121234567',
      province: 'ناکجاآباد',
      city: 'تهران',
      addressLine: 'خیابان آزادی، کوچه یکم، پلاک ۱',
      postalCode: '123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toEqual(expect.arrayContaining(['province', 'postalCode']));
    }
  });
});

describe('permissions', () => {
  it('gives super admin every permission', () => {
    const superAdmin = SYSTEM_ROLES.find((role) => role.key === 'super_admin');
    expect(superAdmin?.permissions).toEqual(ALL_PERMISSIONS);
  });

  it('only references known permissions in system roles', () => {
    for (const role of SYSTEM_ROLES) {
      for (const permission of role.permissions) expect(ALL_PERMISSIONS).toContain(permission);
    }
  });

  it('checks required permissions', () => {
    expect(hasPermission(['order.read', 'order.update'], ['order.read'])).toBe(true);
    expect(hasPermission(['order.read'], 'payment.refund')).toBe(false);
  });
});
