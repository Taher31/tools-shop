import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
  AdminCategoryView,
  AdminProductDetail,
  ApiErrorBody,
  CategoryTreeNode,
  ProductDetail,
  ProductSearchResult,
} from '@toolshop/shared';
import type { Meilisearch } from 'meilisearch';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { MEILI_CLIENT } from '../../src/modules/search/meili.client';
import { SearchIndexService } from '../../src/modules/search/search-index.service';
import { ADMIN, type Agent, agentFor, API, createTestApp, login } from './support/app';
import { ok } from './support/commerce';

function findCategory(nodes: CategoryTreeNode[], slug: string): CategoryTreeNode | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const child = findCategory(node.children, slug);
    if (child) return child;
  }
  return undefined;
}

describe('catalog management and search', () => {
  let app: NestExpressApplication;
  let admin: Agent;
  let content: Agent;
  let guest: Agent;

  beforeAll(async () => {
    app = await createTestApp();
    admin = await login(app, ADMIN.identifier, ADMIN.password);
    content = await login(app, 'content@example.com', 'Staff@12345');
    guest = agentFor(app);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app?.close();
  });

  describe('products with dynamic attributes', () => {
    let categoryId: string;
    let attributeIds: Record<string, string>;
    let productId: string;
    let product: Record<string, unknown>;

    beforeAll(async () => {
      const tree = ok<AdminCategoryView[]>(await content.get(`${API}/admin/categories`));
      categoryId = findCategory(tree, 'cordless-drills')?.id ?? '';
      const effective = ok<{ attribute: { id: string; code: string } }[]>(
        await content.get(`${API}/admin/categories/${categoryId}/effective-attributes`),
      );
      attributeIds = Object.fromEntries(effective.map((e) => [e.attribute.code, e.attribute.id]));
      product = {
        title: 'دریل پیچ‌گوشتی شارژی آزمایشی ۱۲ ولت',
        englishTitle: 'Test cordless drill 12V',
        categoryId,
        model: 'TST-12',
        status: 'draft',
        tags: ['دریل آزمایشی'],
        variants: [{ sku: 'tst-cd12-001', price: 25_000_000 }],
        attributes: [{ attributeId: attributeIds['voltage_v'], value: '۱۲' }],
      };
    });

    it('allows incomplete drafts but enforces inherited required attributes on publish', async () => {
      const activeWithoutRequired = await content
        .post(`${API}/admin/products`)
        .send({ ...product, status: 'active' });
      expect(activeWithoutRequired.status).toBe(400);
      const messages =
        (activeWithoutRequired.body as ApiErrorBody).error.details?.map((d) => d.message) ?? [];
      expect(messages).toContain('مقدار «منبع تغذیه» الزامی است.');

      const draft = ok<AdminProductDetail>(
        await content.post(`${API}/admin/products`).send(product),
      );
      productId = draft.id;
      expect(draft.status).toBe('draft');
      expect(draft.variants[0]?.sku).toBe('TST-CD12-001');
      await guest.get(`${API}/products/${draft.slug}`).expect(404);

      const publishIncomplete = await content
        .put(`${API}/admin/products/${productId}`)
        .send({ ...product, status: 'active' });
      expect(publishIncomplete.status).toBe(400);
    });

    it('publishes the product with typed, Persian-formatted specs', async () => {
      const variantId = ok<AdminProductDetail>(
        await content.get(`${API}/admin/products/${productId}`),
      ).variants[0]?.id;
      product = {
        ...product,
        status: 'active',
        variants: [{ id: variantId, sku: 'TST-CD12-001', price: 25_000_000 }],
        attributes: [
          ...(product['attributes'] as object[]),
          { attributeId: attributeIds['power_source'], value: 'cordless' },
        ],
      };
      const published = ok<AdminProductDetail>(
        await content.put(`${API}/admin/products/${productId}`).send(product),
      );
      const detail = ok<ProductDetail>(await guest.get(`${API}/products/${published.slug}`));
      expect(detail.variants[0]?.price).toBe(25_000_000);
      expect(detail.breadcrumbs.map((b) => b.slug)).toEqual([
        'power-tools',
        'drills',
        'cordless-drills',
      ]);
      expect(detail.specs.find((s) => s.code === 'voltage_v')?.value).toBe('۱۲ ولت');
      expect(detail.specs.find((s) => s.code === 'power_source')?.value).toBe('شارژی');
    });

    it('only lets roles with the price permission change prices, and audits the change', async () => {
      const variants = product['variants'] as { id: string; sku: string; price: number }[];
      const repriced = { ...product, variants: variants.map((v) => ({ ...v, price: 26_000_000 })) };
      const denied = await content.put(`${API}/admin/products/${productId}`).send(repriced);
      expect(denied.status).toBe(403);

      ok(await admin.put(`${API}/admin/products/${productId}`).send(repriced));
      const current = ok<AdminProductDetail>(await admin.get(`${API}/admin/products/${productId}`));
      const detail = ok<ProductDetail>(await guest.get(`${API}/products/${current.slug}`));
      expect(detail.variants[0]?.price).toBe(26_000_000);

      const audit = await app.get(PrismaService).auditLog.findFirst({
        where: { action: 'product.price.update', entityId: productId },
      });
      expect(audit?.before).toEqual({
        'TST-CD12-001': { price: 25_000_000, compareAtPrice: null },
      });
      expect(audit?.after).toEqual({ 'TST-CD12-001': { price: 26_000_000, compareAtPrice: null } });
    });

    it('keeps SKUs unique across the catalog', async () => {
      const duplicate = await admin.post(`${API}/admin/products`).send({
        ...product,
        title: 'محصول تکراری',
        variants: [{ sku: 'VLT-VCD18-K2', price: 1_000_000 }],
      });
      expect(duplicate.status).toBe(400);
      expect((duplicate.body as ApiErrorBody).error.details?.[0]?.path).toBe('variants.0.sku');
    });
  });

  describe('search', () => {
    let engineAvailable = false;

    beforeAll(async () => {
      const index = app.get(SearchIndexService);
      engineAvailable = await index.isHealthy().catch(() => false);
      if (engineAvailable) await index.reindexAll();
    });

    const search = async (params: Record<string, string>) =>
      ok<ProductSearchResult>(await guest.get(`${API}/products`).query(params));

    it('understands Persian queries regardless of digits, Arabic letters and spacing', async (context) => {
      if (!engineAvailable) context.skip();
      const variants = ['دریل شارژی 18 ولت', 'دريل شارژي ۱۸ ولت', 'دریلشارژی ۱۸ولت'];
      for (const q of variants) {
        const result = await search({ q });
        expect(result.engine).toBe('meilisearch');
        expect(result.items[0]?.slug, q).toBe('volter-vcd-18-cordless-drill');
      }
      const joined = await search({ q: 'پیچگوشتی' });
      const spaced = await search({ q: 'پیچ گوشتی' });
      expect(joined.total).toBeGreaterThan(0);
      expect(joined.items.map((i) => i.id).sort()).toEqual(spaced.items.map((i) => i.id).sort());
    });

    it('finds products by SKU, synonyms and with typos', async (context) => {
      if (!engineAvailable) context.skip();
      expect((await search({ q: 'VLT-VCD18-K2' })).items[0]?.slug).toBe(
        'volter-vcd-18-cordless-drill',
      );
      expect(
        (await search({ q: 'هیلتی' })).items.some((i) => i.slug.includes('rotary-hammer')),
      ).toBe(true);
      expect((await search({ q: 'دریل شارزی' })).total).toBeGreaterThan(0);
    });

    it('indexes newly published products and builds facets from category attributes', async (context) => {
      if (!engineAvailable) context.skip();
      const prisma = app.get(PrismaService);
      const created = await prisma.product.findFirstOrThrow({
        where: { variants: { some: { sku: 'TST-CD12-001' } } },
      });
      await app.get(SearchIndexService).indexProducts([created.id]);
      expect((await search({ q: 'TST-CD12-001' })).items[0]?.id).toBe(created.id);

      const listing = await search({ category: 'cordless-drills' });
      const voltage = listing.facets.attributes.find((f) => f.code === 'voltage_v');
      expect(voltage?.values.map((v) => v.value)).toEqual(expect.arrayContaining(['12', '18']));
      const filtered = await search({ category: 'cordless-drills', 'attr.voltage_v': '12' });
      expect(filtered.items.length).toBeGreaterThan(0);
      expect(
        filtered.items.every(
          (item) => item.title.includes('۱۲') || item.keySpecs.some((s) => s.value.includes('۱۲')),
        ),
      ).toBe(true);
    });

    it('falls back to the database when the search engine is down', async () => {
      const meili = app.get<Meilisearch>(MEILI_CLIENT);
      const spy = vi
        .spyOn(meili, 'multiSearch')
        .mockRejectedValue(new Error('connect ECONNREFUSED'));
      try {
        const result = await search({ q: 'دریل' });
        expect(result.engine).toBe('database');
        expect(result.total).toBeGreaterThan(0);
        expect(result.items.every((item) => item.title.includes('دریل'))).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
