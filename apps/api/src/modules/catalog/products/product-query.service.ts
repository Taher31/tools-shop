import { Injectable } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import {
  type CompareResult,
  discountPercent,
  type HomePageData,
  type ProductCard,
  type ProductDetail,
  type ProductSpec,
} from '@toolshop/shared';
import { AppException } from '../../../common/errors/app-exception';
import { toRial } from '../../../common/utils/money';
import { CacheService } from '../../../infrastructure/redis/cache.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import { availabilityOf, availableQuantity } from '../../inventory/stock';
import {
  ACTIVE_LEVELS_SELECT,
  PRODUCT_CARD_INCLUDE,
  parseVariantOptions,
  toProductCard,
  toStoredValue,
  VISIBLE_PRODUCT_WHERE,
} from '../product-card';
import type { Taxonomy } from '../taxonomy';
import { TaxonomyService } from '../taxonomy.service';

const DETAIL_INCLUDE = {
  brand: true,
  images: { orderBy: { sortOrder: 'asc' } },
  variants: {
    where: { isActive: true, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    include: { inventoryLevels: ACTIVE_LEVELS_SELECT },
  },
  attributeValues: true,
  relations: {
    orderBy: { sortOrder: 'asc' },
    where: { relatedProduct: VISIBLE_PRODUCT_WHERE },
    include: { relatedProduct: { include: PRODUCT_CARD_INCLUDE } },
  },
} satisfies Prisma.ProductInclude;

type DetailRecord = Prisma.ProductGetPayload<{ include: typeof DETAIL_INCLUDE }>;

const HOME_CACHE_KEY = 'catalog:home:v1';

/** Read side of the catalog for the storefront (always reads live price and stock). */
@Injectable()
export class ProductQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomyService: TaxonomyService,
    private readonly settings: SettingsService,
    private readonly cache: CacheService,
  ) {}

  async getDetail(slug: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findFirst({
      where: { slug, ...VISIBLE_PRODUCT_WHERE },
      include: DETAIL_INCLUDE,
    });
    const taxonomy = await this.taxonomyService.get();
    if (!product || !taxonomy.isCategoryVisible(product.categoryId)) {
      throw AppException.notFound('محصول یافت نشد.');
    }
    const { showStockCountBelow } = await this.settings.get('commerce');
    return this.toDetail(product, taxonomy, showStockCountBelow);
  }

  /** Product cards in the order of `ids` (unknown or hidden products are skipped). */
  async cardsByIds(ids: string[]): Promise<ProductCard[]> {
    if (ids.length === 0) return [];
    const [records, taxonomy] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: ids }, ...VISIBLE_PRODUCT_WHERE }, include: PRODUCT_CARD_INCLUDE }),
      this.taxonomyService.get(),
    ]);
    const byId = new Map(records.map((record) => [record.id, toProductCard(record, taxonomy)]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  async cards(
    where: Prisma.ProductWhereInput,
    orderBy: Prisma.ProductOrderByWithRelationInput[],
    take: number,
  ): Promise<ProductCard[]> {
    const [records, taxonomy] = await Promise.all([
      this.prisma.product.findMany({
        where: { ...VISIBLE_PRODUCT_WHERE, ...where },
        include: PRODUCT_CARD_INCLUDE,
        orderBy,
        take,
      }),
      this.taxonomyService.get(),
    ]);
    return records.filter((r) => taxonomy.isCategoryVisible(r.categoryId)).map((r) => toProductCard(r, taxonomy));
  }

  async home(): Promise<HomePageData> {
    return this.cache.wrap(HOME_CACHE_KEY, 60, async () => {
      const taxonomy = await this.taxonomyService.get();
      const [featured, newest, onSale, brands] = await Promise.all([
        this.cards({ isFeatured: true }, [{ soldCount: 'desc' }], 8),
        this.cards({}, [{ publishedAt: 'desc' }], 8),
        this.cards({ variants: { some: { isActive: true, deletedAt: null, compareAtPrice: { not: null } } } }, [{ updatedAt: 'desc' }], 8),
        this.prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, take: 12 }),
      ]);
      return {
        featured,
        newest,
        onSale: onSale.filter((card) => card.discountPercent > 0),
        categories: taxonomy.children(null, true).map((c) => ({ id: c.id, name: c.name, slug: c.slug, imageUrl: c.imageUrl })),
        brands: brands.map((b) => ({ id: b.id, name: b.name, englishName: b.englishName, slug: b.slug, logoUrl: b.logoUrl })),
      };
    });
  }

  async invalidateHome(): Promise<void> {
    await this.cache.del(HOME_CACHE_KEY);
  }

  async compare(ids: string[]): Promise<CompareResult> {
    const unique = [...new Set(ids)].slice(0, 4);
    const [records, taxonomy] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: unique }, ...VISIBLE_PRODUCT_WHERE },
        include: PRODUCT_CARD_INCLUDE,
      }),
      this.taxonomyService.get(),
    ]);
    const ordered = unique.flatMap((id) => records.find((r) => r.id === id) ?? []);
    const attributeIds = new Set<string>();
    const products = ordered.map((record) => {
      const card = toProductCard(record, taxonomy);
      const specs: Record<string, string> = {};
      for (const value of record.attributeValues) {
        const attribute = taxonomy.attributesById.get(value.attributeId);
        if (!attribute?.isComparable) continue;
        const formatted = taxonomy.formatValue(attribute, toStoredValue(value));
        if (formatted) {
          specs[attribute.code] = formatted;
          attributeIds.add(attribute.id);
        }
      }
      return {
        id: card.id,
        slug: card.slug,
        title: card.title,
        imageUrl: card.imageUrl,
        brand: card.brand?.name ?? null,
        price: card.price,
        inStock: card.inStock,
        specs,
      };
    });
    const attributes = [...attributeIds]
      .flatMap((id) => taxonomy.attributesById.get(id) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((a) => ({ code: a.code, name: a.name, unit: a.unit }));
    return { products, attributes };
  }

  private toDetail(product: DetailRecord, taxonomy: Taxonomy, showStockCountBelow: number): ProductDetail {
    const category = taxonomy.categoriesById.get(product.categoryId);
    if (!category) throw AppException.notFound('محصول یافت نشد.');

    const valuesByAttribute = new Map(product.attributeValues.map((value) => [value.attributeId, value]));
    const specs: ProductSpec[] = [];
    const used = new Set<string>();
    const pushSpec = (attributeId: string) => {
      const attribute = taxonomy.attributesById.get(attributeId);
      const value = valuesByAttribute.get(attributeId);
      if (!attribute || !value || used.has(attributeId)) return;
      const formatted = taxonomy.formatValue(attribute, toStoredValue(value));
      if (!formatted) return;
      used.add(attributeId);
      specs.push({
        attributeId,
        code: attribute.code,
        name: attribute.name,
        group: attribute.groupName,
        unit: attribute.unit,
        value: formatted,
        isComparable: attribute.isComparable,
      });
    };
    taxonomy.effectiveAttributes(product.categoryId).forEach((entry) => pushSpec(entry.attribute.id));
    product.attributeValues.forEach((value) => pushSpec(value.attributeId));

    const ratingAverage = product.ratingAverage ? product.ratingAverage.toNumber() : null;
    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      englishTitle: product.englishTitle,
      model: product.model,
      manufacturer: product.manufacturer,
      countryOfOrigin: product.countryOfOrigin,
      usageType: product.usageType,
      warranty: product.warranty,
      shortDescription: product.shortDescription,
      description: product.description,
      videoUrl: product.videoUrl,
      tags: product.tags,
      brand: product.brand
        ? {
            id: product.brand.id,
            name: product.brand.name,
            englishName: product.brand.englishName,
            slug: product.brand.slug,
            logoUrl: product.brand.logoUrl,
          }
        : null,
      category: { id: category.id, name: category.name, slug: category.slug, imageUrl: category.imageUrl },
      breadcrumbs: taxonomy.ancestors(category.id).map((c) => ({ name: c.name, slug: c.slug })),
      images: product.images.map((image) => ({ url: image.url, alt: image.alt })),
      specs,
      variants: product.variants.map((variant) => {
        const available = availableQuantity(variant.inventoryLevels);
        const price = toRial(variant.price);
        const compareAtPrice = toRial(variant.compareAtPrice);
        return {
          id: variant.id,
          sku: variant.sku,
          title: variant.title,
          options: parseVariantOptions(variant.options),
          price,
          compareAtPrice,
          discountPercent: discountPercent(compareAtPrice, price),
          availability: availabilityOf(available, variant.lowStockThreshold),
          availableQuantity: available > 0 && available < showStockCountBelow ? available : null,
        };
      }),
      related: product.relations
        .filter((relation) => relation.type === 'related')
        .map((relation) => toProductCard(relation.relatedProduct, taxonomy)),
      accessories: product.relations
        .filter((relation) => relation.type === 'accessory')
        .map((relation) => toProductCard(relation.relatedProduct, taxonomy)),
      rating: { average: ratingAverage, count: product.ratingCount },
      seo: {
        title: product.seoTitle ?? product.title,
        description: product.seoDescription ?? product.shortDescription,
        canonicalUrl: product.canonicalUrl,
      },
      updatedAt: product.updatedAt.toISOString(),
    };
  }
}
