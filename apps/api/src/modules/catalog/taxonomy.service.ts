import { Injectable } from '@nestjs/common';
import type { AttributeType } from '@toolshop/shared';
import { CacheService } from '../../infrastructure/redis/cache.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Taxonomy, type TaxonomySnapshot } from './taxonomy';

const CACHE_KEY = 'catalog:taxonomy:v1';
const TTL_SECONDS = 600;

@Injectable()
export class TaxonomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async get(): Promise<Taxonomy> {
    const snapshot = await this.cache.wrap(CACHE_KEY, TTL_SECONDS, () => this.load());
    return new Taxonomy(snapshot);
  }

  async invalidate(): Promise<void> {
    await this.cache.del(CACHE_KEY);
  }

  private async load(): Promise<TaxonomySnapshot> {
    const [categories, attributes, categoryAttributes, brands] = await Promise.all([
      this.prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.attribute.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.categoryAttribute.findMany(),
      this.prisma.brand.findMany({ orderBy: { name: 'asc' } }),
    ]);
    return {
      categories: categories.map((c) => ({
        id: c.id,
        parentId: c.parentId,
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.imageUrl,
        isActive: c.isActive,
        sortOrder: c.sortOrder,
        seoTitle: c.seoTitle,
        seoDescription: c.seoDescription,
      })),
      attributes: attributes.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type as AttributeType,
        unit: a.unit,
        groupName: a.groupName,
        description: a.description,
        isFilterable: a.isFilterable,
        isSearchable: a.isSearchable,
        isComparable: a.isComparable,
        sortOrder: a.sortOrder,
        options: a.options.map((o) => ({
          id: o.id,
          value: o.value,
          label: o.label,
          sortOrder: o.sortOrder,
        })),
      })),
      categoryAttributes: categoryAttributes.map((ca) => ({
        categoryId: ca.categoryId,
        attributeId: ca.attributeId,
        isRequired: ca.isRequired,
        isFilterable: ca.isFilterable,
        sortOrder: ca.sortOrder,
      })),
      brands: brands.map((b) => ({
        id: b.id,
        name: b.name,
        englishName: b.englishName,
        slug: b.slug,
        logoUrl: b.logoUrl,
        isActive: b.isActive,
      })),
    };
  }
}
