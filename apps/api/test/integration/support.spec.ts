import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
  AdminTicketDetail,
  AdminTicketSummary,
  ApiErrorBody,
  Paginated,
  StaffOption,
  TicketDetail,
} from '@toolshop/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  ADMIN,
  type Agent,
  API,
  createTestApp,
  login,
  newCustomer,
  SUPPORT,
  WAREHOUSE,
} from './support/app';
import { addToCart, checkout, ok, setStock, variantOf } from './support/commerce';

const errorCode = (body: unknown) => (body as ApiErrorBody).error.code;

describe('support tickets', () => {
  let app: NestExpressApplication;
  let admin: Agent;
  let support: Agent;
  let sales: Agent;
  let warehouse: Agent;

  beforeAll(async () => {
    app = await createTestApp();
    [admin, support, sales, warehouse] = await Promise.all([
      login(app, ADMIN.identifier, ADMIN.password),
      login(app, SUPPORT.identifier, SUPPORT.password),
      login(app, 'sales@example.com', 'Staff@12345'),
      login(app, WAREHOUSE.identifier, WAREHOUSE.password),
    ]);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('runs a conversation between a customer and support with private internal notes', async () => {
    const customer = await newCustomer(app);
    const variant = await variantOf(customer.agent, 'toolino-taw-adjustable-wrench');
    await setStock(admin, variant.id, { MAIN: 5 });
    await addToCart(customer.agent, variant.id, 1);
    const order = await checkout(customer.agent, customer.addressId);

    const created = ok<TicketDetail>(
      await customer.agent.post(`${API}/account/tickets`).send({
        subject: 'سوال درباره سفارش',
        category: 'order',
        orderId: order.orderId,
        body: 'لطفاً زمان ارسال سفارش را اعلام کنید.',
      }),
    );
    expect(created.ticketNumber).toBeGreaterThanOrEqual(10001);
    expect(created.status).toBe('open');
    expect(created.orderNumber).toBe(order.orderNumber);

    // Staff inbox shows it as unread; opening it marks it read.
    const inbox = ok<Paginated<AdminTicketSummary>>(
      await support.get(`${API}/admin/tickets?unread=true&q=${created.ticketNumber}`),
    );
    expect(inbox.items.map((t) => t.id)).toEqual([created.id]);
    expect(
      ok<AdminTicketDetail>(await support.get(`${API}/admin/tickets/${created.id}`)).recentOrders[0]
        ?.id,
    ).toBe(order.orderId);

    ok(
      await support
        .post(`${API}/admin/tickets/${created.id}/messages`)
        .send({ body: 'یادداشت داخلی: با انبار هماهنگ شد.', internal: true }),
    );
    const answered = ok<AdminTicketDetail>(
      await support
        .post(`${API}/admin/tickets/${created.id}/messages`)
        .send({ body: 'سفارش شما فردا ارسال می‌شود.' }),
    );
    expect(answered.status).toBe('answered');
    expect(answered.assignee?.fullName).toContain('پشتیبانی');

    const seen = ok<TicketDetail>(await customer.agent.get(`${API}/account/tickets/${created.id}`));
    expect(seen.messages.map((m) => m.authorType)).toEqual(['customer', 'staff']);
    expect(seen.messages.some((m) => m.body.includes('یادداشت داخلی'))).toBe(false);
    expect(seen.messages[1]?.authorName).toBe('پشتیبانی (کارشناس)');
    expect(
      ok<{ count: number }>(await customer.agent.get(`${API}/account/tickets/unread-count`)).count,
    ).toBe(0);

    const followUp = ok<TicketDetail>(
      await customer.agent
        .post(`${API}/account/tickets/${created.id}/messages`)
        .send({ body: 'ممنون، منتظرم.' }),
    );
    expect(followUp.status).toBe('open');

    const closed = ok<TicketDetail>(
      await customer.agent.post(`${API}/account/tickets/${created.id}/close`),
    );
    expect(closed.status).toBe('closed');
    expect(closed.canReply).toBe(false);
    const late = await customer.agent
      .post(`${API}/account/tickets/${created.id}/messages`)
      .send({ body: 'یک سوال دیگر' });
    expect(late.status).toBe(409);
  });

  it('keeps tickets private to their owner and validates the linked order', async () => {
    const owner = await newCustomer(app);
    const other = await newCustomer(app);
    const ticket = ok<TicketDetail>(
      await owner.agent
        .post(`${API}/account/tickets`)
        .send({ subject: 'سوال فنی', category: 'product', body: 'این دستگاه گارانتی دارد؟' }),
    );
    expect((await other.agent.get(`${API}/account/tickets/${ticket.id}`)).status).toBe(404);
    expect(
      (
        await other.agent
          .post(`${API}/account/tickets/${ticket.id}/messages`)
          .send({ body: 'سلام سلام' })
      ).status,
    ).toBe(404);

    const variant = await variantOf(owner.agent, 'toolino-taw-adjustable-wrench');
    await setStock(admin, variant.id, { MAIN: 5 });
    await addToCart(owner.agent, variant.id, 1);
    const order = await checkout(owner.agent, owner.addressId);
    const foreign = await other.agent.post(`${API}/account/tickets`).send({
      subject: 'سفارش دیگری',
      category: 'order',
      orderId: order.orderId,
      body: 'سفارش من کجاست؟',
    });
    expect(foreign.status).toBe(400);
    expect((foreign.body as ApiErrorBody).error.details?.[0]?.path).toBe('orderId');
  });

  it('limits how many tickets a customer can open in an hour', async () => {
    const customer = await newCustomer(app);
    for (let i = 0; i < 5; i += 1) {
      ok(
        await customer.agent
          .post(`${API}/account/tickets`)
          .send({ subject: `درخواست ${i + 1}`, category: 'other', body: 'متن درخواست آزمایشی' }),
      );
    }
    const sixth = await customer.agent
      .post(`${API}/account/tickets`)
      .send({ subject: 'درخواست ششم', category: 'other', body: 'متن درخواست آزمایشی' });
    expect(sixth.status).toBe(429);
  });

  it('enforces ticket permissions per role and audits management changes', async () => {
    const customer = await newCustomer(app);
    const ticket = ok<TicketDetail>(
      await customer.agent.post(`${API}/account/tickets`).send({
        subject: 'مشکل پرداخت',
        category: 'payment',
        body: 'مبلغ کسر شد ولی سفارش ثبت نشد.',
      }),
    );
    const detail = ok<AdminTicketDetail>(await admin.get(`${API}/admin/tickets/${ticket.id}`));
    expect(detail.priority).toBe('high');

    expect((await warehouse.get(`${API}/admin/tickets`)).status).toBe(403);
    expect((await customer.agent.get(`${API}/admin/tickets`)).status).toBe(403);

    // Sales may answer but not manage.
    ok(
      await sales
        .post(`${API}/admin/tickets/${ticket.id}/messages`)
        .send({ body: 'در حال بررسی هستیم.' }),
    );
    expect(
      (
        await sales
          .post(`${API}/admin/tickets/${ticket.id}/messages`)
          .send({ body: 'بسته شد', close: true })
      ).status,
    ).toBe(403);
    expect(
      (await sales.put(`${API}/admin/tickets/${ticket.id}`).send({ priority: 'urgent' })).status,
    ).toBe(403);

    const staff = ok<StaffOption[]>(await support.get(`${API}/admin/tickets/staff`));
    const supportUser = staff.find((s) => s.fullName.includes('پشتیبانی'));
    expect(staff.some((s) => s.fullName.includes('انبار'))).toBe(false);

    const notStaff = await support
      .put(`${API}/admin/tickets/${ticket.id}`)
      .send({ assigneeId: detail.customer.id });
    expect(notStaff.status).toBe(400);
    expect(errorCode(notStaff.body)).toBe('VALIDATION_FAILED');

    const updated = ok<AdminTicketDetail>(
      await support
        .put(`${API}/admin/tickets/${ticket.id}`)
        .send({ priority: 'urgent', assigneeId: supportUser?.id, status: 'closed' }),
    );
    expect(updated.status).toBe('closed');
    expect(updated.assignee?.id).toBe(supportUser?.id);
    expect(updated.messages.at(-1)?.authorType).toBe('system');

    const audit = await app
      .get(PrismaService)
      .auditLog.findFirst({ where: { action: 'ticket.update', entityId: ticket.id } });
    expect(audit?.before).toMatchObject({ priority: 'high', status: 'answered' });
    expect(audit?.after).toMatchObject({ priority: 'urgent', status: 'closed' });
  });
});
