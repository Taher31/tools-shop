import { Injectable } from '@nestjs/common';
import type {
  AdminCategoryView,
  AttributeView,
  CategoryAttributesInput,
  CategoryPage,
  CategoryTreeNode,
  CategoryUpsertInput,
} from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { CacheService } from '../../infrastructure/redis/cache.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { VISIBLE_PRODUCT_WHERE } from './product-card';
import { uniqueSlug } from './slug';
import type { TaxonomyAttribute, TaxonomyCategory } from './taxonomy';
import { TaxonomyService } from './taxonomy.service';

const COUNTS_KEY = 'catalog:category-counts';

export function toAttributeView(attribute: TaxonomyAttribute): AttributeView {
  return {
    id: attribute.id,
    code: attribute.code,
    name: attribute.name,
    type: attribute.type,
    unit: attribute.unit,
    groupName: attribute.groupName,
    description: attribute.description,
    isFilterable: attribute.isFilterable,
    isSearchable: attribute.isSearchable,
    isComparable: attribute.isComparable,
    sortOrder: attribute.sortOrder,
    options: attribute.options,
  };
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomyService: TaxonomyService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /** Public tree (active categories only) with product counts per subtree. */
  async publicTree(): Promise<CategoryTreeNode[]> {
    const taxonomy = await this.taxonomyService.get();
    const counts = await this.productCounts();
    const build = (parentId: string | null): CategoryTreeNode[] =>
      taxonomy.children(parentId, true).map((category) => {
        const children = build(category.id);
        return {
          ...this.summary(category),
          parentId: category.parentId,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          productCount:
            (counts[category.id] ?? 0) +
            children.reduce((sum, child) => sum + child.productCount, 0),
          children,
        };
      });
    return build(null);
  }

  async publicPage(slug: string): Promise<CategoryPage> {
    const taxonomy = await this.taxonomyService.get();
    const category = taxonomy.categoriesBySlug.get(slug);
    if (!category || !taxonomy.isCategoryVisible(category.id))
      throw AppException.notFound('دسته‌بندی یافت نشد.');
    return {
      category: {
        ...this.summary(category),
        description: category.description,
        seoTitle: category.seoTitle,
        seoDescription: category.seoDescription,
      },
      breadcrumbs: taxonomy.ancestors(category.id).map((c) => ({ name: c.name, slug: c.slug })),
      children: taxonomy.children(category.id, true).map((c) => this.summary(c)),
    };
  }

  /** Full admin tree including inactive categories and direct attribute assignments. */
  async adminTree(): Promise<AdminCategoryView[]> {
    const taxonomy = await this.taxonomyService.get();
    const counts = await this.productCounts(true);
    const build = (parentId: string | null): AdminCategoryView[] =>
      taxonomy.children(parentId).map((category) => ({
        ...this.summary(category),
        parentId: category.parentId,
        description: category.description,
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        seoTitle: category.seoTitle,
        seoDescription: category.seoDescription,
        productCount: counts[category.id] ?? 0,
        attributes: taxonomy.snapshot.categoryAttributes
          .filter((assignment) => assignment.categoryId === category.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .flatMap((assignment) => {
            const attribute = taxonomy.attributesById.get(assignment.attributeId);
            return attribute
              ? [
                  {
                    attribute: toAttributeView(attribute),
                    isRequired: assignment.isRequired,
                    isFilterable: assignment.isFilterable,
                    sortOrder: assignment.sortOrder,
                  },
                ]
              : [];
          }),
        children: build(category.id),
      }));
    return build(null);
  }

  /** Attributes a product of this category can have (own + inherited). */
  async effectiveAttributes(categoryId: string) {
    const taxonomy = await this.taxonomyService.get();
    if (!taxonomy.categoriesById.has(categoryId))
      throw AppException.notFound('دسته‌بندی یافت نشد.');
    return taxonomy.effectiveAttributes(categoryId).map((entry) => ({
      attribute: toAttributeView(entry.attribute),
      isRequired: entry.isRequired,
      isFilterable: entry.isFilterable,
      inheritedFrom: entry.inheritedFrom,
    }));
  }

  async create(input: CategoryUpsertInput): Promise<AdminCategoryView> {
    const taxonomy = await this.taxonomyService.get();
    if (input.parentId && !taxonomy.categoriesById.has(input.parentId)) {
      throw AppException.validation([{ path: 'parentId', message: 'دسته والد یافت نشد.' }]);
    }
    const slug = input.slug ?? (await uniqueSlug(input.name, (s) => this.slugTaken(s)));
    if (input.slug && (await this.slugTaken(input.slug))) throw this.slugConflict();

    const created = await this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({ data: { ...input, slug } });
      await this.audit.record(
        {
          action: 'category.create',
          entityType: 'category',
          entityId: category.id,
          summary: `ایجاد دسته‌بندی ${category.name}`,
        },
        tx,
      );
      return category;
    });
    await this.taxonomyService.invalidate();
    return this.adminNode(created.id);
  }

  async update(id: string, input: CategoryUpsertInput): Promise<AdminCategoryView> {
    const taxonomy = await this.taxonomyService.get();
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw AppException.notFound('دسته‌بندی یافت نشد.');
    if (input.parentId) {
      if (!taxonomy.categoriesById.has(input.parentId)) {
        throw AppException.validation([{ path: 'parentId', message: 'دسته والد یافت نشد.' }]);
      }
      if (taxonomy.descendantIds(id).includes(input.parentId)) {
        throw AppException.validation([
          { path: 'parentId', message: 'دسته نمی‌تواند زیرمجموعه خودش باشد.' },
        ]);
      }
    }
    const slug = input.slug ?? existing.slug;
    if (slug !== existing.slug && (await this.slugTaken(slug))) throw this.slugConflict();

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({ where: { id }, data: { ...input, slug } });
      await this.audit.record(
        {
          action: 'category.update',
          entityType: 'category',
          entityId: id,
          summary: `ویرایش دسته‌بندی ${updated.name}`,
          before: {
            name: existing.name,
            slug: existing.slug,
            parentId: existing.parentId,
            isActive: existing.isActive,
          },
          after: {
            name: updated.name,
            slug: updated.slug,
            parentId: updated.parentId,
            isActive: updated.isActive,
          },
        },
        tx,
      );
      await this.outbox.record(tx, [
        {
          type: 'catalog.taxonomy_changed',
          aggregateType: 'category',
          aggregateId: id,
          payload: { categoryIds: taxonomy.descendantIds(id) },
        },
      ]);
    });
    await this.taxonomyService.invalidate();
    this.outbox.flush();
    return this.adminNode(id);
  }

  async remove(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true, products: true } } },
    });
    if (!category) throw AppException.notFound('دسته‌بندی یافت نشد.');
    if (category._count.children > 0)
      throw AppException.conflict('ابتدا زیرمجموعه‌های این دسته را حذف یا منتقل کنید.');
    if (category._count.products > 0)
      throw AppException.conflict('محصولاتی در این دسته وجود دارد.');
    await this.prisma.$transaction(async (tx) => {
      await tx.category.delete({ where: { id } });
      await this.audit.record(
        {
          action: 'category.delete',
          entityType: 'category',
          entityId: id,
          summary: `حذف دسته‌بندی ${category.name}`,
        },
        tx,
      );
    });
    await this.taxonomyService.invalidate();
  }

  async setAttributes(id: string, input: CategoryAttributesInput): Promise<AdminCategoryView> {
    const taxonomy = await this.taxonomyService.get();
    if (!taxonomy.categoriesById.has(id)) throw AppException.notFound('دسته‌بندی یافت نشد.');
    const unknown = input.attributes.filter((a) => !taxonomy.attributesById.has(a.attributeId));
    if (unknown.length > 0)
      throw AppException.validation([{ path: 'attributes', message: 'ویژگی نامعتبر است.' }]);

    await this.prisma.$transaction(async (tx) => {
      await tx.categoryAttribute.deleteMany({ where: { categoryId: id } });
      await tx.categoryAttribute.createMany({
        data: input.attributes.map((a) => ({ ...a, categoryId: id })),
        skipDuplicates: true,
      });
      await this.audit.record(
        {
          action: 'category.attributes',
          entityType: 'category',
          entityId: id,
          summary: 'تغییر ویژگی‌های دسته‌بندی',
          after: {
            attributes: input.attributes.map(
              (a) => taxonomy.attributesById.get(a.attributeId)?.code,
            ),
          },
        },
        tx,
      );
      await this.outbox.record(tx, [
        {
          type: 'catalog.taxonomy_changed',
          aggregateType: 'category',
          aggregateId: id,
          payload: { categoryIds: taxonomy.descendantIds(id) },
        },
      ]);
    });
    await this.taxonomyService.invalidate();
    this.outbox.flush();
    return this.adminNode(id);
  }

  private async adminNode(id: string): Promise<AdminCategoryView> {
    const find = (nodes: AdminCategoryView[]): AdminCategoryView | undefined => {
      for (const node of nodes) {
        if (node.id === id) return node;
        const child = find(node.children as AdminCategoryView[]);
        if (child) return child;
      }
      return undefined;
    };
    const node = find(await this.adminTree());
    if (!node) throw AppException.notFound();
    return node;
  }

  private summary(category: TaxonomyCategory) {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      imageUrl: category.imageUrl,
    };
  }

  private async productCounts(includeHidden = false): Promise<Record<string, number>> {
    const loader = async () => {
      const rows = await this.prisma.product.groupBy({
        by: ['categoryId'],
        where: includeHidden ? { deletedAt: null } : VISIBLE_PRODUCT_WHERE,
        _count: { _all: true },
      });
      return Object.fromEntries(rows.map((row) => [row.categoryId, row._count._all]));
    };
    return includeHidden ? loader() : this.cache.wrap(COUNTS_KEY, 300, loader);
  }

  private async slugTaken(slug: string): Promise<boolean> {
    return (await this.prisma.category.count({ where: { slug } })) > 0;
  }

  private slugConflict(): AppException {
    return AppException.conflict('این نامک قبلاً استفاده شده است.', [
      { path: 'slug', message: 'تکراری' },
    ]);
  }
}
