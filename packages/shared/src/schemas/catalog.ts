import { z } from 'zod';
import { ATTRIBUTE_TYPES, PRODUCT_STATUSES, USAGE_TYPES } from '../commerce/enums';
import {
  assetUrlSchema,
  idSchema,
  listQuerySchema,
  longTextSchema,
  optionalTextSchema,
  rialSchema,
  slugSchema,
  textSchema,
  urlSchema,
} from './common';

const seoSchema = {
  seoTitle: optionalTextSchema(160),
  seoDescription: optionalTextSchema(320),
};

export const categoryUpsertSchema = z.object({
  name: textSchema({ max: 120 }),
  slug: slugSchema.optional(),
  parentId: idSchema.nullish().transform((value) => value ?? null),
  description: optionalTextSchema(2000),
  imageUrl: assetUrlSchema.nullish().transform((value) => value ?? null),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
  ...seoSchema,
});
export type CategoryUpsertInput = z.infer<typeof categoryUpsertSchema>;

export const categoryAttributesSchema = z.object({
  attributes: z
    .array(
      z.object({
        attributeId: idSchema,
        isRequired: z.boolean().default(false),
        isFilterable: z.boolean().default(true),
        sortOrder: z.coerce.number().int().min(0).default(0),
      }),
    )
    .max(100),
});
export type CategoryAttributesInput = z.infer<typeof categoryAttributesSchema>;

export const brandUpsertSchema = z.object({
  name: textSchema({ max: 120 }),
  englishName: optionalTextSchema(120),
  slug: slugSchema.optional(),
  logoUrl: assetUrlSchema.nullish().transform((value) => value ?? null),
  description: optionalTextSchema(2000),
  country: optionalTextSchema(80),
  website: urlSchema.nullish().or(z.literal('').transform(() => null)),
  isActive: z.boolean().default(true),
  ...seoSchema,
});
export type BrandUpsertInput = z.infer<typeof brandUpsertSchema>;

export const ATTRIBUTE_CODE_PATTERN = /^[a-z][a-z0-9_]{1,62}$/;

export const attributeOptionSchema = z.object({
  value: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[\p{L}\p{N}_.-]+$/u, 'مقدار گزینه فقط شامل حروف، اعداد، نقطه و خط تیره باشد.'),
  label: textSchema({ max: 120 }),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const attributeUpsertSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(
        ATTRIBUTE_CODE_PATTERN,
        'کد ویژگی باید انگلیسی، با حروف کوچک و زیرخط باشد (مثال: chuck_size).',
      ),
    name: textSchema({ max: 120 }),
    type: z.enum(ATTRIBUTE_TYPES),
    unit: optionalTextSchema(30),
    groupName: optionalTextSchema(80),
    description: optionalTextSchema(500),
    isFilterable: z.boolean().default(false),
    isSearchable: z.boolean().default(true),
    isComparable: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).default(0),
    options: z.array(attributeOptionSchema).max(200).default([]),
  })
  .superRefine((value, ctx) => {
    const needsOptions = value.type === 'select' || value.type === 'multiselect';
    if (needsOptions && value.options.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'برای ویژگی انتخابی حداقل یک گزینه لازم است.',
      });
    }
    const values = value.options.map((option) => option.value);
    if (new Set(values).size !== values.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'مقدار گزینه‌ها نباید تکراری باشد.',
      });
    }
  });
export type AttributeUpsertInput = z.infer<typeof attributeUpsertSchema>;

/** Raw attribute value as submitted; validated against the attribute type on the server. */
export const attributeValueInputSchema = z.object({
  attributeId: idSchema,
  value: z.union([
    z.string().max(500),
    z.number().finite(),
    z.boolean(),
    z.array(z.string().max(80)).max(50),
  ]),
});
export type AttributeValueInput = z.infer<typeof attributeValueInputSchema>;

export const variantOptionSchema = z.object({
  name: textSchema({ max: 60 }),
  value: textSchema({ max: 60 }),
});

export const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;

export const productVariantInputSchema = z
  .object({
    id: idSchema.optional(),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        SKU_PATTERN,
        'SKU باید انگلیسی باشد و فقط شامل حروف، اعداد، نقطه، خط تیره و زیرخط باشد.',
      ),
    barcode: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z-]{4,64}$/, 'بارکد معتبر نیست.')
      .nullish()
      .or(z.literal('').transform(() => null)),
    title: optionalTextSchema(120),
    options: z.array(variantOptionSchema).max(5).default([]),
    price: rialSchema,
    compareAtPrice: rialSchema.nullish().transform((value) => value || null),
    lowStockThreshold: z.coerce.number().int().min(0).max(100000).default(2),
    weightGrams: z.coerce.number().int().min(0).max(10_000_000).nullish(),
    isActive: z.boolean().default(true),
  })
  .refine((value) => value.compareAtPrice === null || value.compareAtPrice > value.price, {
    path: ['compareAtPrice'],
    message: 'قیمت قبل از تخفیف باید بیشتر از قیمت فروش باشد.',
  });
export type ProductVariantInput = z.infer<typeof productVariantInputSchema>;

export const productImageInputSchema = z.object({
  url: assetUrlSchema,
  alt: optionalTextSchema(200),
});

export const productUpsertSchema = z
  .object({
    title: textSchema({ max: 200 }),
    englishTitle: optionalTextSchema(200),
    slug: slugSchema.optional(),
    status: z.enum(PRODUCT_STATUSES).default('draft'),
    categoryId: idSchema,
    brandId: idSchema.nullish().transform((value) => value ?? null),
    model: optionalTextSchema(120),
    manufacturer: optionalTextSchema(120),
    countryOfOrigin: optionalTextSchema(80),
    usageType: z
      .enum(USAGE_TYPES)
      .nullish()
      .transform((value) => value ?? null),
    warranty: optionalTextSchema(200),
    shortDescription: optionalTextSchema(600),
    description: longTextSchema(50000)
      .nullish()
      .transform((value) => value || null),
    videoUrl: urlSchema.nullish().or(z.literal('').transform(() => null)),
    tags: z
      .array(textSchema({ max: 40 }))
      .max(30)
      .default([]),
    images: z.array(productImageInputSchema).max(20).default([]),
    attributes: z.array(attributeValueInputSchema).max(100).default([]),
    variants: z.array(productVariantInputSchema).min(1, 'حداقل یک تنوع (SKU) لازم است.').max(100),
    relatedProductIds: z.array(idSchema).max(30).default([]),
    accessoryProductIds: z.array(idSchema).max(30).default([]),
    isFeatured: z.boolean().default(false),
    canonicalUrl: urlSchema.nullish().or(z.literal('').transform(() => null)),
    ...seoSchema,
  })
  .superRefine((value, ctx) => {
    const skus = value.variants.map((variant) => variant.sku);
    if (new Set(skus).size !== skus.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['variants'],
        message: 'SKU تنوع‌ها نباید تکراری باشد.',
      });
    }
    const attributeIds = value.attributes.map((attribute) => attribute.attributeId);
    if (new Set(attributeIds).size !== attributeIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['attributes'],
        message: 'هر ویژگی فقط یک بار قابل ثبت است.',
      });
    }
  });
export type ProductUpsertInput = z.infer<typeof productUpsertSchema>;

/** Quick price update used by the admin list and (later) by repricing integrations. */
export const variantPriceUpdateSchema = z
  .object({
    price: rialSchema,
    compareAtPrice: rialSchema.nullish().transform((value) => value || null),
  })
  .refine((value) => value.compareAtPrice === null || value.compareAtPrice > value.price, {
    path: ['compareAtPrice'],
    message: 'قیمت قبل از تخفیف باید بیشتر از قیمت فروش باشد.',
  });
export type VariantPriceUpdateInput = z.infer<typeof variantPriceUpdateSchema>;

export const adminProductListQuerySchema = listQuerySchema.extend({
  status: z.enum(PRODUCT_STATUSES).optional(),
  categoryId: idSchema.optional(),
  brandId: idSchema.optional(),
  lowStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;
