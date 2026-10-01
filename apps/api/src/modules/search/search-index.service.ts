import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { Meilisearch } from 'meilisearch';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QUEUES } from '../../infrastructure/queue/queue.constants';
import { TaxonomyService } from '../catalog/taxonomy.service';
import { MEILI_CLIENT } from './meili.client';
import { buildProductDocument, DOCUMENT_INCLUDE, type ProductSearchDocument } from './product-document';
import { PRODUCT_INDEX, PRODUCT_INDEX_SETTINGS } from './search.constants';

export const SEARCH_JOBS = {
  INDEX_PRODUCTS: 'index-products',
  REINDEX_ALL: 'reindex-all',
} as const;

export interface IndexProductsJob {
  productIds: string[];
}

const BATCH_SIZE = 200;

/**
 * Write side of search: keeps the Meilisearch index in sync with the database.
 * The database is the source of truth; the index can always be rebuilt from it.
 */
@Injectable()
export class SearchIndexService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SearchIndexService.name);
  readonly indexUid: string;

  constructor(
    @Inject(MEILI_CLIENT) private readonly meili: Meilisearch,
    @InjectQueue(QUEUES.SEARCH_INDEXING) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
    config: AppConfig,
  ) {
    this.indexUid = `${config.search.indexPrefix}${PRODUCT_INDEX}`;
  }

  onApplicationBootstrap(): void {
    if (process.env['QUEUE_WORKERS_ENABLED'] === 'false') return;
    void this.bootstrapIndex();
  }

  /** Creates the index/settings if needed and schedules a full build when it is empty. */
  async bootstrapIndex(): Promise<void> {
    try {
      await this.ensureIndex(this.indexUid);
      const stats = await this.meili.index(this.indexUid).getStats();
      const products = await this.prisma.product.count({ where: { status: 'active', deletedAt: null } });
      if (stats.numberOfDocuments === 0 && products > 0) {
        this.logger.log('Search index is empty – scheduling a full reindex');
        await this.enqueueFullReindex();
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'Search engine unavailable at startup; storefront falls back to database search');
    }
  }

  async enqueueProducts(productIds: string[]): Promise<void> {
    const unique = [...new Set(productIds)];
    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      await this.queue.add(SEARCH_JOBS.INDEX_PRODUCTS, { productIds: unique.slice(i, i + BATCH_SIZE) } satisfies IndexProductsJob);
    }
  }

  async enqueueFullReindex(): Promise<void> {
    await this.queue.add(SEARCH_JOBS.REINDEX_ALL, {}, { jobId: `reindex-all-${Math.floor(Date.now() / 60_000)}` });
  }

  /** Upserts visible products and removes hidden/deleted ones. */
  async indexProducts(productIds: string[]): Promise<{ indexed: number; removed: number }> {
    const taxonomy = await this.taxonomy.get();
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } }, include: DOCUMENT_INCLUDE });
    const documents: ProductSearchDocument[] = [];
    const visible = new Set<string>();
    for (const product of products) {
      const document = buildProductDocument(product, taxonomy);
      if (document) {
        documents.push(document);
        visible.add(product.id);
      }
    }
    const removed = productIds.filter((id) => !visible.has(id));
    const index = this.meili.index<ProductSearchDocument>(this.indexUid);
    if (documents.length > 0) await index.addDocuments(documents, { primaryKey: 'id' }).waitTask({ timeout: 30_000 });
    if (removed.length > 0) await index.deleteDocuments(removed).waitTask({ timeout: 30_000 });
    return { indexed: documents.length, removed: removed.length };
  }

  /** Builds a fresh index next to the live one and swaps them atomically (no downtime). */
  async reindexAll(): Promise<number> {
    const taxonomy = await this.taxonomy.get();
    const tempUid = `${this.indexUid}_rebuild`;
    await this.meili.deleteIndex(tempUid).waitTask({ timeout: 30_000 }).catch(() => undefined);
    await this.ensureIndex(this.indexUid);
    await this.ensureIndex(tempUid);
    const temp = this.meili.index<ProductSearchDocument>(tempUid);

    let cursor: string | undefined;
    let total = 0;
    for (;;) {
      const batch = await this.prisma.product.findMany({
        where: { status: 'active', deletedAt: null },
        include: DOCUMENT_INCLUDE,
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (batch.length === 0) break;
      const documents = batch.flatMap((product) => buildProductDocument(product, taxonomy) ?? []);
      if (documents.length > 0) await temp.addDocuments(documents, { primaryKey: 'id' }).waitTask({ timeout: 120_000 });
      total += documents.length;
      cursor = batch[batch.length - 1]?.id;
    }

    await this.meili.swapIndexes([{ indexes: [this.indexUid, tempUid], rename: false }]).waitTask({ timeout: 60_000 });
    await this.meili.deleteIndex(tempUid).waitTask({ timeout: 30_000 }).catch(() => undefined);
    this.logger.log(`Search index rebuilt with ${total} products`);
    return total;
  }

  async productIdsForTaxonomy(change: {
    categoryIds?: string[];
    brandIds?: string[];
    attributeIds?: string[];
  }): Promise<string[]> {
    const or = [
      ...(change.categoryIds?.length ? [{ categoryId: { in: change.categoryIds } }] : []),
      ...(change.brandIds?.length ? [{ brandId: { in: change.brandIds } }] : []),
      ...(change.attributeIds?.length ? [{ attributeValues: { some: { attributeId: { in: change.attributeIds } } } }] : []),
    ];
    if (or.length === 0) return [];
    const rows = await this.prisma.product.findMany({ where: { OR: or, deletedAt: null }, select: { id: true } });
    return rows.map((row) => row.id);
  }

  async isHealthy(): Promise<boolean> {
    return this.meili.isHealthy().catch(() => false);
  }

  private async ensureIndex(uid: string): Promise<void> {
    try {
      await this.meili.getIndex(uid);
    } catch {
      await this.meili.createIndex(uid, { primaryKey: 'id' }).waitTask({ timeout: 30_000 });
    }
    await this.meili.index(uid).updateSettings(PRODUCT_INDEX_SETTINGS).waitTask({ timeout: 60_000 });
  }
}
