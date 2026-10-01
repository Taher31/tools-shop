import type { Prisma } from '@toolshop/database';
import {
  discountPercent,
  type KeySpec,
  type ProductCard,
  type VariantOption,
} from '@toolshop/shared';
import { toRial } from '../../common/utils/money';
import { availableQuantity } from '../inventory/stock';
import type { StoredAttributeValue, Taxonomy } from './taxonomy';

export const ACTIVE_LEVELS_SELECT = {
  where: { warehouse: { isActive: true } },
  select: { onHand: true, reserved: true },
} as const;

export const PRODUCT_CARD_INCLUDE = {
  images: { orderBy: { sortOrder: 'asc' }, take: 1 },
  variants: {
    where: { isActive: true, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    include: { inventoryLevels: ACTIVE_LEVELS_SELECT },
  },
  attributeValues: true,
} satisfies Prisma.ProductInclude;

export type ProductCardRecord = Prisma.ProductGetPayload<{ include: typeof PRODUCT_CARD_INCLUDE }>;

/** Only products that customers may see. */
export const VISIBLE_PRODUCT_WHERE = {
  status: 'active',
  deletedAt: null,
} satisfies Prisma.ProductWhereInput;

export function toStoredValue(value: {
  textValue: string | null;
  numberValue: Prisma.Decimal | null;
  booleanValue: boolean | null;
  optionValues: string[];
}): StoredAttributeValue {
  return {
    textValue: value.textValue,
    numberValue: value.numberValue === null ? null : value.numberValue.toNumber(),
    booleanValue: value.booleanValue,
    optionValues: value.optionValues,
  };
}

export function parseVariantOptions(raw: unknown): VariantOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { name, value } = entry as { name?: unknown; value?: unknown };
    return typeof name === 'string' && typeof value === 'string' ? [{ name, value }] : [];
  });
}

/** Up to `limit` formatted specs, in the category's attribute order. */
export function keySpecs(
  taxonomy: Taxonomy,
  categoryId: string,
  values: ProductCardRecord['attributeValues'],
  limit = 3,
): KeySpec[] {
  const byAttribute = new Map(values.map((value) => [value.attributeId, value]));
  const specs: KeySpec[] = [];
  for (const effective of taxonomy.effectiveAttributes(categoryId)) {
    if (specs.length >= limit) break;
    const value = byAttribute.get(effective.attribute.id);
    if (!value || effective.attribute.type === 'boolean') continue;
    const formatted = taxonomy.formatValue(effective.attribute, toStoredValue(value));
    if (formatted) specs.push({ label: effective.attribute.name, value: formatted });
  }
  return specs;
}

/** The variant shown on cards: cheapest in-stock variant, else the cheapest one. */
export function displayVariant<
  V extends { price: bigint; inventoryLevels: { onHand: number; reserved: number }[] },
>(variants: V[]): V | undefined {
  const sorted = [...variants].sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0));
  return sorted.find((variant) => availableQuantity(variant.inventoryLevels) > 0) ?? sorted[0];
}

export function toProductCard(record: ProductCardRecord, taxonomy: Taxonomy): ProductCard {
  const variant = displayVariant(record.variants);
  const brand = record.brandId ? taxonomy.brandsById.get(record.brandId) : undefined;
  const category = taxonomy.categoriesById.get(record.categoryId);
  const price = variant ? toRial(variant.price) : 0;
  const compareAtPrice = variant ? toRial(variant.compareAtPrice) : null;
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    brand: brand ? { name: brand.name, slug: brand.slug } : null,
    category: category ? { name: category.name, slug: category.slug } : null,
    imageUrl: record.images[0]?.url ?? null,
    price,
    compareAtPrice,
    discountPercent: discountPercent(compareAtPrice, price),
    inStock: record.variants.some((v) => availableQuantity(v.inventoryLevels) > 0),
    variantCount: record.variants.length,
    defaultVariantId: variant?.id ?? null,
    ratingAverage: record.ratingAverage ? record.ratingAverage.toNumber() : null,
    ratingCount: record.ratingCount,
    keySpecs: keySpecs(taxonomy, record.categoryId, record.attributeValues),
  };
}
