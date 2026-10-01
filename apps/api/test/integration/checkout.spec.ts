import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
  ApiErrorBody,
  CartView,
  CheckoutResult,
  OrderDetail,
  PaymentResultView,
} from '@toolshop/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { ADMIN, type Agent, API, createTestApp, login, newCustomer } from './support/app';
import {
  addToCart,
  checkout,
  inventoryOf,
  levelOf,
  ok,
  payOnMockBank,
  placeOrder,
  prepareCheckout,
  setStock,
  variantOf,
} from './support/commerce';

describe('checkout, inventory reservation and payment', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await login(app, ADMIN.identifier, ADMIN.password);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('prices the cart on the server and refuses an order when the total the customer saw is stale', async () => {
    const { agent, addressId } = await newCustomer(app);
    const variant = await variantOf(agent, 'kaveh-kag-750-angle-grinder');
    await setStock(admin, variant.id, { MAIN: 10, ISF: 0 });

    const cart = await addToCart(agent, variant.id, 2);
    expect(cart.totals.subtotal).toBe(variant.price * 2);

    const context = await prepareCheckout(agent, addressId);
    const ordersBefore = await prisma.order.count();
    const stale = await placeOrder(agent, { ...context, total: context.total - 1 });
    expect(stale.status).toBe(409);
    expect((stale.body as ApiErrorBody).error.code).toBe('CART_CHANGED');
    expect(await prisma.order.count()).toBe(ordersBefore);

    const placed = ok<CheckoutResult>(await placeOrder(agent, context));
    expect(placed.amount).toBe(context.total);
    const order = ok<OrderDetail>(await agent.get(`${API}/account/orders/${placed.orderId}`));
    expect(order.status).toBe('awaiting_payment');
    expect(order.items[0]).toMatchObject({
      variantId: variant.id,
      unitPrice: variant.price,
      quantity: 2,
    });
    expect(order.canPay).toBe(true);

    // The cart is emptied once the order exists.
    expect(ok<CartView>(await agent.get(`${API}/cart`)).lines).toHaveLength(0);
  });

  it('splits a reservation across warehouses by priority and commits it once payment is verified', async () => {
    const { agent, addressId } = await newCustomer(app);
    const variant = await variantOf(agent, 'volter-vcd-18-cordless-drill');
    await setStock(admin, variant.id, { MAIN: 1, ISF: 5 });
    await addToCart(agent, variant.id, 3);

    const placed = await checkout(agent, addressId);
    let row = await inventoryOf(admin, variant.id);
    expect(levelOf(row, 'MAIN')).toEqual({ onHand: 1, reserved: 1 });
    expect(levelOf(row, 'ISF')).toEqual({ onHand: 5, reserved: 2 });

    const callback = await payOnMockBank(agent, placed.paymentUrl, 'success');
    const first = await agent.get(callback);
    expect(first.status).toBe(302);
    expect(first.headers['location']).toContain(`/checkout/result?order=${placed.orderId}`);

    row = await inventoryOf(admin, variant.id);
    expect(levelOf(row, 'MAIN')).toEqual({ onHand: 0, reserved: 0 });
    expect(levelOf(row, 'ISF')).toEqual({ onHand: 3, reserved: 0 });

    // Gateways retry callbacks: a replay must not touch stock or payments again.
    expect((await agent.get(callback)).status).toBe(302);
    expect(
      await prisma.stockMovement.count({ where: { orderId: placed.orderId, type: 'sale' } }),
    ).toBe(2);
    expect(
      await prisma.payment.count({ where: { orderId: placed.orderId, status: 'succeeded' } }),
    ).toBe(1);

    const order = ok<OrderDetail>(await agent.get(`${API}/account/orders/${placed.orderId}`));
    expect(order.status).toBe('paid');
    expect(order.history.map((h) => h.toStatus)).toEqual(['pending', 'awaiting_payment', 'paid']);
    const result = ok<PaymentResultView>(
      await agent.get(`${API}/payments/result?order=${placed.orderId}`),
    );
    expect(result.status).toBe('succeeded');
    expect(result.referenceId).toBeTruthy();
  });

  it('keeps the reservation after a failed payment and lets the customer retry', async () => {
    const { agent, addressId } = await newCustomer(app);
    const variant = await variantOf(agent, 'kaveh-kid-850-impact-drill');
    await setStock(admin, variant.id, { MAIN: 4, ISF: 0 });
    await addToCart(agent, variant.id, 1);
    const placed = await checkout(agent, addressId);

    await agent.get(await payOnMockBank(agent, placed.paymentUrl, 'failed')).expect(302);
    let order = ok<OrderDetail>(await agent.get(`${API}/account/orders/${placed.orderId}`));
    expect(order.status).toBe('awaiting_payment');
    expect(order.payments[0]?.status).toBe('failed');
    expect(levelOf(await inventoryOf(admin, variant.id), 'MAIN').reserved).toBe(1);

    const retry = ok<{ paymentUrl: string }>(
      await agent.post(`${API}/account/orders/${placed.orderId}/pay`).send({}),
    );
    await agent.get(await payOnMockBank(agent, retry.paymentUrl, 'success')).expect(302);
    order = ok<OrderDetail>(await agent.get(`${API}/account/orders/${placed.orderId}`));
    expect(order.status).toBe('paid');
    expect(levelOf(await inventoryOf(admin, variant.id), 'MAIN')).toEqual({
      onHand: 3,
      reserved: 0,
    });
  });

  it('never sells more than is in stock when customers check out at the same moment', async () => {
    const variant = await variantOf(admin, 'volter-vag-1200-angle-grinder');
    await setStock(admin, variant.id, { MAIN: 3, ISF: 0 });

    const customers = [];
    for (let i = 0; i < 8; i += 1) {
      const customer = await newCustomer(app);
      await addToCart(customer.agent, variant.id, 1);
      customers.push({
        ...customer,
        context: await prepareCheckout(customer.agent, customer.addressId),
      });
    }

    const responses = await Promise.all(
      customers.map(({ agent, context }) => placeOrder(agent, context)),
    );
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(3);
    for (const response of responses.filter((r) => r.status !== 201)) {
      expect(response.status).toBe(409);
      expect((response.body as ApiErrorBody).error.code).toBe('OUT_OF_STOCK');
    }
    expect(levelOf(await inventoryOf(admin, variant.id), 'MAIN')).toEqual({
      onHand: 3,
      reserved: 3,
    });

    // A level can no longer be set below what is reserved for open orders.
    const warehouses = ok<{ id: string; code: string }[]>(
      await admin.get(`${API}/admin/warehouses`),
    );
    const main = warehouses.find((w) => w.code === 'MAIN');
    const conflict = await admin
      .post(`${API}/admin/inventory/operations`)
      .send({ variantId: variant.id, warehouseId: main?.id, type: 'set', quantity: 2 });
    expect(conflict.status).toBe(409);
  });

  it('expires unpaid orders, honours a payment in progress and flags money that arrives too late', async () => {
    const orders = app.get(OrdersService);
    const { agent, addressId } = await newCustomer(app);
    const variant = await variantOf(agent, 'arya-pro-ap-js650-jigsaw');
    await setStock(admin, variant.id, { MAIN: 2, ISF: 0 });
    await addToCart(agent, variant.id, 2);
    const placed = await checkout(agent, addressId);

    // The reservation ran out while the customer is still on the bank page.
    const past = new Date(Date.now() - 60_000);
    await prisma.order.update({
      where: { id: placed.orderId },
      data: { reservationExpiresAt: past },
    });
    expect(await orders.expire(placed.orderId)).toBe('extended');
    expect(levelOf(await inventoryOf(admin, variant.id), 'MAIN').reserved).toBe(2);

    // The customer abandons the bank page: after the grace period the order is cancelled.
    await prisma.payment.updateMany({
      where: { orderId: placed.orderId },
      data: { createdAt: new Date(Date.now() - 3_600_000) },
    });
    await prisma.order.update({
      where: { id: placed.orderId },
      data: { reservationExpiresAt: past },
    });
    expect(await orders.expire(placed.orderId)).toBe('expired');
    expect(await orders.expire(placed.orderId)).toBe('skipped');
    expect(levelOf(await inventoryOf(admin, variant.id), 'MAIN')).toEqual({
      onHand: 2,
      reserved: 0,
    });

    // The bank page is submitted after cancellation: the payment is never verified, so
    // the PSP reverses the unverified transaction and no stock leaves the warehouse.
    await agent.get(await payOnMockBank(agent, placed.paymentUrl, 'success')).expect(302);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: placed.orderId } })).status).toBe(
      'cancelled',
    );
    expect(
      await prisma.payment.count({ where: { orderId: placed.orderId, status: 'succeeded' } }),
    ).toBe(0);
    expect(levelOf(await inventoryOf(admin, variant.id), 'MAIN')).toEqual({
      onHand: 2,
      reserved: 0,
    });
  });

  it('flags a payment verified while its order was being cancelled for refund', async () => {
    const orders = app.get(OrdersService);
    const { agent, addressId } = await newCustomer(app);
    const variant = await variantOf(agent, 'arya-pro-ap-js650-jigsaw');
    await addToCart(agent, variant.id, 1);
    const placed = await checkout(agent, addressId);
    const callback = await payOnMockBank(agent, placed.paymentUrl, 'success');

    await prisma.payment.updateMany({
      where: { orderId: placed.orderId },
      data: { createdAt: new Date(Date.now() - 3_600_000) },
    });
    await prisma.order.update({
      where: { id: placed.orderId },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });
    expect(await orders.expire(placed.orderId)).toBe('expired');
    // Race: the gateway verification was already in flight when the order expired.
    await prisma.payment.updateMany({
      where: { orderId: placed.orderId },
      data: { status: 'pending' },
    });

    await agent.get(callback).expect(302);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: placed.orderId } });
    expect(order.status).toBe('cancelled');
    expect(order.adminNote).toContain('نیازمند بازپرداخت');
    expect(
      await prisma.payment.count({ where: { orderId: placed.orderId, status: 'succeeded' } }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { action: 'payment.orphaned', entityType: 'payment' } }),
    ).toBe(1);
    expect(levelOf(await inventoryOf(admin, variant.id), 'MAIN')).toEqual({
      onHand: 2,
      reserved: 0,
    });
  });

  it('releases stock when the customer cancels an unpaid order', async () => {
    const { agent, addressId } = await newCustomer(app);
    const variant = await variantOf(agent, 'kaveh-kcs-185-circular-saw');
    await setStock(admin, variant.id, { MAIN: 1, ISF: 0 });
    await addToCart(agent, variant.id, 1);
    const placed = await checkout(agent, addressId);

    const other = await newCustomer(app);
    const refused = await other.agent
      .post(`${API}/cart/items`)
      .send({ variantId: variant.id, quantity: 1 });
    expect((refused.body as ApiErrorBody).error.code).toBe('OUT_OF_STOCK');

    const cancelled = ok<OrderDetail>(
      await agent.post(`${API}/account/orders/${placed.orderId}/cancel`).send({}),
    );
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.canPay).toBe(false);
    expect(levelOf(await inventoryOf(admin, variant.id), 'MAIN')).toEqual({
      onHand: 1,
      reserved: 0,
    });
    await addToCart(other.agent, variant.id, 1);
  });
});
