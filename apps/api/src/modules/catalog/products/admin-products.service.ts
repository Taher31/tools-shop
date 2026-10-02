import { Injectable } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import {
  type AdminProductDetail,
  type AdminProductListItem,
  type AdminProductListQuery,
  type FieldError,
  hasPermission,
  type Paginated,
  type ProductUpsertInput,
  type VariantPriceUpdateInput,
} from '@toolshop/shared';
import { dayRange } from '../../../common/utils/filters';
import { AppException } from '../../../common/errors/app-exception';
import { sanitizeRichText } from '../../../common/utils/html';
import { toRial } from '../../../common/utils/money';
import { paginate, paginationArgs } from '../../../common/utils/pagination';
import { randomToken } from '../../../common/utils/crypto';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import { PrismaService, type Tx } from '../../../infrastructure/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { AuthContext } from '../../auth/auth-context';
import { stockTotals } from '../../inventory/stock';
import { resolveAttributeValues, toEditableValue } from '../attribute-values';
import { parseVariantOptions, toStoredValue } from '../product-card';
import { uniqueSlug } from '../slug';
import type { Taxonomy } from '../taxonomy';
import { TaxonomyService } from '../taxonomy.service';

const ADMIN_PRODUCT_INCLUDE = {
  images: { orderBy: { sortOrder: 'asc' } },
  variants: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    include: {
      inventoryLevels: { include: { warehouse: { select: { id: true, code: true, name: true } } } },
    },
  },
  attributeValues: true,
  relations: { orderBy: { sortOrder: 'asc' } },
  listings: true,
} satisfies Prisma.ProductInclude;

type AdminProductRecord = Prisma.ProductGetPayload<{ include: typeof ADMIN_PRODUCT_INCLUDE }>;

const LIST_INCLUDE = {
  images: { orderBy: { sortOrder: 'asc' }, take: 1 },
  variants: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: {
      sku: true,
      price: true,
      isActive: true,
      lowStockThreshold: true,
      inventoryLevels: { select: { onHand: true, reserved: true } },
    },
  },
} satisfies Prisma.ProductInclude;

/** Scalar fields tracked by the audit log on product updates. */
const AUDITED_FIELDS = [
  'title',
  'slug',
  'status',
  'categoryId',
  'brandId',
  'model',
  'warranty',
  'isFeatured',
  'seoTitle',
  'seoDescription',
] as const;

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomyService: TaxonomyService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async list(query: AdminProductListQuery): Promise<Paginated<AdminProductListItem>> {
    const taxonomy = await this.taxonomyService.get();
    const where: Prisma.ProductWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.brandId) where.brandId = query.brandId;
    if (query.categoryId) where.categoryId = { in: taxonomy.descendantIds(query.categoryId) };
    if (query.q) {
      const term = query.q.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { englishTitle: { contains: term, mode: 'insensitive' } },
        { model: { contains: term, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: term.toUpperCase() }, deletedAt: null } } },
        { variants: { some: { barcode: term, deletedAt: null } } },
      ];
    }
    if (query.lowStock) where.id = { in: await this.lowStockProductIds() };
    if (query.outOfStock !== undefined) {
      // Approximation: any stock on hand (reservations are not subtracted here).
      const available = {
        variants: { some: { deletedAt: null, inventoryLevels: { some: { onHand: { gt: 0 } } } } },
      };
      where.AND = [query.outOfStock ? { NOT: available } : available];
    }
    if (query.featured !== undefined) where.isFeatured = query.featured;
    where.createdAt = dayRange(query);
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === 'newest'
        ? [{ createdAt: 'desc' }]
        : query.sort === 'oldest'
          ? [{ createdAt: 'asc' }]
          : query.sort === 'title'
            ? [{ title: 'asc' }]
            : query.sort === 'best_selling'
              ? [{ soldCount: 'desc' }, { updatedAt: 'desc' }]
              : [{ updatedAt: 'desc' }];

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy,
        ...paginationArgs(query),
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(
      products.map((product) => {
        const prices = product.variants.map((v) => toRial(v.price));
        const levels = product.variants.flatMap((v) => v.inventoryLevels);
        const isLowStock = product.variants.some(
          (v) => v.isActive && stockTotals(v.inventoryLevels).available <= v.lowStockThreshold,
        );
        return {
          id: product.id,
          title: product.title,
          slug: product.slug,
          status: product.status,
          imageUrl: product.images[0]?.url ?? null,
          brandName: product.brandId
            ? (taxonomy.brandsById.get(product.brandId)?.name ?? null)
            : null,
          categoryName: taxonomy.categoriesById.get(product.categoryId)?.name ?? '—',
          skus: product.variants.map((v) => v.sku),
          minPrice: prices.length ? Math.min(...prices) : 0,
          maxPrice: prices.length ? Math.max(...prices) : 0,
          stock: stockTotals(levels),
          isLowStock,
          updatedAt: product.updatedAt.toISOString(),
        };
      }),
      total,
      query,
    );
  }

  async get(id: string): Promise<AdminProductDetail> {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: ADMIN_PRODUCT_INCLUDE,
    });
    if (!product) throw AppException.notFound('محصول یافت نشد.');
    return this.toDetail(product, await this.taxonomyService.get());
  }

  async create(input: ProductUpsertInput): Promise<AdminProductDetail> {
    const taxonomy = await this.taxonomyService.get();
    const prepared = await this.prepare(input, taxonomy, null);

    const productId = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...prepared.scalars,
          publishedAt: input.status === 'active' ? new Date() : null,
          images: { create: prepared.images },
          attributeValues: { create: prepared.attributeValues },
        },
      });
      await this.writeVariants(tx, product.id, input, []);
      await this.writeRelations(tx, product.id, input);
      await this.audit.record(
        {
          action: 'product.create',
          entityType: 'product',
          entityId: product.id,
          summary: `ایجاد محصول ${product.title}`,
          after: {
            title: product.title,
            status: product.status,
            variants: input.variants.map((v) => ({ sku: v.sku, price: v.price })),
          },
        },
        tx,
      );
      await this.recordChanged(tx, product.id);
      return product.id;
    });
    this.outbox.flush();
    return this.get(productId);
  }

  async update(
    id: string,
    input: ProductUpsertInput,
    actor: AuthContext,
  ): Promise<AdminProductDetail> {
    const existing = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: ADMIN_PRODUCT_INCLUDE,
    });
    if (!existing) throw AppException.notFound('محصول یافت نشد.');
    const taxonomy = await this.taxonomyService.get();
    const prepared = await this.prepare(input, taxonomy, existing);

    const priceChanges = this.priceChanges(existing, input);
    if (priceChanges.length > 0 && !hasPermission(actor.permissions, 'product.price.update')) {
      throw AppException.forbidden('شما مجوز تغییر قیمت محصولات را ندارید.');
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...prepared.scalars,
          publishedAt: existing.publishedAt ?? (input.status === 'active' ? new Date() : null),
          images: { deleteMany: {}, create: prepared.images },
          attributeValues: { deleteMany: {}, create: prepared.attributeValues },
        },
      });
      await this.writeVariants(tx, id, input, existing.variants);
      await this.writeRelations(tx, id, input);

      const before = Object.fromEntries(AUDITED_FIELDS.map((key) => [key, existing[key]]));
      const after = Object.fromEntries(AUDITED_FIELDS.map((key) => [key, updated[key]]));
      await this.audit.record(
        {
          action: 'product.update',
          entityType: 'product',
          entityId: id,
          summary: `ویرایش محصول ${updated.title}`,
          before,
          after,
        },
        tx,
      );
      if (priceChanges.length > 0) {
        await this.audit.record(
          {
            action: 'product.price.update',
            entityType: 'product',
            entityId: id,
            summary: `تغییر قیمت ${priceChanges.map((c) => c.sku).join('، ')}`,
            before: Object.fromEntries(priceChanges.map((c) => [c.sku, c.before])),
            after: Object.fromEntries(priceChanges.map((c) => [c.sku, c.after])),
          },
          tx,
        );
      }
      await this.recordChanged(tx, id);
    });
    this.outbox.flush();
    return this.get(id);
  }

  async updateVariantPrice(
    variantId: string,
    input: VariantPriceUpdateInput,
  ): Promise<AdminProductDetail> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, deletedAt: null },
    });
    if (!variant) throw AppException.notFound('تنوع محصول یافت نشد.');
    await this.prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          price: BigInt(input.price),
          compareAtPrice: input.compareAtPrice ? BigInt(input.compareAtPrice) : null,
        },
      });
      await this.refreshPriceRange(tx, variant.productId);
      await this.audit.record(
        {
          action: 'product.price.update',
          entityType: 'product',
          entityId: variant.productId,
          summary: `تغییر قیمت ${variant.sku}`,
          before: {
            [variant.sku]: { price: variant.price, compareAtPrice: variant.compareAtPrice },
          },
          after: { [variant.sku]: { price: input.price, compareAtPrice: input.compareAtPrice } },
        },
        tx,
      );
      await this.recordChanged(tx, variant.productId);
    });
    this.outbox.flush();
    return this.get(variant.productId);
  }

  /** Soft delete: the product disappears from the store but order history stays intact. */
  async remove(id: string): Promise<void> {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!product) throw AppException.notFound('محصول یافت نشد.');
    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'archived' },
      });
      await tx.cartItem.deleteMany({ where: { variant: { productId: id } } });
      await this.audit.record(
        {
          action: 'product.delete',
          entityType: 'product',
          entityId: id,
          summary: `حذف محصول ${product.title}`,
        },
        tx,
      );
      await this.outbox.record(tx, [
        {
          type: 'product.deleted',
          aggregateType: 'product',
          aggregateId: id,
          payload: { productIds: [id] },
        },
      ]);
    });
    this.outbox.flush();
  }

  private async prepare(
    input: ProductUpsertInput,
    taxonomy: Taxonomy,
    existing: AdminProductRecord | null,
  ) {
    const errors: FieldError[] = [];
    if (!taxonomy.categoriesById.has(input.categoryId)) {
      errors.push({ path: 'categoryId', message: 'دسته‌بندی یافت نشد.' });
    }
    if (input.brandId && !taxonomy.brandsById.has(input.brandId)) {
      errors.push({ path: 'brandId', message: 'برند یافت نشد.' });
    }
    const attributes = taxonomy.categoriesById.has(input.categoryId)
      ? resolveAttributeValues(input.attributes, taxonomy.effectiveAttributes(input.categoryId), {
          enforceRequired: input.status === 'active',
        })
      : { values: [], errors: [] };
    errors.push(...attributes.errors);

    const ownVariantIds = new Set(existing?.variants.map((v) => v.id) ?? []);
    input.variants.forEach((variant, index) => {
      if (variant.id && !ownVariantIds.has(variant.id)) {
        errors.push({ path: `variants.${index}.id`, message: 'تنوع متعلق به این محصول نیست.' });
      }
    });
    errors.push(...(await this.identifierConflicts(input, existing?.id ?? null)));

    const relatedIds = [...new Set([...input.relatedProductIds, ...input.accessoryProductIds])];
    if (existing && relatedIds.includes(existing.id)) {
      errors.push({ path: 'relatedProductIds', message: 'محصول نمی‌تواند به خودش مرتبط باشد.' });
    }
    if (relatedIds.length > 0) {
      const found = await this.prisma.product.count({
        where: { id: { in: relatedIds }, deletedAt: null },
      });
      if (found !== relatedIds.length)
        errors.push({ path: 'relatedProductIds', message: 'محصول مرتبط یافت نشد.' });
    }

    let slug = input.slug ?? existing?.slug;
    if (input.slug && input.slug !== existing?.slug) {
      const taken = await this.prisma.product.count({
        where: { slug: input.slug, id: { not: existing?.id } },
      });
      if (taken > 0) errors.push({ path: 'slug', message: 'این نامک قبلاً استفاده شده است.' });
    }
    if (errors.length > 0) throw AppException.validation(errors);
    slug ??= await uniqueSlug(
      input.englishTitle ?? input.title,
      async (s) => (await this.prisma.product.count({ where: { slug: s } })) > 0,
    );

    const activePrices = input.variants.filter((v) => v.isActive).map((v) => v.price);
    const prices = activePrices.length > 0 ? activePrices : input.variants.map((v) => v.price);

    return {
      scalars: {
        title: input.title,
        englishTitle: input.englishTitle,
        slug,
        status: input.status,
        categoryId: input.categoryId,
        brandId: input.brandId,
        model: input.model,
        manufacturer: input.manufacturer,
        countryOfOrigin: input.countryOfOrigin,
        usageType: input.usageType,
        warranty: input.warranty,
        shortDescription: input.shortDescription,
        description: sanitizeRichText(input.description),
        videoUrl: input.videoUrl ?? null,
        tags: [...new Set(input.tags)],
        isFeatured: input.isFeatured,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        canonicalUrl: input.canonicalUrl ?? null,
        minPrice: BigInt(Math.min(...prices)),
        maxPrice: BigInt(Math.max(...prices)),
      },
      images: input.images.map((image, index) => ({
        url: image.url,
        alt: image.alt ?? input.title,
        sortOrder: index,
      })),
      attributeValues: attributes.values,
    };
  }

  private async identifierConflicts(
    input: ProductUpsertInput,
    productId: string | null,
  ): Promise<FieldError[]> {
    const skus = input.variants.map((v) => v.sku);
    const barcodes = input.variants.map((v) => v.barcode).filter((b): b is string => Boolean(b));
    const clashes = await this.prisma.productVariant.findMany({
      where: {
        OR: [{ sku: { in: skus } }, ...(barcodes.length ? [{ barcode: { in: barcodes } }] : [])],
        ...(productId ? { productId: { not: productId } } : {}),
      },
      select: { sku: true, barcode: true },
    });
    const errors: FieldError[] = [];
    input.variants.forEach((variant, index) => {
      if (clashes.some((c) => c.sku === variant.sku)) {
        errors.push({
          path: `variants.${index}.sku`,
          message: `SKU ${variant.sku} برای محصول دیگری ثبت شده است.`,
        });
      }
      if (variant.barcode && clashes.some((c) => c.barcode === variant.barcode)) {
        errors.push({
          path: `variants.${index}.barcode`,
          message: 'این بارکد برای محصول دیگری ثبت شده است.',
        });
      }
    });
    return errors;
  }

  private priceChanges(existing: AdminProductRecord, input: ProductUpsertInput) {
    return input.variants.flatMap((variant) => {
      const current = variant.id ? existing.variants.find((v) => v.id === variant.id) : undefined;
      const before = current
        ? { price: toRial(current.price), compareAtPrice: toRial(current.compareAtPrice) }
        : null;
      const after = { price: variant.price, compareAtPrice: variant.compareAtPrice };
      if (before && before.price === after.price && before.compareAtPrice === after.compareAtPrice)
        return [];
      return [{ sku: variant.sku, before, after }];
    });
  }

  private async writeVariants(
    tx: Tx,
    productId: string,
    input: ProductUpsertInput,
    existing: AdminProductRecord['variants'],
  ): Promise<void> {
    const keptIds = new Set(input.variants.map((v) => v.id).filter(Boolean));
    for (const variant of existing.filter((v) => !keptIds.has(v.id))) {
      // Removed variants are soft-deleted (history keeps pointing at them) and release their SKU.
      await tx.productVariant.update({
        where: { id: variant.id },
        data: {
          deletedAt: new Date(),
          isActive: false,
          sku: `${variant.sku}~DEL~${randomToken(4)}`,
          barcode: null,
        },
      });
      await tx.cartItem.deleteMany({ where: { variantId: variant.id } });
    }
    for (const [index, variant] of input.variants.entries()) {
      const data = {
        sku: variant.sku,
        barcode: variant.barcode ?? null,
        title: variant.title,
        options: variant.options,
        price: BigInt(variant.price),
        compareAtPrice: variant.compareAtPrice ? BigInt(variant.compareAtPrice) : null,
        lowStockThreshold: variant.lowStockThreshold,
        weightGrams: variant.weightGrams ?? null,
        isActive: variant.isActive,
        sortOrder: index,
      };
      if (variant.id) {
        await tx.productVariant.update({ where: { id: variant.id }, data });
      } else {
        await tx.productVariant.create({ data: { ...data, productId } });
      }
    }
  }

  private async writeRelations(
    tx: Tx,
    productId: string,
    input: ProductUpsertInput,
  ): Promise<void> {
    await tx.productRelation.deleteMany({ where: { productId } });
    const data = [
      ...input.relatedProductIds.map((relatedProductId, sortOrder) => ({
        productId,
        relatedProductId,
        type: 'related' as const,
        sortOrder,
      })),
      ...input.accessoryProductIds.map((relatedProductId, sortOrder) => ({
        productId,
        relatedProductId,
        type: 'accessory' as const,
        sortOrder,
      })),
    ];
    if (data.length > 0) await tx.productRelation.createMany({ data, skipDuplicates: true });
  }

  private async refreshPriceRange(tx: Tx, productId: string): Promise<void> {
    const variants = await tx.productVariant.findMany({
      where: { productId, deletedAt: null },
      select: { price: true, isActive: true },
    });
    const active = variants.filter((v) => v.isActive);
    const prices = (active.length > 0 ? active : variants).map((v) => v.price);
    if (prices.length === 0) return;
    await tx.product.update({
      where: { id: productId },
      data: {
        minPrice: prices.reduce((min, p) => (p < min ? p : min)),
        maxPrice: prices.reduce((max, p) => (p > max ? p : max)),
      },
    });
  }

  private async recordChanged(tx: Tx, productId: string): Promise<void> {
    await this.outbox.record(tx, [
      {
        type: 'product.changed',
        aggregateType: 'product',
        aggregateId: productId,
        payload: { productIds: [productId] },
      },
    ]);
  }

  private async lowStockProductIds(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ productId: string }[]>`
      SELECT DISTINCT v."productId"
      FROM "ProductVariant" v
      LEFT JOIN "InventoryLevel" l ON l."variantId" = v."id"
      LEFT JOIN "Warehouse" w ON w."id" = l."warehouseId" AND w."isActive"
      WHERE v."deletedAt" IS NULL AND v."isActive"
      GROUP BY v."id", v."productId", v."lowStockThreshold"
      HAVING COALESCE(SUM(CASE WHEN w."id" IS NULL THEN 0 ELSE GREATEST(l."onHand" - l."reserved", 0) END), 0) <= v."lowStockThreshold"`;
    return rows.map((row) => row.productId);
  }

  private toDetail(product: AdminProductRecord, taxonomy: Taxonomy): AdminProductDetail {
    return {
      id: product.id,
      title: product.title,
      englishTitle: product.englishTitle,
      slug: product.slug,
      status: product.status,
      categoryId: product.categoryId,
      brandId: product.brandId,
      model: product.model,
      manufacturer: product.manufacturer,
      countryOfOrigin: product.countryOfOrigin,
      usageType: product.usageType,
      warranty: product.warranty,
      shortDescription: product.shortDescription,
      description: product.description,
      videoUrl: product.videoUrl,
      tags: product.tags,
      images: product.images.map((image) => ({ url: image.url, alt: image.alt })),
      attributes: product.attributeValues.flatMap((value) => {
        const attribute = taxonomy.attributesById.get(value.attributeId);
        return attribute
          ? [
              {
                attributeId: value.attributeId,
                value: toEditableValue(attribute, toStoredValue(value)),
              },
            ]
          : [];
      }),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        barcode: variant.barcode,
        title: variant.title,
        options: parseVariantOptions(variant.options),
        price: toRial(variant.price),
        compareAtPrice: toRial(variant.compareAtPrice),
        lowStockThreshold: variant.lowStockThreshold,
        weightGrams: variant.weightGrams,
        isActive: variant.isActive,
        stock: stockTotals(variant.inventoryLevels),
        levels: variant.inventoryLevels.map((level) => ({
          warehouseId: level.warehouse.id,
          warehouseCode: level.warehouse.code,
          warehouseName: level.warehouse.name,
          onHand: level.onHand,
          reserved: level.reserved,
          available: Math.max(0, level.onHand - level.reserved),
        })),
      })),
      relatedProductIds: product.relations
        .filter((r) => r.type === 'related')
        .map((r) => r.relatedProductId),
      accessoryProductIds: product.relations
        .filter((r) => r.type === 'accessory')
        .map((r) => r.relatedProductId),
      isFeatured: product.isFeatured,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      canonicalUrl: product.canonicalUrl,
      marketplaceSync: product.listings.map((listing) => ({
        channel: listing.channel,
        status: listing.status,
        lastSyncedAt: listing.lastSyncedAt?.toISOString() ?? null,
        lastError: listing.lastError,
      })),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }
}
