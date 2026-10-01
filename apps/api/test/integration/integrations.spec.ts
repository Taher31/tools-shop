import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
  ApiErrorBody,
  IntegrationLogView,
  IntegrationView,
  Paginated,
} from '@toolshop/shared';
import type { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { MockMarketplaceAdapter } from '../../src/modules/integrations/adapters/mock-marketplace.adapter';
import { IntegrationsService } from '../../src/modules/integrations/integrations.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUES } from '../../src/infrastructure/queue/queue.constants';
import { ADMIN, type Agent, agentFor, API, createTestApp, login, SUPPORT } from './support/app';
import { ok, setStock, variantOf } from './support/commerce';

const FEED_TOKEN = 'feed-token-0123456789abcdefghij';

describe('integration center', () => {
  let app: NestExpressApplication;
  let admin: Agent;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    admin = await login(app, ADMIN.identifier, ADMIN.password);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('lists channels honestly and refuses to enable ones without an official spec', async () => {
    const list = ok<IntegrationView[]>(await admin.get(`${API}/admin/integrations`));
    expect(list.map((i) => i.code).sort()).toEqual(['digikala', 'mock_marketplace', 'torob']);
    const digikala = list.find((i) => i.code === 'digikala');
    expect(digikala?.available).toBe(false);
    const enable = await admin.put(`${API}/admin/integrations/digikala`).send({
      isEnabled: true,
      credentials: { sellerId: '123', apiToken: 'secret-token' },
    });
    expect(enable.status).toBe(409);

    const support = await login(app, SUPPORT.identifier, SUPPORT.password);
    expect((await support.get(`${API}/admin/integrations`)).status).toBe(403);
  });

  it('stores credentials encrypted and never returns secrets', async () => {
    const missing = await admin
      .put(`${API}/admin/integrations/mock_marketplace`)
      .send({ isEnabled: true });
    expect(missing.status).toBe(400);
    expect((missing.body as ApiErrorBody).error.details?.[0]?.path).toBe('credentials.apiKey');

    const saved = ok<IntegrationView>(
      await admin
        .put(`${API}/admin/integrations/mock_marketplace`)
        .send({ credentials: { apiKey: 'mk_live_SECRET_9876', shopId: 'shop-1' } }),
    );
    const apiKey = saved.credentialFields.find((f) => f.key === 'apiKey');
    expect(apiKey).toMatchObject({ configured: true, preview: '••••9876' });
    expect(saved.credentialFields.find((f) => f.key === 'shopId')?.preview).toBe('shop-1');
    expect(JSON.stringify(saved)).not.toContain('SECRET');

    const row = await prisma.integration.findUniqueOrThrow({ where: { code: 'mock_marketplace' } });
    expect(row.encryptedCredentials).toBeTruthy();
    expect(row.encryptedCredentials).not.toContain('SECRET');
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'integration.update', entityId: row.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(JSON.stringify(audit)).not.toContain('SECRET');

    ok(
      await admin
        .put(`${API}/admin/integrations/mock_marketplace`)
        .send({ credentials: { apiKey: 'invalid' } }),
    );
    const failedTest = ok<IntegrationView>(
      await admin.post(`${API}/admin/integrations/mock_marketplace/test`),
    );
    expect(failedTest.status).toBe('error');
    ok(
      await admin
        .put(`${API}/admin/integrations/mock_marketplace`)
        .send({ credentials: { apiKey: 'mk_live_SECRET_9876' } }),
    );
    const passed = ok<IntegrationView>(
      await admin.post(`${API}/admin/integrations/mock_marketplace/test`),
    );
    expect(passed.status).toBe('ready');
  });

  it('syncs price and stock to a push channel and records listing state', async () => {
    const enabled = ok<IntegrationView>(
      await admin.put(`${API}/admin/integrations/mock_marketplace`).send({ isEnabled: true }),
    );
    expect(enabled.isEnabled).toBe(true);

    // Enabling queued a full sync; workers are off in tests, so check the queue then run the sync directly.
    const queue = app.get<Queue>(getQueueToken(QUEUES.MARKETPLACE_SYNC));
    expect(await queue.getJobCountByTypes('waiting', 'delayed')).toBeGreaterThan(0);

    const service = app.get(IntegrationsService);
    const variant = await variantOf(admin, 'kaveh-kid-850-impact-drill');
    const product = await prisma.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
      select: { productId: true },
    });
    await setStock(admin, variant.id, { MAIN: 4, ISF: 0 });
    expect(await service.syncProducts('mock_marketplace', [product.productId])).toMatchObject({
      synced: 1,
      failed: 0,
    });

    const listing = await prisma.marketplaceListing.findUniqueOrThrow({
      where: { productId_channel: { productId: product.productId, channel: 'mock_marketplace' } },
    });
    expect(listing.status).toBe('synced');
    const remote = await app.get(MockMarketplaceAdapter).stored(listing.externalId ?? '');
    expect(remote).toMatchObject({ price: variant.price, availableQuantity: 4, inStock: true });
    expect(remote?.url).toMatch(/\/product\//);

    // A stock change re-queues the product for every enabled push channel.
    await queue.drain();
    await setStock(admin, variant.id, { MAIN: 0 });
    await service.enqueueChangedProducts([product.productId]);
    expect(await queue.getJobCountByTypes('waiting')).toBe(1);
    await service.syncProducts('mock_marketplace', [product.productId]);
    expect(await app.get(MockMarketplaceAdapter).stored(listing.externalId ?? '')).toMatchObject({
      inStock: false,
    });

    // Hidden products are removed from the channel.
    await prisma.product.update({ where: { id: product.productId }, data: { status: 'draft' } });
    expect(await service.syncProducts('mock_marketplace', [product.productId])).toMatchObject({
      removed: 1,
    });
    expect(await app.get(MockMarketplaceAdapter).stored(listing.externalId ?? '')).toBeNull();
    await prisma.product.update({ where: { id: product.productId }, data: { status: 'active' } });

    const view = ok<IntegrationView[]>(await admin.get(`${API}/admin/integrations`)).find(
      (i) => i.code === 'mock_marketplace',
    );
    expect(view?.listings.disabled).toBe(1);
    const logs = ok<Paginated<IntegrationLogView>>(
      await admin.get(`${API}/admin/integrations/mock_marketplace/logs`),
    );
    expect(logs.items.some((l) => l.action === 'sync.batch')).toBe(true);
  });

  it('records per-product failures without failing the batch', async () => {
    ok(
      await admin
        .put(`${API}/admin/integrations/mock_marketplace`)
        .send({ credentials: { apiKey: 'invalid' } }),
    );
    const service = app.get(IntegrationsService);
    const product = await prisma.product.findFirstOrThrow({
      where: { status: 'active', deletedAt: null },
    });
    expect(await service.syncProducts('mock_marketplace', [product.id])).toMatchObject({
      synced: 0,
      failed: 1,
    });
    const listing = await prisma.marketplaceListing.findUniqueOrThrow({
      where: { productId_channel: { productId: product.id, channel: 'mock_marketplace' } },
    });
    expect(listing).toMatchObject({ status: 'failed', lastError: 'کلید API نامعتبر است.' });
    const queued = ok<{ queued: number }>(
      await admin.post(`${API}/admin/integrations/mock_marketplace/sync?failed=true`),
    );
    expect(queued.queued).toBeGreaterThanOrEqual(1);
  });

  it('serves the pull feed only when enabled and with the right token', async () => {
    const guest = agentFor(app);
    expect((await guest.get(`${API}/feeds/torob?token=${FEED_TOKEN}`)).status).toBe(404);
    const short = await admin
      .put(`${API}/admin/integrations/torob`)
      .send({ isEnabled: true, credentials: { feedToken: 'short' } });
    expect(short.status).toBe(200);
    expect(
      ok<IntegrationView>(await admin.post(`${API}/admin/integrations/torob/test`)).status,
    ).toBe('error');
    ok(
      await admin
        .put(`${API}/admin/integrations/torob`)
        .send({ credentials: { feedToken: FEED_TOKEN } }),
    );

    expect((await guest.get(`${API}/feeds/torob?token=wrong-token-0123456789abcdef`)).status).toBe(
      404,
    );
    expect((await guest.get(`${API}/feeds/torob`)).status).toBe(404);
    const feed = ok<{ currency: string; products: Record<string, unknown>[] }>(
      await guest.get(`${API}/feeds/torob?token=${FEED_TOKEN}`),
    );
    expect(feed.currency).toBe('IRR');
    expect(feed.products.length).toBeGreaterThan(10);
    expect(feed.products[0]).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        url: expect.stringContaining('/product/'),
        price_rial: expect.any(Number),
      }),
    );
    expect((await guest.get(`${API}/feeds/mock_marketplace?token=${FEED_TOKEN}`)).status).toBe(404);
  });
});
