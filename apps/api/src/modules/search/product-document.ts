import type { Prisma } from '@toolshop/database';
import { buildSearchVariants, discountPercent, type KeySpec } from '@toolshop/shared';
import { toRial } from '../../common/utils/money';
import {
  ACTIVE_LEVELS_SELECT,
  displayVariant,
  keySpecs,
  parseVariantOptions,
  toStoredValue,
} from '../catalog/product-card';
import type { Taxonomy } from '../catalog/taxonomy';
import { availableQuantity } from '../inventory/stock';

export const DOCUMENT_INCLUDE = {
  images: { orderBy: { sortOrder: 'asc' }, take: 1 },
  variants: {
    where: { deletedAt: null, isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { inventoryLevels: ACTIVE_LEVELS_SELECT },
  },
  attributeValues: true,
} satisfies Prisma.ProductInclude;

export type DocumentSource = Prisma.ProductGetPayload<{ include: typeof DOCUMENT_INCLUDE }>;

/** Shape of a product in the Meilisearch index. Display fields are raw, *Search fields normalized. */
export interface ProductSearchDocument {
  id: string;
  slug: string;
  title: string;
  englishTitle: string | null;
  model: string | null;
  skus: string[];
  barcodes: string[];
  brandId: string | null;
  brandSlug: string | null;
  brandName: string | null;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  categoryIds: string[];
  titleSearch: string;
  modelSearch: string;
  brandSearch: string;
  categorySearch: string;
  tagsSearch: string;
  variantSearch: string;
  specsSearch: string;
  facets: string[];
  price: number;
  compareAtPrice: number | null;
  discountPercent: number;
  onSale: boolean;
  inStock: boolean;
  inStockRank: number;
  imageUrl: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  soldCount: number;
  isFeatured: boolean;
  publishedAt: number;
  variantCount: number;
  defaultVariantId: string | null;
  keySpecs: KeySpec[];
}

/** Returns null when the product must not be searchable (hidden, archived, no variants). */
export function buildProductDocument(
  product: DocumentSource,
  taxonomy: Taxonomy,
): ProductSearchDocument | null {
  if (product.status !== 'active' || product.deletedAt || product.variants.length === 0)
    return null;
  if (!taxonomy.isCategoryVisible(product.categoryId)) return null;
  const category = taxonomy.categoriesById.get(product.categoryId);
  if (!category) return null;
  const brand = product.brandId ? taxonomy.brandsById.get(product.brandId) : undefined;
  const ancestors = taxonomy.ancestors(product.categoryId);

  const variant = displayVariant(product.variants);
  const price = variant ? toRial(variant.price) : 0;
  const compareAtPrice = variant ? toRial(variant.compareAtPrice) : null;
  const inStock = product.variants.some((v) => availableQuantity(v.inventoryLevels) > 0);

  const facets = new Set<string>();
  const specTexts: string[] = [];
  for (const value of product.attributeValues) {
    const attribute = taxonomy.attributesById.get(value.attributeId);
    if (!attribute) continue;
    const stored = toStoredValue(value);
    taxonomy.facetTokens(attribute, stored).forEach((token) => facets.add(token));
    if (attribute.isSearchable && attribute.type !== 'boolean') {
      const formatted = taxonomy.formatValue(attribute, stored);
      if (formatted) specTexts.push(`${attribute.name} ${formatted}`);
    }
  }

  const variantTexts = product.variants.flatMap((v) => [
    v.title ?? '',
    ...parseVariantOptions(v.options).map((o) => `${o.name} ${o.value}`),
  ]);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    englishTitle: product.englishTitle,
    model: product.model,
    skus: product.variants.map((v) => v.sku),
    barcodes: product.variants.map((v) => v.barcode).filter((b): b is string => Boolean(b)),
    brandId: brand?.id ?? null,
    brandSlug: brand?.slug ?? null,
    brandName: brand?.name ?? null,
    categoryId: category.id,
    categorySlug: category.slug,
    categoryName: category.name,
    categoryIds: ancestors.map((c) => c.id),
    titleSearch: buildSearchVariants(`${product.title} ${product.englishTitle ?? ''}`),
    modelSearch: buildSearchVariants(product.model ?? ''),
    brandSearch: buildSearchVariants(`${brand?.name ?? ''} ${brand?.englishName ?? ''}`),
    categorySearch: buildSearchVariants(ancestors.map((c) => c.name).join(' ')),
    tagsSearch: buildSearchVariants(product.tags.join(' ')),
    variantSearch: buildSearchVariants(variantTexts.join(' ')),
    specsSearch: buildSearchVariants(specTexts.join(' ')),
    facets: [...facets],
    price,
    compareAtPrice,
    discountPercent: discountPercent(compareAtPrice, price),
    onSale: discountPercent(compareAtPrice, price) > 0,
    inStock,
    inStockRank: inStock ? 1 : 0,
    imageUrl: product.images[0]?.url ?? null,
    ratingAverage: product.ratingAverage ? product.ratingAverage.toNumber() : null,
    ratingCount: product.ratingCount,
    soldCount: product.soldCount,
    isFeatured: product.isFeatured,
    publishedAt: Math.floor((product.publishedAt ?? product.createdAt).getTime() / 1000),
    variantCount: product.variants.length,
    defaultVariantId: variant?.id ?? null,
    keySpecs: keySpecs(taxonomy, product.categoryId, product.attributeValues),
  };
}
