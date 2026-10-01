import { z } from 'zod';
import { queryBoolean } from './common';

export const PRODUCT_SORTS = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'bestselling',
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  relevance: 'مرتبط‌ترین',
  newest: 'جدیدترین',
  price_asc: 'ارزان‌ترین',
  price_desc: 'گران‌ترین',
  bestselling: 'پرفروش‌ترین',
};

const csv = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) =>
    (Array.isArray(value) ? value : value ? value.split(',') : [])
      .map((v) => v.trim())
      .filter(Boolean),
  );

/**
 * Storefront product search/listing query. Attribute filters use `attr.<code>=v1,v2`
 * query parameters; they are collected by the API into `attributes`.
 */
export const productSearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(160).optional(),
  brand: csv,
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  inStock: queryBoolean.optional(),
  onSale: queryBoolean.optional(),
  sort: z.enum(PRODUCT_SORTS).default('relevance'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
  attributes: z.record(z.string(), z.array(z.string().max(80)).max(20)).default({}),
});
export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;

export const ATTRIBUTE_FILTER_PREFIX = 'attr.';
