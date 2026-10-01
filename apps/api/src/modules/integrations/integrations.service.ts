import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Integration, Prisma } from '@toolshop/database';
import {
  type IntegrationLogView,
  type IntegrationStatus,
  type IntegrationUpdateInput,
  type IntegrationView,
  MARKETPLACE_SYNC_STATUSES,
  type MarketplaceSyncStatus,
  type Paginated,
  type PaginationQuery,
} from '@toolshop/shared';
import type { Queue } from 'bullmq';
import { AppException } from '../../common/errors/app-exception';
import { decryptSecret, encryptSecret, safeEqual } from '../../common/utils/crypto';
import { toRial } from '../../common/utils/money';
import { paginate, paginationArgs } from '../../common/utils/pagination';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QUEUES } from '../../infrastructure/queue/queue.constants';
import { AuditService } from '../audit/audit.service';
import {
  ACTIVE_LEVELS_SELECT,
  displayVariant,
  VISIBLE_PRODUCT_WHERE,
} from '../catalog/product-card';
import { TaxonomyService } from '../catalog/taxonomy.service';
import { availableQuantity } from '../inventory/stock';
import {
  type Credentials,
  IntegrationError,
  MARKETPLACE_ADAPTERS,
  type MarketplaceAdapter,
  type MarketplaceProduct,
} from './adapters/marketplace-adapter';

export const MARKETPLACE_JOBS = { SYNC: 'sync-products', FULL_SYNC: 'full-sync' } as const;
export interface SyncJob {
  code: string;
  productIds: string[];
}

const BATCH_SIZE = 50;

const PRODUCT_INCLUDE = {
  brand: { select: { name: true } },
  images: { orderBy: { sortOrder: 'asc' }, take: 1 },
  variants: {
    where: { isActive: true, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    include: { inventoryLevels: ACTIVE_LEVELS_SELECT },
  },
} satisfies Prisma.ProductInclude;

/**
 * Integration center: owns channel state, encrypted credentials, listing sync and logs.
 * Product and stock changes arrive as outbox events (see IntegrationsListener) and are
 * synced by a BullMQ worker, so a slow or broken channel never blocks the store.
 */
@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  private readonly adapters: Map<string, MarketplaceAdapter>;

  constructor(
    @Inject(MARKETPLACE_ADAPTERS) adapters: MarketplaceAdapter[],
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
    @InjectQueue(QUEUES.MARKETPLACE_SYNC) private readonly queue: Queue,
  ) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.code, adapter]));
  }

  /* ------------------------------------------------------------- admin */

  async list(): Promise<IntegrationView[]> {
    const rows = await this.prisma.integration.findMany();
    const byCode = new Map(rows.map((row) => [row.code, row]));
    const stats = await this.prisma.marketplaceListing.groupBy({
      by: ['channel', 'status'],
      _count: { _all: true },
    });
    return [...this.adapters.values()].map((adapter) =>
      this.toView(
        adapter,
        byCode.get(adapter.code) ?? null,
        stats.filter((s) => s.channel === adapter.code),
      ),
    );
  }

  async get(code: string): Promise<IntegrationView> {
    const view = (await this.list()).find((item) => item.code === code);
    if (!view) throw AppException.notFound('اتصال یافت نشد.');
    return view;
  }

  async update(code: string, input: IntegrationUpdateInput): Promise<IntegrationView> {
    const adapter = this.adapter(code);
    const row = await this.row(code);
    const credentials = this.credentials(row);
    const changedKeys: string[] = [];
    for (const [key, value] of Object.entries(input.credentials ?? {})) {
      if (!adapter.credentialFields.some((field) => field.key === key)) {
        throw AppException.validation([
          { path: `credentials.${key}`, message: 'این فیلد برای اتصال تعریف نشده است.' },
        ]);
      }
      if (value) credentials[key] = value;
      else delete credentials[key];
      changedKeys.push(key);
    }
    const missing = adapter.credentialFields.filter((f) => f.required && !credentials[f.key]);
    const isEnabled = input.isEnabled ?? row.isEnabled;
    if (isEnabled && !adapter.available) {
      throw AppException.conflict(
        `اتصال «${adapter.name}» هنوز قابل فعال‌سازی نیست. ${adapter.notes}`,
      );
    }
    if (isEnabled && missing.length > 0) {
      throw AppException.validation(
        missing.map((f) => ({ path: `credentials.${f.key}`, message: `«${f.label}» الزامی است.` })),
        'برای فعال‌سازی، اطلاعات اتصال را کامل کنید.',
      );
    }
    // New credentials clear a previous error; otherwise an error stays until a successful test.
    const status: IntegrationStatus =
      missing.length > 0
        ? 'not_configured'
        : row.status === 'error' && changedKeys.length === 0
          ? 'error'
          : 'ready';

    await this.prisma.$transaction(async (tx) => {
      await tx.integration.update({
        where: { id: row.id },
        data: {
          isEnabled,
          status,
          ...(changedKeys.length > 0
            ? {
                encryptedCredentials:
                  Object.keys(credentials).length > 0
                    ? encryptSecret(JSON.stringify(credentials), this.config.encryptionKey)
                    : null,
                lastError: null,
              }
            : {}),
        },
      });
      // Secrets never reach the audit log: only which fields changed.
      await this.audit.record(
        {
          action: 'integration.update',
          entityType: 'integration',
          entityId: row.id,
          summary: `اتصال ${adapter.name}`,
          before: { isEnabled: row.isEnabled },
          after: { isEnabled, credentialsChanged: changedKeys },
        },
        tx,
      );
    });
    if (isEnabled && !row.isEnabled && adapter.kind === 'push') await this.enqueueFullSync(code);
    return this.get(code);
  }

  async testConnection(code: string): Promise<IntegrationView> {
    const adapter = this.adapter(code);
    const row = await this.row(code);
    const result = await adapter
      .testConnection(this.credentials(row))
      .catch((error: unknown) => ({ ok: false, message: this.describe(error) }));
    await this.prisma.integration.update({
      where: { id: row.id },
      data: {
        lastCheckedAt: new Date(),
        status: result.ok ? 'ready' : 'error',
        lastError: result.ok ? null : result.message,
      },
    });
    await this.log(row.id, result.ok ? 'info' : 'error', 'test', result.message);
    return this.get(code);
  }

  async logs(code: string, query: PaginationQuery): Promise<Paginated<IntegrationLogView>> {
    this.adapter(code);
    const where: Prisma.IntegrationLogWhereInput = { integration: { code } };
    const [logs, total] = await Promise.all([
      this.prisma.integrationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(query),
      }),
      this.prisma.integrationLog.count({ where }),
    ]);
    return paginate(
      logs.map((log) => ({
        id: log.id,
        level: log.level,
        action: log.action,
        message: log.message,
        productId: log.productId,
        createdAt: log.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  /* -------------------------------------------------------------- sync */

  /** Called for every product/stock change: queues a sync for each enabled push channel. */
  async enqueueChangedProducts(productIds: string[]): Promise<void> {
    if (productIds.length === 0) return;
    const enabled = await this.prisma.integration.findMany({
      where: { isEnabled: true },
      select: { code: true },
    });
    for (const { code } of enabled) {
      if (this.adapters.get(code)?.kind !== 'push') continue;
      await this.prisma.marketplaceListing.updateMany({
        where: { channel: code, productId: { in: productIds }, status: { not: 'disabled' } },
        data: { status: 'pending' },
      });
      for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
        await this.queue.add(MARKETPLACE_JOBS.SYNC, {
          code,
          productIds: productIds.slice(i, i + BATCH_SIZE),
        } satisfies SyncJob);
      }
    }
  }

  async enqueueFullSync(code: string, onlyFailed = false): Promise<{ queued: number }> {
    const adapter = this.adapter(code);
    if (adapter.kind !== 'push')
      throw AppException.conflict('این اتصال فید است و نیازی به ارسال ندارد.');
    const row = await this.row(code);
    if (!row.isEnabled) throw AppException.conflict('ابتدا اتصال را فعال کنید.');
    const ids = onlyFailed
      ? (
          await this.prisma.marketplaceListing.findMany({
            where: { channel: code, status: 'failed' },
            select: { productId: true },
          })
        ).map((l) => l.productId)
      : (
          await this.prisma.product.findMany({ where: VISIBLE_PRODUCT_WHERE, select: { id: true } })
        ).map((p) => p.id);
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      await this.queue.add(MARKETPLACE_JOBS.SYNC, {
        code,
        productIds: ids.slice(i, i + BATCH_SIZE),
      } satisfies SyncJob);
    }
    await this.log(row.id, 'info', 'sync.queued', `${ids.length} کالا در صف همگام‌سازی قرار گرفت.`);
    return { queued: ids.length };
  }

  /**
   * Pushes the current state of products to a channel. Per-product failures are
   * recorded on the listing and in the log; they never fail the whole batch.
   */
  async syncProducts(
    code: string,
    productIds: string[],
  ): Promise<{ synced: number; failed: number; removed: number }> {
    const adapter = this.adapter(code);
    const row = await this.row(code);
    const result = { synced: 0, failed: 0, removed: 0 };
    let transientError: unknown = null;
    if (!row.isEnabled || adapter.kind !== 'push' || !adapter.upsertListing) return result;
    const credentials = this.credentials(row);
    const products = await this.marketplaceProducts(productIds);
    const listings = new Map(
      (
        await this.prisma.marketplaceListing.findMany({
          where: { channel: code, productId: { in: productIds } },
        })
      ).map((l) => [l.productId, l]),
    );

    for (const productId of productIds) {
      const product = products.get(productId);
      const listing = listings.get(productId);
      try {
        if (!product) {
          // Hidden, archived or deleted: take it off the channel if it was listed.
          if (listing?.externalId && adapter.removeListing) {
            await adapter.removeListing(listing.externalId, credentials);
            await this.saveListing(code, productId, { status: 'disabled', lastError: null });
            result.removed += 1;
          }
          continue;
        }
        const { externalId } = await adapter.upsertListing(
          product,
          credentials,
          listing?.externalId ?? null,
        );
        await this.saveListing(code, productId, {
          status: 'synced',
          externalId,
          lastSyncedAt: new Date(),
          lastError: null,
        });
        result.synced += 1;
      } catch (error) {
        const message = this.describe(error);
        result.failed += 1;
        await this.saveListing(code, productId, { status: 'failed', lastError: message });
        await this.log(row.id, 'error', 'sync.product', message, productId);
        if (!(error instanceof IntegrationError)) {
          transientError = error;
          this.logger.warn({ err: error, code, productId }, 'Marketplace sync failed');
        }
      }
    }
    await this.prisma.integration.update({
      where: { id: row.id },
      data: { lastSyncAt: new Date() },
    });
    if (result.synced + result.removed > 0) {
      await this.log(
        row.id,
        'info',
        'sync.batch',
        `همگام: ${result.synced}، حذف: ${result.removed}، خطا: ${result.failed}`,
      );
    }
    // Network/server errors: let the queue retry the batch with backoff (upserts are idempotent).
    if (transientError) throw transientError;
    return result;
  }

  /* -------------------------------------------------------------- feed */

  /** Public product feed for pull channels; 404 unless enabled and the token matches. */
  async feed(code: string, token: string | undefined): Promise<Record<string, unknown>> {
    const adapter = this.adapters.get(code);
    const row =
      adapter?.kind === 'pull'
        ? await this.prisma.integration.findUnique({ where: { code } })
        : null;
    const expected = row?.isEnabled ? this.credentials(row)['feedToken'] : undefined;
    if (!adapter?.toFeedItem || !expected || !token || !safeEqual(token, expected)) {
      throw AppException.notFound();
    }
    const ids = (
      await this.prisma.product.findMany({ where: VISIBLE_PRODUCT_WHERE, select: { id: true } })
    ).map((p) => p.id);
    const products = await this.marketplaceProducts(ids);
    const toFeedItem = adapter.toFeedItem.bind(adapter);
    return {
      generatedAt: new Date().toISOString(),
      currency: 'IRR',
      count: products.size,
      products: [...products.values()].map(toFeedItem),
    };
  }

  /* ----------------------------------------------------------- helpers */

  /** Visible products as channels see them (default variant price, live stock). */
  async marketplaceProducts(productIds: string[]): Promise<Map<string, MarketplaceProduct>> {
    const [records, taxonomy] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds }, ...VISIBLE_PRODUCT_WHERE },
        include: PRODUCT_INCLUDE,
      }),
      this.taxonomy.get(),
    ]);
    const absolute = (url: string) =>
      url.startsWith('http') ? url : `${this.config.publicUrl}${url}`;
    const result = new Map<string, MarketplaceProduct>();
    for (const product of records) {
      if (!taxonomy.isCategoryVisible(product.categoryId)) continue;
      const variant = displayVariant(product.variants);
      if (!variant) continue;
      const available = product.variants.reduce(
        (sum, v) => sum + availableQuantity(v.inventoryLevels),
        0,
      );
      const image = product.images[0]?.url;
      result.set(product.id, {
        productId: product.id,
        sku: variant.sku,
        title: product.title,
        brand: product.brand?.name ?? null,
        categoryPath: taxonomy.ancestors(product.categoryId).map((c) => c.name),
        url: absolute(`/product/${product.slug}`),
        imageUrl: image ? absolute(image) : null,
        price: toRial(variant.price),
        compareAtPrice: toRial(variant.compareAtPrice),
        availableQuantity: available,
        inStock: available > 0,
      });
    }
    return result;
  }

  private toView(
    adapter: MarketplaceAdapter,
    row: Integration | null,
    stats: { status: MarketplaceSyncStatus; _count: { _all: number } }[],
  ): IntegrationView {
    const credentials = row ? this.credentials(row) : {};
    const listings = Object.fromEntries(MARKETPLACE_SYNC_STATUSES.map((s) => [s, 0])) as Record<
      MarketplaceSyncStatus,
      number
    >;
    for (const stat of stats) listings[stat.status] = stat._count._all;
    return {
      code: adapter.code,
      name: adapter.name,
      description: adapter.description,
      kind: adapter.kind,
      available: adapter.available,
      notes: adapter.notes,
      isEnabled: row?.isEnabled ?? false,
      status: row?.status ?? 'not_configured',
      credentialFields: adapter.credentialFields.map((field) => {
        const value = credentials[field.key];
        return {
          ...field,
          configured: Boolean(value),
          preview: value ? (field.secret ? `••••${value.slice(-4)}` : value) : null,
        };
      }),
      feedUrl:
        adapter.kind === 'pull'
          ? `${this.config.publicUrl}/api/v1/feeds/${adapter.code}?token=…`
          : null,
      lastCheckedAt: row?.lastCheckedAt?.toISOString() ?? null,
      lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
      listings,
    };
  }

  private adapter(code: string): MarketplaceAdapter {
    const adapter = this.adapters.get(code);
    if (!adapter) throw AppException.notFound('اتصال یافت نشد.');
    return adapter;
  }

  private async row(code: string): Promise<Integration> {
    return this.prisma.integration.upsert({ where: { code }, update: {}, create: { code } });
  }

  private credentials(row: Integration): Credentials {
    if (!row.encryptedCredentials) return {};
    try {
      return JSON.parse(
        decryptSecret(row.encryptedCredentials, this.config.encryptionKey),
      ) as Credentials;
    } catch (error) {
      // Wrong APP_ENCRYPTION_KEY or tampered data: treat as not configured.
      this.logger.error(
        { err: error, code: row.code },
        'Could not decrypt integration credentials',
      );
      return {};
    }
  }

  private async saveListing(
    channel: string,
    productId: string,
    data: {
      status: MarketplaceSyncStatus;
      externalId?: string;
      lastSyncedAt?: Date;
      lastError: string | null;
    },
  ): Promise<void> {
    await this.prisma.marketplaceListing.upsert({
      where: { productId_channel: { productId, channel } },
      update: data,
      create: { productId, channel, ...data },
    });
  }

  private async log(
    integrationId: string,
    level: 'info' | 'warning' | 'error',
    action: string,
    message: string,
    productId: string | null = null,
  ): Promise<void> {
    await this.prisma.integrationLog.create({
      data: { integrationId, level, action, message: message.slice(0, 1000), productId },
    });
  }

  private describe(error: unknown): string {
    if (error instanceof IntegrationError) return error.message;
    return 'خطا در ارتباط با سرویس بیرونی؛ دوباره تلاش می‌شود.';
  }
}
