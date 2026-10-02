import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
  AdminOrderSummary,
  AdminPaymentView,
  AuditLogView,
  CustomerListItem,
  Paginated,
} from '@toolshop/shared';
import { tehranDateKey } from '@toolshop/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { ADMIN, type Agent, API, createTestApp, login } from './support/app';
import { ok } from './support/commerce';

const TEHRAN_MS = 210 * 60_000;

describe('admin list filters', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  const ids: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await login(app, ADMIN.identifier, ADMIN.password);
  });

  afterAll(async () => {
    await app?.close();
  });

  const list = async <T>(path: string, qs: string) =>
    ok<Paginated<T>>(await admin.get(`${API}${path}?pageSize=100&${qs}`));

  it('filters orders by Tehran calendar day, including the day boundaries', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { type: 'customer' } });
    const template = await prisma.order.findFirstOrThrow({ include: { items: true } });
    // Two instants that straddle Tehran midnight (00:00 Tehran = 20:30 UTC).
    const day = '2024-03-10';
    const startUtc = new Date(Date.UTC(2024, 2, 10) - TEHRAN_MS);
    const justBefore = new Date(startUtc.getTime() - 60_000);
    const justAfter = new Date(startUtc.getTime() + 60_000);
    const lastMinute = new Date(startUtc.getTime() + 86_400_000 - 60_000);
    for (const [index, createdAt] of [justBefore, justAfter, lastMinute].entries()) {
      const order = await prisma.order.create({
        data: {
          orderNumber: 900_000 + index,
          userId: user.id,
          status: template.status,
          subtotal: template.subtotal,
          shippingCost: template.shippingCost,
          discountTotal: template.discountTotal,
          taxTotal: template.taxTotal,
          total: 5_000_000n * BigInt(index + 1),
          currency: template.currency,
          shippingMethodId: template.shippingMethodId,
          shippingMethodName: template.shippingMethodName,
          shippingAddress: template.shippingAddress as object,
          createdAt,
        } as never,
      });
      ids.push(order.id);
    }
    const inDay = await list<AdminOrderSummary>('/admin/orders', `from=${day}&to=${day}`);
    expect(inDay.items.map((o) => o.orderNumber).sort()).toEqual([900_001, 900_002]);

    const range = await list<AdminOrderSummary>('/admin/orders', `from=2024-03-09&to=2024-03-10`);
    expect(range.items.map((o) => o.orderNumber).sort()).toEqual([900_000, 900_001, 900_002]);

    const since = await list<AdminOrderSummary>('/admin/orders', `from=2024-03-11&to=2024-03-11`);
    expect(since.items).toHaveLength(0);
  });

  it('filters by amount in Toman and sorts', async () => {
    const found = await list<AdminOrderSummary>(
      '/admin/orders',
      'from=2024-03-09&to=2024-03-10&minTotal=700000&sort=total_desc',
    );
    // 5,000,000 / 10,000,000 / 15,000,000 Rial = 500k / 1M / 1.5M Toman → two pass ≥ 700k.
    expect(found.items.map((o) => o.orderNumber)).toEqual([900_002, 900_001]);
    const cheap = await list<AdminOrderSummary>(
      '/admin/orders',
      'from=2024-03-09&to=2024-03-10&maxTotal=600000',
    );
    expect(cheap.items.map((o) => o.orderNumber)).toEqual([900_000]);
  });

  it('rejects malformed dates and amounts', async () => {
    expect((await admin.get(`${API}/admin/orders?from=1405/07/10`)).status).toBe(400);
    expect((await admin.get(`${API}/admin/orders?from=2024-02-30`)).status).toBe(400);
    expect((await admin.get(`${API}/admin/orders?minTotal=-5`)).status).toBe(400);
  });

  it('filters payments, customers and the audit log by date', async () => {
    const today = tehranDateKey();
    const payments = await list<AdminPaymentView>('/admin/payments', `from=${today}&to=${today}`);
    const all = await list<AdminPaymentView>('/admin/payments', '');
    expect(payments.items.length).toBeLessThanOrEqual(all.items.length);
    expect(
      (await list<AdminPaymentView>('/admin/payments', 'from=2001-01-01&to=2001-01-02')).items,
    ).toHaveLength(0);

    const customers = await list<CustomerListItem>('/admin/customers', 'hasOrders=true');
    expect(customers.items.every((c) => c.ordersCount > 0)).toBe(true);
    const none = await list<CustomerListItem>('/admin/customers', 'hasOrders=false');
    expect(none.items.every((c) => c.ordersCount === 0)).toBe(true);

    const audit = await list<AuditLogView>('/admin/audit-logs', 'from=2001-01-01&to=2001-01-02');
    expect(audit.items).toHaveLength(0);
    const ai = await list<AuditLogView>('/admin/audit-logs', 'actorType=ai');
    expect(ai.items.every((row) => row.actorType === 'ai')).toBe(true);
  });
});
