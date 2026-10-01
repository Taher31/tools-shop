import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import {
  type AttributeFacet,
  type FacetValue,
  normalizeForSearch,
  type ProductCard,
  type ProductSearchQuery,
  type ProductSearchResult,
  type SearchSuggestion,
  toEnglishDigits,
  toPersianDigits,
} from '@toolshop/shared';
import type { FacetDistribution, Meilisearch, MultiSearchQuery, SearchResponse } from 'meilisearch';
import { ProductQueryService } from '../catalog/products/product-query.service';
import type { Taxonomy, TaxonomyAttribute } from '../catalog/taxonomy';
import { TaxonomyService } from '../catalog/taxonomy.service';
import { MEILI_CLIENT } from './meili.client';
import type { ProductSearchDocument } from './product-document';
import { SearchIndexService } from './search-index.service';

const quote = (value: string): string => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const SORTS: Record<ProductSearchQuery['sort'], string[] | undefined> = {
  relevance: undefined,
  newest: ['publishedAt:desc'],
  price_asc: ['price:asc'],
  price_desc: ['price:desc'],
  bestselling: ['soldCount:desc'],
};

interface FilterGroups {
  base: string[];
  brand: string | null;
  attributes: Map<string, string>;
}

/**
 * Read side of search. Queries Meilisearch with Persian-normalized text and
 * disjunctive facets; if the engine is unreachable it degrades to a database search
 * so the storefront keeps working.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(MEILI_CLIENT) private readonly meili: Meilisearch,
    private readonly indexService: SearchIndexService,
    private readonly taxonomyService: TaxonomyService,
    private readonly products: ProductQueryService,
  ) {}

  async search(query: ProductSearchQuery): Promise<ProductSearchResult> {
    const taxonomy = await this.taxonomyService.get();
    const category = query.category ? taxonomy.categoriesBySlug.get(query.category) : undefined;
    if (query.category && (!category || !taxonomy.isCategoryVisible(category.id))) {
      return this.empty(query, 'meilisearch');
    }
    try {
      return await this.searchEngine(query, taxonomy, category?.id);
    } catch (error) {
      this.logger.warn({ err: error }, 'Search engine query failed; using database fallback');
      return this.searchDatabase(query, taxonomy, category?.id);
    }
  }

  async suggest(rawQuery: string): Promise<SearchSuggestion> {
    const q = normalizeForSearch(rawQuery);
    if (q.length < 2) return { products: [], categories: [] };
    const taxonomy = await this.taxonomyService.get();
    const categories = taxonomy.snapshot.categories
      .filter((c) => taxonomy.isCategoryVisible(c.id) && normalizeForSearch(c.name).includes(q))
      .slice(0, 4)
      .map((c) => ({ name: c.name, slug: c.slug }));
    try {
      const response = await this.meili.index<ProductSearchDocument>(this.indexService.indexUid).search(q, {
        limit: 6,
        attributesToRetrieve: ['id', 'slug', 'title', 'imageUrl', 'price', 'inStock'],
      });
      return {
        products: response.hits.map((hit) => ({
          id: hit.id,
          slug: hit.slug,
          title: hit.title,
          imageUrl: hit.imageUrl,
          price: hit.price,
          inStock: hit.inStock,
        })),
        categories,
      };
    } catch {
      const fallback = await this.searchDatabase(
        { q: rawQuery, sort: 'relevance', page: 1, pageSize: 6, brand: [], attributes: {} },
        taxonomy,
        undefined,
      );
      return {
        products: fallback.items.map((item) => ({
          id: item.id,
          slug: item.slug,
          title: item.title,
          imageUrl: item.imageUrl,
          price: item.price,
          inStock: item.inStock,
        })),
        categories,
      };
    }
  }

  private async searchEngine(
    query: ProductSearchQuery,
    taxonomy: Taxonomy,
    categoryId: string | undefined,
  ): Promise<ProductSearchResult> {
    const q = query.q ? normalizeForSearch(query.q) : '';
    const groups = this.filters(query, taxonomy, categoryId);
    const indexUid = this.indexService.indexUid;
    const combine = (exclude?: { brand?: boolean; attribute?: string }): string[] => [
      ...groups.base,
      ...(groups.brand && !exclude?.brand ? [groups.brand] : []),
      ...[...groups.attributes.entries()].filter(([code]) => code !== exclude?.attribute).map(([, filter]) => filter),
    ];

    const queries: MultiSearchQuery[] = [
      {
        indexUid,
        q,
        filter: combine(),
        sort: SORTS[query.sort],
        page: query.page,
        hitsPerPage: query.pageSize,
        facets: ['brandSlug', 'categoryIds', 'facets', 'price'],
      },
    ];
    // Disjunctive faceting: each selected group is counted without its own filter so
    // the other options of that group stay visible.
    if (groups.brand) queries.push({ indexUid, q, filter: combine({ brand: true }), hitsPerPage: 0, facets: ['brandSlug'] });
    const attributeCodes = [...groups.attributes.keys()];
    for (const code of attributeCodes) {
      queries.push({ indexUid, q, filter: combine({ attribute: code }), hitsPerPage: 0, facets: ['facets'] });
    }

    const { results } = await this.meili.multiSearch<{ queries: MultiSearchQuery[] }, ProductSearchDocument>({ queries });
    const [main, ...extra] = results as unknown as (SearchResponse<ProductSearchDocument> & {
      totalHits?: number;
      totalPages?: number;
    })[];
    if (!main) throw new Error('Empty multi-search response');

    const distribution: FacetDistribution = { ...(main.facetDistribution ?? {}) };
    let cursor = 0;
    if (groups.brand) distribution['brandSlug'] = extra[cursor++]?.facetDistribution?.['brandSlug'] ?? {};
    const attributeDistributions = new Map<string, Record<string, number>>();
    for (const code of attributeCodes) {
      attributeDistributions.set(code, extra[cursor++]?.facetDistribution?.['facets'] ?? {});
    }

    const total = main.totalHits ?? 0;
    const priceStats = main.facetStats?.['price'];
    return {
      items: main.hits.map((hit) => this.toCard(hit)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, main.totalPages ?? Math.ceil(total / query.pageSize)),
      query: query.q ?? null,
      engine: 'meilisearch',
      facets: {
        brands: this.brandFacet(distribution['brandSlug'] ?? {}, taxonomy),
        categories: this.categoryFacet(distribution['categoryIds'] ?? {}, taxonomy, categoryId),
        attributes: this.attributeFacets(distribution['facets'] ?? {}, attributeDistributions, taxonomy, categoryId),
        price: priceStats ? { min: priceStats.min, max: priceStats.max } : null,
      },
    };
  }

  private filters(query: ProductSearchQuery, taxonomy: Taxonomy, categoryId: string | undefined): FilterGroups {
    const base: string[] = [];
    if (categoryId) base.push(`categoryIds = ${quote(categoryId)}`);
    if (query.minPrice !== undefined) base.push(`price >= ${query.minPrice}`);
    if (query.maxPrice !== undefined) base.push(`price <= ${query.maxPrice}`);
    if (query.inStock) base.push('inStock = true');
    if (query.onSale) base.push('onSale = true');

    const brands = query.brand.filter((slug) => taxonomy.brandsBySlug.has(slug));
    const attributes = new Map<string, string>();
    for (const [code, values] of Object.entries(query.attributes)) {
      if (!taxonomy.attributesByCode.has(code) || values.length === 0) continue;
      attributes.set(code, `facets IN [${values.map((value) => quote(`${code}:${value}`)).join(', ')}]`);
    }
    return {
      base,
      brand: brands.length > 0 ? `brandSlug IN [${brands.map(quote).join(', ')}]` : null,
      attributes,
    };
  }

  private toCard(hit: ProductSearchDocument): ProductCard {
    return {
      id: hit.id,
      slug: hit.slug,
      title: hit.title,
      brand: hit.brandName && hit.brandSlug ? { name: hit.brandName, slug: hit.brandSlug } : null,
      category: { name: hit.categoryName, slug: hit.categorySlug },
      imageUrl: hit.imageUrl,
      price: hit.price,
      compareAtPrice: hit.compareAtPrice,
      discountPercent: hit.discountPercent,
      inStock: hit.inStock,
      variantCount: hit.variantCount,
      defaultVariantId: hit.defaultVariantId,
      ratingAverage: hit.ratingAverage,
      ratingCount: hit.ratingCount,
      keySpecs: hit.keySpecs,
    };
  }

  private brandFacet(counts: Record<string, number>, taxonomy: Taxonomy): FacetValue[] {
    return Object.entries(counts)
      .flatMap(([slug, count]) => {
        const brand = taxonomy.brandsBySlug.get(slug);
        return brand ? [{ value: slug, label: brand.name, count }] : [];
      })
      .sort((a, b) => b.count - a.count);
  }

  /** Counts for the direct children of the current category (or the root categories). */
  private categoryFacet(counts: Record<string, number>, taxonomy: Taxonomy, categoryId: string | undefined): FacetValue[] {
    return taxonomy
      .children(categoryId ?? null, true)
      .map((child) => ({ value: child.slug, label: child.name, count: counts[child.id] ?? 0 }))
      .filter((facet) => facet.count > 0);
  }

  private attributeFacets(
    counts: Record<string, number>,
    selectedGroups: Map<string, Record<string, number>>,
    taxonomy: Taxonomy,
    categoryId: string | undefined,
  ): AttributeFacet[] {
    const attributes: TaxonomyAttribute[] = categoryId
      ? taxonomy.effectiveAttributes(categoryId).filter((e) => e.isFilterable).map((e) => e.attribute)
      : taxonomy.snapshot.attributes.filter((a) => a.isFilterable);

    return attributes.flatMap((attribute) => {
      const source = selectedGroups.get(attribute.code) ?? counts;
      const prefix = `${attribute.code}:`;
      const values = Object.entries(source)
        .filter(([token]) => token.startsWith(prefix))
        .map(([token, count]) => {
          const raw = token.slice(prefix.length);
          return { value: raw, label: taxonomy.facetValueLabel(attribute, raw), count };
        });
      if (values.length < (selectedGroups.has(attribute.code) ? 1 : 2)) return [];
      if (attribute.type === 'number') values.sort((a, b) => Number(a.value) - Number(b.value));
      else {
        const order = new Map(attribute.options.map((o, index) => [o.value, index]));
        values.sort((a, b) => (order.get(a.value) ?? 999) - (order.get(b.value) ?? 999));
      }
      return [{ code: attribute.code, name: attribute.name, unit: attribute.unit, values }];
    });
  }

  /** Degraded mode: token-based database search without facets. */
  private async searchDatabase(
    query: ProductSearchQuery,
    taxonomy: Taxonomy,
    categoryId: string | undefined,
  ): Promise<ProductSearchResult> {
    const where: Prisma.ProductWhereInput = {};
    const and: Prisma.ProductWhereInput[] = [];
    if (categoryId) where.categoryId = { in: taxonomy.descendantIds(categoryId) };
    const brandIds = query.brand.flatMap((slug) => taxonomy.brandsBySlug.get(slug)?.id ?? []);
    if (brandIds.length > 0) where.brandId = { in: brandIds };
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.minPrice = {
        ...(query.minPrice !== undefined ? { gte: BigInt(query.minPrice) } : {}),
        ...(query.maxPrice !== undefined ? { lte: BigInt(query.maxPrice) } : {}),
      };
    }
    for (const token of normalizeForSearch(query.q ?? '').split(' ').filter((t) => t.length > 0).slice(0, 8)) {
      const variants = [...new Set([token, toPersianDigits(token), toEnglishDigits(token)])];
      and.push({
        OR: variants.flatMap((variant) => [
          { title: { contains: variant, mode: 'insensitive' as const } },
          { englishTitle: { contains: variant, mode: 'insensitive' as const } },
          { model: { contains: variant, mode: 'insensitive' as const } },
          { tags: { has: variant } },
          { variants: { some: { sku: { contains: variant.toUpperCase() }, deletedAt: null } } },
        ]),
      });
    }
    if (and.length > 0) where.AND = and;

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === 'price_asc'
        ? [{ minPrice: 'asc' }]
        : query.sort === 'price_desc'
          ? [{ minPrice: 'desc' }]
          : query.sort === 'newest'
            ? [{ publishedAt: 'desc' }]
            : [{ soldCount: 'desc' }, { publishedAt: 'desc' }];

    const all = await this.products.cards(where, orderBy, 500);
    const filtered = all.filter(
      (card) => (!query.inStock || card.inStock) && (!query.onSale || card.discountPercent > 0),
    );
    const start = (query.page - 1) * query.pageSize;
    return {
      items: filtered.slice(start, start + query.pageSize),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(filtered.length / query.pageSize)),
      query: query.q ?? null,
      engine: 'database',
      facets: { brands: [], categories: [], attributes: [], price: null },
    };
  }

  private empty(query: ProductSearchQuery, engine: ProductSearchResult['engine']): ProductSearchResult {
    return {
      items: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: 1,
      query: query.q ?? null,
      engine,
      facets: { brands: [], categories: [], attributes: [], price: null },
    };
  }
}
