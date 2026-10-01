import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
  AdminOrderDetail,
  AdminPaymentView,
  ApiErrorBody,
  OrderDetail,
} from '@toolshop/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  ADMIN,
  type Agent,
  agentFor,
  API,
  createTestApp,
  CUSTOMER,
  login,
  newCustomer,
  SUPPORT,
  WAREHOUSE,
} from './support/app';
import {
  addToCart,
  checkout,
  inventoryOf,
  levelOf,
  ok,
  payOnMockBank,
  setStock,
  variantOf,
} from './support/commerce';

const PERSIAN = /[\u0600-\u06FF]/;
const SOME_UUID = '0192f0e0-0000-7000-8000-000000000000';

function errorOf(response: request.Response): ApiErrorBody['error'] {
  return (response.body as ApiErrorBody).error;
}

function cookieValue(response: request.Response, name: string): string {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((c) => c.startsWith(`${name}=`));
  if (!cookie) throw new Error(`Cookie ${name} was not set`);
  return decodeURIComponent(cookie.slice(name.length + 1).split(';')[0] ?? '');
}

describe('HTTP security, authentication and RBAC', () => {
  let app: NestExpressApplication;
  let admin: Agent;
  let warehouse: Agent;
  let support: Agent;
  let customer: Agent;

  beforeAll(async () => {
    app = await createTestApp();
    [admin, warehouse, support, customer] = await Promise.all([
      login(app, ADMIN.identifier, ADMIN.password),
      login(app, WAREHOUSE.identifier, WAREHOUSE.password),
      login(app, SUPPORT.identifier, SUPPORT.password),
      login(app, CUSTOMER.identifier, CUSTOMER.password),
    ]);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('error responses', () => {
    it('answers unknown routes and validation failures with stable codes and Persian messages', async () => {
      const missing = await agentFor(app).get(`${API}/no-such-route`);
      expect(missing.status).toBe(404);
      expect(errorOf(missing).code).toBe('NOT_FOUND');

      const invalid = await agentFor(app)
        .post(`${API}/auth/register`)
        .send({ firstName: 'علی', lastName: 'رضایی', mobile: '12345', password: 'short' });
      expect(invalid.status).toBe(400);
      expect(errorOf(invalid).code).toBe('VALIDATION_FAILED');
      const paths = errorOf(invalid).details?.map((d) => d.path) ?? [];
      expect(paths).toEqual(expect.arrayContaining(['mobile', 'password']));
      expect(errorOf(invalid).details?.every((d) => PERSIAN.test(d.message))).toBe(true);
    });

    it('sends security headers and hides the framework', async () => {
      const response = await agentFor(app).get(`${API}/health/live`);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('does not treat malformed ids as server errors', async () => {
      const response = await admin.get(`${API}/admin/orders/not-a-uuid`);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('authentication', () => {
    it('rotates refresh tokens and revokes the session when an old token is replayed', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ identifier: CUSTOMER.identifier, password: CUSTOMER.password })
        .expect(200);
      const first = cookieValue(loginResponse, 'ts_rt');
      expect(loginResponse.headers['set-cookie']?.toString()).toMatch(/ts_rt=[^;]+;.*HttpOnly/i);

      const rotated = await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: first })
        .expect(200);
      const { accessToken, refreshToken: second } = rotated.body as {
        accessToken: string;
        refreshToken: string;
      };
      expect(second).not.toBe(first);
      await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set('authorization', `Bearer ${accessToken}`)
        .expect(200);

      const replay = await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: first });
      expect(replay.status).toBe(401);
      // Reuse means the token leaked: the whole session is gone, including the newest token.
      const afterReuse = await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: second });
      expect(afterReuse.status).toBe(401);
    });

    it('locks an account after repeated wrong passwords, even for the right password', async () => {
      const { mobile, password } = await newCustomer(app);
      for (let i = 0; i < 8; i += 1) {
        await agentFor(app)
          .post(`${API}/auth/login`)
          .send({ identifier: mobile, password: 'Wrong@12345' })
          .expect(401);
      }
      const locked = await agentFor(app)
        .post(`${API}/auth/login`)
        .send({ identifier: mobile, password });
      expect(locked.status).toBe(429);
      expect(errorOf(locked).code).toBe('RATE_LIMITED');
    });

    it('gives the same answer for an unknown user and a wrong password', async () => {
      const unknown = await agentFor(app)
        .post(`${API}/auth/login`)
        .send({ identifier: '09129999999', password: 'Whatever@1' });
      const wrong = await agentFor(app)
        .post(`${API}/auth/login`)
        .send({ identifier: 'sales@example.com', password: 'Whatever@1' });
      expect(unknown.status).toBe(401);
      expect(errorOf(unknown)).toEqual({
        ...errorOf(wrong),
        requestId: errorOf(unknown).requestId,
      });
    });
  });

  describe('CSRF origin check', () => {
    it('rejects state-changing browser requests from foreign origins', async () => {
      const variant = await variantOf(customer, 'toolino-taw-adjustable-wrench');
      const forged = await customer
        .post(`${API}/cart/items`)
        .set('origin', 'https://evil.example')
        .send({ variantId: variant.id, quantity: 1 });
      expect(forged.status).toBe(403);

      const sameSite = await customer
        .post(`${API}/cart/items`)
        .set('origin', process.env['APP_PUBLIC_URL'] ?? '')
        .send({ variantId: variant.id, quantity: 1 });
      expect(sameSite.status).toBe(201);
    });

    it('still accepts payment gateway callbacks posted from the bank domain', async () => {
      const callback = await agentFor(app)
        .post(`${API}/payments/callback/mock`)
        .set('origin', 'https://bank.example')
        .type('form')
        .send({ authority: 'MOCKUNKNOWNAUTHORITY', status: 'OK' });
      expect(callback.status).toBe(302);
      expect(callback.headers['location']).toContain('/checkout/result');
    });
  });

  describe('role-based access control', () => {
    it('requires a staff session for every admin route', async () => {
      const anonymous = await agentFor(app).get(`${API}/admin/orders`);
      expect(anonymous.status).toBe(401);
      expect(errorOf(anonymous).code).toBe('UNAUTHENTICATED');
      expect(PERSIAN.test(errorOf(anonymous).message)).toBe(true);

      const asCustomer = await customer.get(`${API}/admin/orders`);
      expect(asCustomer.status).toBe(403);
      expect(errorOf(asCustomer).code).toBe('FORBIDDEN');
    });

    it('limits each role to its own permissions', async () => {
      await warehouse.get(`${API}/admin/inventory`).expect(200);
      await warehouse.get(`${API}/admin/orders`).expect(200);
      await warehouse.get(`${API}/admin/audit-logs`).expect(403);
      await warehouse.get(`${API}/admin/users`).expect(403);
      await warehouse.post(`${API}/admin/payments/${SOME_UUID}/refund`).send({}).expect(403);
      await warehouse
        .put(`${API}/admin/products/variants/${SOME_UUID}/price`)
        .send({ price: 1000 })
        .expect(403);

      await support.get(`${API}/admin/orders`).expect(200);
      await support
        .post(`${API}/admin/orders/${SOME_UUID}/status`)
        .send({ status: 'processing' })
        .expect(403);
      await support.post(`${API}/admin/inventory/operations`).send({}).expect(403);

      await admin.get(`${API}/admin/audit-logs`).expect(200);
    });

    it('runs fulfilment, return and refund with the right roles and records an audit trail', async () => {
      const prisma = app.get(PrismaService);
      const buyer = await newCustomer(app);
      const variant = await variantOf(buyer.agent, 'toolino-tws-12-combination-wrench-set');
      await setStock(admin, variant.id, { MAIN: 5, ISF: 0 });
      await addToCart(buyer.agent, variant.id, 2);
      const placed = await checkout(buyer.agent, buyer.addressId);
      await buyer.agent
        .get(await payOnMockBank(buyer.agent, placed.paymentUrl, 'success'))
        .expect(302);

      const status = (agent: Agent, body: Record<string, string>) =>
        agent.post(`${API}/admin/orders/${placed.orderId}/status`).send(body);

      expect(ok<AdminOrderDetail>(await status(warehouse, { status: 'processing' })).status).toBe(
        'processing',
      );
      expect(ok<AdminOrderDetail>(await status(warehouse, { status: 'packed' })).status).toBe(
        'packed',
      );
      const noTracking = await status(warehouse, { status: 'shipped' });
      expect(noTracking.status).toBe(400);
      expect(errorOf(noTracking).details?.[0]?.path).toBe('trackingCode');
      const shipped = ok<AdminOrderDetail>(
        await status(warehouse, { status: 'shipped', trackingCode: 'TPX-1001' }),
      );
      expect(shipped.trackingCode).toBe('TPX-1001');
      expect(errorOf(await status(warehouse, { status: 'paid' })).code).toBe(
        'INVALID_ORDER_TRANSITION',
      );
      expect((await status(warehouse, { status: 'cancelled' })).status).toBe(403);
      expect(ok<AdminOrderDetail>(await status(warehouse, { status: 'delivered' })).status).toBe(
        'delivered',
      );

      expect(levelOf(await inventoryOf(admin, variant.id), 'MAIN').onHand).toBe(3);
      expect(
        ok<AdminOrderDetail>(await status(admin, { status: 'returned', note: 'مرجوعی' })).status,
      ).toBe('returned');
      expect(levelOf(await inventoryOf(admin, variant.id), 'MAIN').onHand).toBe(5);

      const order = ok<AdminOrderDetail>(await admin.get(`${API}/admin/orders/${placed.orderId}`));
      const paymentId = order.payments[0]?.id ?? '';
      await warehouse.post(`${API}/admin/payments/${paymentId}/refund`).send({}).expect(403);
      const refunded = ok<AdminPaymentView>(
        await admin.post(`${API}/admin/payments/${paymentId}/refund`).send({ reason: 'مرجوعی' }),
      );
      expect(refunded.status).toBe('refunded');
      const finalOrder = ok<OrderDetail>(
        await buyer.agent.get(`${API}/account/orders/${placed.orderId}`),
      );
      expect(finalOrder.status).toBe('refunded');

      const trail = await prisma.auditLog.findMany({
        where: { entityId: { in: [placed.orderId, paymentId] } },
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { email: true } } },
      });
      expect(trail.map((entry) => [entry.action, entry.actor?.email])).toEqual([
        ['order.status', 'warehouse@example.com'],
        ['order.status', 'warehouse@example.com'],
        ['order.status', 'warehouse@example.com'],
        ['order.status', 'warehouse@example.com'],
        ['order.status', 'admin@example.com'],
        ['payment.refund', 'admin@example.com'],
      ]);
      expect(trail[0]?.before).toEqual({ status: 'paid' });
    });
  });
});
