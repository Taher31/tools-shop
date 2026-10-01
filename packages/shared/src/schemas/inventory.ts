import { z } from 'zod';
import { idSchema, listQuerySchema, optionalTextSchema, textSchema } from './common';
import { IRAN_PROVINCE_NAMES } from '../iran/provinces';

export const warehouseUpsertSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{2,32}$/, 'کد انبار باید انگلیسی و بین ۲ تا ۳۲ کاراکتر باشد.'),
  name: textSchema({ max: 120 }),
  province: z.enum(IRAN_PROVINCE_NAMES as [string, ...string[]]).nullish().transform((v) => v ?? null),
  city: optionalTextSchema(80),
  address: optionalTextSchema(500),
  phone: optionalTextSchema(30),
  priority: z.coerce.number().int().min(0).max(1000).default(100),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});
export type WarehouseUpsertInput = z.infer<typeof warehouseUpsertSchema>;

/**
 * Manual stock operation by staff.
 * - `purchase`: goods received (quantity > 0)
 * - `return`: customer return put back on shelf (quantity > 0)
 * - `adjustment`: correction after a count; `quantity` is a signed delta
 * - `set`: correction to an absolute on-hand value (recorded as an adjustment)
 */
export const stockOperationSchema = z
  .object({
    variantId: idSchema,
    warehouseId: idSchema,
    type: z.enum(['purchase', 'return', 'adjustment', 'set']),
    quantity: z.coerce.number().int().min(-1_000_000).max(1_000_000),
    reference: optionalTextSchema(120),
    note: optionalTextSchema(500),
  })
  .superRefine((value, ctx) => {
    if ((value.type === 'purchase' || value.type === 'return') && value.quantity <= 0) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'تعداد باید بیشتر از صفر باشد.' });
    }
    if (value.type === 'adjustment' && value.quantity === 0) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'مقدار اصلاح نمی‌تواند صفر باشد.' });
    }
    if (value.type === 'set' && value.quantity < 0) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'موجودی نمی‌تواند منفی باشد.' });
    }
  });
export type StockOperationInput = z.infer<typeof stockOperationSchema>;

export const stockTransferSchema = z
  .object({
    variantId: idSchema,
    fromWarehouseId: idSchema,
    toWarehouseId: idSchema,
    quantity: z.coerce.number().int().min(1).max(1_000_000),
    note: optionalTextSchema(500),
  })
  .refine((value) => value.fromWarehouseId !== value.toWarehouseId, {
    path: ['toWarehouseId'],
    message: 'انبار مبدا و مقصد نباید یکسان باشند.',
  });
export type StockTransferInput = z.infer<typeof stockTransferSchema>;

export const inventoryListQuerySchema = listQuerySchema.extend({
  warehouseId: idSchema.optional(),
  lowStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
export type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>;

export const stockMovementListQuerySchema = listQuerySchema.extend({
  variantId: idSchema.optional(),
  warehouseId: idSchema.optional(),
  type: z
    .enum(['purchase', 'sale', 'return', 'adjustment', 'cancellation', 'transfer_in', 'transfer_out'])
    .optional(),
});
export type StockMovementListQuery = z.infer<typeof stockMovementListQuerySchema>;
