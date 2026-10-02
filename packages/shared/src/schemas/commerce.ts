import { z } from 'zod';
import { COUPON_TYPES, PAYMENT_STATUSES } from '../commerce/enums';
import { ORDER_STATUSES } from '../commerce/order-status';
import { IRAN_PROVINCE_NAMES } from '../iran/provinces';
import {
  idSchema,
  adminListQuerySchema,
  listQuerySchema,
  tomanQuerySchema,
  mobileSchema,
  optionalTextSchema,
  postalCodeSchema,
  rialSchema,
  textSchema,
} from './common';

export const MAX_CART_LINE_QUANTITY = 999;

export const addCartItemSchema = z.object({
  variantId: idSchema,
  quantity: z.coerce.number().int().min(1).max(MAX_CART_LINE_QUANTITY).default(1),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(MAX_CART_LINE_QUANTITY),
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const applyCouponSchema = z.object({
  code: z.string().trim().toUpperCase().min(2, 'کد تخفیف را وارد کنید.').max(40),
});
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;

export const addressUpsertSchema = z.object({
  title: optionalTextSchema(60),
  recipientName: textSchema({ max: 120 }),
  recipientMobile: mobileSchema,
  province: z.enum(IRAN_PROVINCE_NAMES as [string, ...string[]], {
    message: 'استان را انتخاب کنید.',
  }),
  city: textSchema({ max: 80 }),
  addressLine: textSchema({ min: 10, max: 500 }),
  plaque: optionalTextSchema(20),
  unit: optionalTextSchema(20),
  postalCode: postalCodeSchema,
  isDefault: z.boolean().default(false),
});
export type AddressUpsertInput = z.infer<typeof addressUpsertSchema>;

export const checkoutSchema = z.object({
  addressId: idSchema,
  shippingMethodId: idSchema,
  note: optionalTextSchema(1000),
  paymentProvider: z.string().trim().max(40).optional(),
  /**
   * Total the customer saw on the checkout page. If the server-side total differs the
   * order is not created and the client must refresh (prices are never taken from it).
   */
  expectedTotal: rialSchema.optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const couponUpsertSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/, 'کد باید انگلیسی و بین ۳ تا ۴۰ کاراکتر باشد.'),
    description: optionalTextSchema(300),
    type: z.enum(COUPON_TYPES),
    value: z.coerce.number().int().min(0),
    maxDiscount: rialSchema.nullish().transform((v) => v || null),
    minSubtotal: rialSchema.nullish().transform((v) => v || null),
    startsAt: z.coerce
      .date()
      .nullish()
      .transform((v) => v ?? null),
    endsAt: z.coerce
      .date()
      .nullish()
      .transform((v) => v ?? null),
    usageLimit: z.coerce
      .number()
      .int()
      .min(1)
      .nullish()
      .transform((v) => v ?? null),
    perCustomerLimit: z.coerce
      .number()
      .int()
      .min(1)
      .nullish()
      .transform((v) => v ?? null),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'percent' && (value.value < 1 || value.value > 100)) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.',
      });
    }
    if (value.type === 'fixed' && value.value < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'مبلغ تخفیف باید بیشتر از صفر باشد.',
      });
    }
    if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'تاریخ پایان باید بعد از تاریخ شروع باشد.',
      });
    }
  });
export type CouponUpsertInput = z.infer<typeof couponUpsertSchema>;

export const shippingMethodUpsertSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{2,40}$/),
  name: textSchema({ max: 120 }),
  description: optionalTextSchema(300),
  baseCost: rialSchema,
  freeShippingThreshold: rialSchema.nullish().transform((v) => v || null),
  estimatedDaysMin: z.coerce.number().int().min(0).max(60).default(1),
  estimatedDaysMax: z.coerce.number().int().min(0).max(60).default(3),
  provinces: z.array(z.enum(IRAN_PROVINCE_NAMES as [string, ...string[]])).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});
export type ShippingMethodUpsertInput = z.infer<typeof shippingMethodUpsertSchema>;

export const orderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: optionalTextSchema(1000),
  trackingCode: optionalTextSchema(80),
});
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;

export const cancelOrderSchema = z.object({
  reason: optionalTextSchema(500),
});
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export const ORDER_SORTS = ['newest', 'oldest', 'total_desc', 'total_asc'] as const;
export const adminOrderListQuerySchema = adminListQuerySchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  customerId: idSchema.optional(),
  shippingMethodId: idSchema.optional(),
  minTotal: tomanQuerySchema,
  maxTotal: tomanQuerySchema,
  sort: z.enum(ORDER_SORTS).optional(),
});
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;

export const refundSchema = z.object({
  amount: rialSchema.optional(),
  reason: optionalTextSchema(500),
});
export type RefundInput = z.infer<typeof refundSchema>;

export const adminPaymentListQuerySchema = adminListQuerySchema.extend({
  status: z.enum(PAYMENT_STATUSES).optional(),
  provider: z.string().trim().max(40).optional(),
  minAmount: tomanQuerySchema,
  maxAmount: tomanQuerySchema,
});
export type AdminPaymentListQuery = z.infer<typeof adminPaymentListQuerySchema>;

export const adminCouponListQuerySchema = listQuerySchema.extend({
  state: z.enum(['active', 'inactive', 'expired', 'scheduled']).optional(),
});
export type AdminCouponListQuery = z.infer<typeof adminCouponListQuerySchema>;
