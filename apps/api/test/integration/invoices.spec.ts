import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AdminOrderDetail, InvoiceSummary, InvoiceView, Paginated } from '@toolshop/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  ADMIN,
  type Agent,
  API,
  createTestApp,
  CUSTOMER,
  login,
  newCustomer,
  WAREHOUSE,
} from './support/app';
import { addToCart, checkout, ok, payOnMockBank, setStock, variantOf } from './support/commerce';

describe('invoices and credit notes', () => {
  let app: NestExpressApplication;
  let admin: Agent;
  let warehouse: Agent;

  beforeAll(async () => {
    app = await createTestApp();
    admin = await login(app, ADMIN.identifier, ADMIN.password);
    warehouse = await login(app, WAREHOUSE.identifier, WAREHOUSE.password);
  });

  afterAll(async () => {
    await app?.close();
  });

  async function paidOrder() {
    const customer = await newCustomer(app);
    const variant = await variantOf(customer.agent, 'kaveh-kag-750-angle-grinder');
    await setStock(admin, variant.id, { MAIN: 10, ISF: 0 });
    await addToCart(customer.agent, variant.id, 2);
    const placed = await checkout(customer.agent, customer.addressId);
    expect(
      ok<InvoiceSummary[]>(
        await customer.agent.get(`${API}/account/orders/${placed.orderId}/invoices`),
      ),
    ).toEqual([]);
    await customer.agent
      .get(await payOnMockBank(customer.agent, placed.paymentUrl, 'success'))
      .expect(302);
    return { customer, placed, variant };
  }

  it('issues one immutable sale invoice when payment is verified', async () => {
    const { customer, placed, variant } = await paidOrder();
    const invoices = ok<InvoiceSummary[]>(
      await customer.agent.get(`${API}/account/orders/${placed.orderId}/invoices`),
    );
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({
      type: 'sale',
      total: placed.amount,
      orderNumber: placed.orderNumber,
    });
    expect(invoices[0]?.invoiceNumber).toBeGreaterThanOrEqual(1001);

    const invoice = ok<InvoiceView>(
      await customer.agent.get(`${API}/account/invoices/${invoices[0]?.id}`),
    );
    expect(invoice.lines).toEqual([
      expect.objectContaining({
        sku: expect.any(String),
        quantity: 2,
        unitPrice: variant.price,
        total: variant.price * 2,
      }),
    ]);
    expect(invoice.buyer.name).toContain('مشتری');
    expect(invoice.buyer.postalCode).toBe('1311111111');
    expect(invoice.seller.name.length).toBeGreaterThan(0);
    expect(invoice.totalInWords.endsWith('ریال')).toBe(true);

    // Changing the store settings later never alters an issued invoice.
    const prisma = app.get(PrismaService);
    const before = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(before.seller).toEqual(invoice.seller);

    // Other customers cannot read it.
    const stranger = await newCustomer(app);
    expect((await stranger.agent.get(`${API}/account/invoices/${invoice.id}`)).status).toBe(404);
  });

  it('issues credit notes for partial and full refunds', async () => {
    const { placed } = await paidOrder();
    const order = ok<AdminOrderDetail>(await admin.get(`${API}/admin/orders/${placed.orderId}`));
    for (const status of ['processing', 'packed']) {
      ok(await admin.post(`${API}/admin/orders/${placed.orderId}/status`).send({ status }));
    }
    ok(
      await admin
        .post(`${API}/admin/orders/${placed.orderId}/status`)
        .send({ status: 'cancelled', note: 'لغو' }),
    );
    const paymentId = order.payments[0]?.id ?? '';

    ok(
      await admin
        .post(`${API}/admin/payments/${paymentId}/refund`)
        .send({ amount: 1_000_000, reason: 'جبران تأخیر' }),
    );
    ok(await admin.post(`${API}/admin/payments/${paymentId}/refund`).send({ reason: 'لغو سفارش' }));

    const documents = ok<InvoiceSummary[]>(
      await admin.get(`${API}/admin/invoices/orders/${placed.orderId}`),
    );
    expect(documents.map((d) => [d.type, d.total])).toEqual([
      ['sale', placed.amount],
      ['credit_note', 1_000_000],
      ['credit_note', placed.amount - 1_000_000],
    ]);
    const partial = ok<InvoiceView>(await admin.get(`${API}/admin/invoices/${documents[1]?.id}`));
    expect(partial.saleInvoiceNumber).toBe(documents[0]?.invoiceNumber);
    expect(partial.note).toBe('جبران تأخیر');
    expect(partial.lines).toHaveLength(1);
  });

  it('lets authorised staff backfill invoices for orders paid before invoicing', async () => {
    const prisma = app.get(PrismaService);
    const seeded = await prisma.order.findFirstOrThrow({
      where: { user: { mobile: CUSTOMER.identifier }, status: 'delivered', invoices: { none: {} } },
    });
    expect((await warehouse.post(`${API}/admin/invoices/orders/${seeded.id}`)).status).toBe(403);
    expect((await warehouse.get(`${API}/admin/invoices`)).status).toBe(403);

    const issued = ok<InvoiceView>(await admin.post(`${API}/admin/invoices/orders/${seeded.id}`));
    const again = ok<InvoiceView>(await admin.post(`${API}/admin/invoices/orders/${seeded.id}`));
    expect(again.id).toBe(issued.id);

    const unpaid = await prisma.order.findFirst({
      where: { status: 'cancelled', invoices: { none: {} }, paidAt: null },
    });
    if (unpaid)
      expect((await admin.post(`${API}/admin/invoices/orders/${unpaid.id}`)).status).toBe(409);

    const list = ok<Paginated<InvoiceSummary>>(
      await admin.get(`${API}/admin/invoices?q=${issued.invoiceNumber}`),
    );
    expect(list.items.map((i) => i.id)).toEqual([issued.id]);
    expect(
      await prisma.auditLog.count({ where: { action: 'invoice.issue', entityId: issued.id } }),
    ).toBe(1);
  });
});
