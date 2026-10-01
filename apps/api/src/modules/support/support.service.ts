import { Injectable } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import {
  type AdminTicketDetail,
  type AdminTicketListQuery,
  type AdminTicketSummary,
  hasPermission,
  type Paginated,
  type PaginationQuery,
  type StaffOption,
  type StaffTicketReplyInput,
  SUPER_ADMIN_ROLE,
  TICKET_STATUS_LABELS,
  type TicketCreateInput,
  type TicketDetail,
  type TicketReplyInput,
  type TicketSummary,
  type TicketUpdateInput,
  toEnglishDigits,
} from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { paginate, paginationArgs } from '../../common/utils/pagination';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { toOrderSummary } from '../orders/order.mapper';
import {
  TICKET_LIST_INCLUDE,
  TICKET_MESSAGES_INCLUDE,
  toAdminTicketSummary,
  toMessageView,
  toTicketSummary,
} from './ticket.mapper';

const MAX_NEW_TICKETS_PER_HOUR = 5;
/** Staff allowed to answer tickets (super admins hold every permission implicitly). */
const CAN_ANSWER: Prisma.UserWhereInput = {
  type: 'staff',
  isActive: true,
  roles: {
    some: {
      role: {
        OR: [
          { key: SUPER_ADMIN_ROLE },
          { permissions: { some: { permissionKey: 'ticket.reply' } } },
        ],
      },
    },
  },
};
const MAX_OPEN_TICKETS = 10;

const DETAIL_INCLUDE = {
  ...TICKET_LIST_INCLUDE,
  ...TICKET_MESSAGES_INCLUDE,
} satisfies Prisma.TicketInclude;

/**
 * Customer support tickets. A ticket is a conversation between one customer and the
 * support team, optionally about one of the customer's orders. Status tracks whose
 * turn it is (`open` = staff, `answered` = customer); internal notes never leave the
 * admin panel. Events are written to the outbox so notification channels (SMS,
 * e-mail, Eitaa/Bale bots) can be plugged in later without touching this service.
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /* ------------------------------------------------------------ customer */

  async listForCustomer(userId: string, query: PaginationQuery): Promise<Paginated<TicketSummary>> {
    const where: Prisma.TicketWhereInput = { userId };
    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: TICKET_LIST_INCLUDE,
        orderBy: { lastMessageAt: 'desc' },
        ...paginationArgs(query),
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return paginate(tickets.map(toTicketSummary), total, query);
  }

  async unreadCountForCustomer(userId: string): Promise<number> {
    return this.prisma.ticket.count({ where: { userId, customerUnread: true } });
  }

  async create(userId: string, input: TicketCreateInput): Promise<TicketDetail> {
    const [recent, open] = await Promise.all([
      this.prisma.ticket.count({
        where: { userId, createdAt: { gt: new Date(Date.now() - 3_600_000) } },
      }),
      this.prisma.ticket.count({ where: { userId, status: { not: 'closed' } } }),
    ]);
    if (recent >= MAX_NEW_TICKETS_PER_HOUR) {
      throw new AppException('RATE_LIMITED', 'تعداد تیکت‌های ثبت‌شده در یک ساعت گذشته زیاد است.');
    }
    if (open >= MAX_OPEN_TICKETS) {
      throw AppException.conflict('تیکت‌های باز زیادی دارید؛ لطفاً در همان تیکت‌ها پیگیری کنید.');
    }
    if (input.orderId) {
      const owns = await this.prisma.order.count({ where: { id: input.orderId, userId } });
      if (!owns)
        throw AppException.validation([{ path: 'orderId', message: 'سفارش انتخاب‌شده یافت نشد.' }]);
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          userId,
          orderId: input.orderId,
          subject: input.subject,
          category: input.category,
          // Payment problems are time sensitive: start them with a higher priority.
          priority: input.category === 'payment' ? 'high' : 'normal',
          status: 'open',
          staffUnread: true,
          messages: { create: { authorId: userId, authorType: 'customer', body: input.body } },
        },
      });
      await this.outbox.record(tx, [
        {
          type: 'ticket.created',
          aggregateType: 'ticket',
          aggregateId: created.id,
          payload: { ticketId: created.id },
        },
      ]);
      return created;
    });
    this.outbox.flush();
    return this.getForCustomer(ticket.id, userId);
  }

  async getForCustomer(id: string, userId: string): Promise<TicketDetail> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, userId },
      include: DETAIL_INCLUDE,
    });
    if (!ticket) throw AppException.notFound('تیکت یافت نشد.');
    if (ticket.customerUnread) {
      await this.prisma.ticket.update({ where: { id }, data: { customerUnread: false } });
    }
    return {
      ...toTicketSummary(ticket),
      unread: false,
      orderId: ticket.orderId,
      messages: ticket.messages
        .filter((m) => !m.isInternal)
        .map((m) => toMessageView(m, 'customer')),
      canReply: ticket.status !== 'closed',
    };
  }

  async replyAsCustomer(
    id: string,
    userId: string,
    input: TicketReplyInput,
  ): Promise<TicketDetail> {
    await this.prisma.$transaction(async (tx) => {
      const ticket = await this.lock(tx, id);
      if (ticket.userId !== userId) throw AppException.notFound('تیکت یافت نشد.');
      if (ticket.status === 'closed') {
        throw AppException.conflict('این تیکت بسته شده است؛ برای پیگیری تیکت جدید ثبت کنید.');
      }
      const now = new Date();
      await tx.ticketMessage.create({
        data: {
          ticketId: id,
          authorId: userId,
          authorType: 'customer',
          body: input.body,
          createdAt: now,
        },
      });
      await tx.ticket.update({
        where: { id },
        data: { status: 'open', staffUnread: true, customerUnread: false, lastMessageAt: now },
      });
      await this.outbox.record(tx, [
        {
          type: 'ticket.replied',
          aggregateType: 'ticket',
          aggregateId: id,
          payload: { ticketId: id, by: 'customer' },
        },
      ]);
    });
    this.outbox.flush();
    return this.getForCustomer(id, userId);
  }

  async closeByCustomer(id: string, userId: string): Promise<TicketDetail> {
    await this.prisma.$transaction(async (tx) => {
      const ticket = await this.lock(tx, id);
      if (ticket.userId !== userId) throw AppException.notFound('تیکت یافت نشد.');
      if (ticket.status === 'closed') return;
      await this.setStatus(tx, id, 'closed', 'تیکت توسط مشتری بسته شد.');
    });
    return this.getForCustomer(id, userId);
  }

  /* --------------------------------------------------------------- staff */

  async listForAdmin(
    query: AdminTicketListQuery,
    actor: AuthContext,
  ): Promise<Paginated<AdminTicketSummary>> {
    const where: Prisma.TicketWhereInput = {
      status: query.status,
      priority: query.priority,
      category: query.category,
      staffUnread: query.unread,
    };
    if (query.assignee === 'me') where.assigneeId = actor.userId;
    else if (query.assignee === 'none') where.assigneeId = null;
    else if (query.assignee) where.assigneeId = query.assignee;

    const q = query.q?.trim();
    if (q) {
      const digits = toEnglishDigits(q).replace(/^#/, '');
      where.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { user: { mobile: { contains: digits } } },
        { user: { lastName: { contains: q, mode: 'insensitive' } } },
        ...(/^\d{1,9}$/.test(digits)
          ? [{ ticketNumber: Number(digits) }, { order: { orderNumber: Number(digits) } }]
          : []),
      ];
    }

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: TICKET_LIST_INCLUDE,
        // Waiting on staff first, then urgency, then oldest activity first (fair queue).
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { lastMessageAt: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return paginate(tickets.map(toAdminTicketSummary), total, query);
  }

  async adminCounters(
    actor: AuthContext,
  ): Promise<{ open: number; unread: number; mine: number; unassigned: number }> {
    const notClosed = { status: { not: 'closed' as const } };
    const [open, unread, mine, unassigned] = await Promise.all([
      this.prisma.ticket.count({ where: { status: 'open' } }),
      this.prisma.ticket.count({ where: { ...notClosed, staffUnread: true } }),
      this.prisma.ticket.count({ where: { ...notClosed, assigneeId: actor.userId } }),
      this.prisma.ticket.count({ where: { ...notClosed, assigneeId: null } }),
    ]);
    return { open, unread, mine, unassigned };
  }

  async getForAdmin(id: string): Promise<AdminTicketDetail> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!ticket) throw AppException.notFound('تیکت یافت نشد.');
    if (ticket.staffUnread) {
      await this.prisma.ticket.update({ where: { id }, data: { staffUnread: false } });
    }
    const recentOrders = await this.prisma.order.findMany({
      where: { userId: ticket.userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { items: { select: { quantity: true } } },
    });
    return {
      ...toAdminTicketSummary(ticket),
      unread: false,
      orderId: ticket.orderId,
      ai: ticket.aiSummary ? { summary: ticket.aiSummary, sentiment: ticket.aiSentiment } : null,
      customerEmail: ticket.user.email,
      messages: ticket.messages.map((m) => toMessageView(m, 'staff')),
      recentOrders: recentOrders.map(toOrderSummary),
    };
  }

  async replyAsStaff(
    id: string,
    input: StaffTicketReplyInput,
    actor: AuthContext,
  ): Promise<AdminTicketDetail> {
    if (input.close && !hasPermission(actor.permissions, 'ticket.manage')) {
      throw AppException.forbidden('شما مجوز بستن تیکت را ندارید.');
    }
    await this.prisma.$transaction(async (tx) => {
      const ticket = await this.lock(tx, id);
      const now = new Date();
      await tx.ticketMessage.create({
        data: {
          ticketId: id,
          authorId: actor.userId,
          authorType: 'staff',
          body: input.body,
          isInternal: input.internal,
          createdAt: now,
        },
      });
      if (input.internal) {
        if (input.close) await this.setStatus(tx, id, 'closed', 'تیکت توسط پشتیبانی بسته شد.');
        return;
      }
      await tx.ticket.update({
        where: { id },
        data: {
          status: 'answered',
          closedAt: null,
          customerUnread: true,
          staffUnread: false,
          lastMessageAt: now,
          // Whoever answers an unassigned ticket owns it from now on.
          assigneeId: ticket.assigneeId ?? actor.userId,
        },
      });
      if (input.close) await this.setStatus(tx, id, 'closed', 'تیکت توسط پشتیبانی بسته شد.');
      await this.outbox.record(tx, [
        {
          type: 'ticket.replied',
          aggregateType: 'ticket',
          aggregateId: id,
          payload: { ticketId: id, by: 'staff' },
        },
      ]);
    });
    this.outbox.flush();
    return this.getForAdmin(id);
  }

  async update(id: string, input: TicketUpdateInput): Promise<AdminTicketDetail> {
    await this.prisma.$transaction(async (tx) => {
      const ticket = await this.lock(tx, id);
      if (input.assigneeId) await this.assertAssignable(tx, input.assigneeId);

      const data: Prisma.TicketUncheckedUpdateInput = {};
      if (input.priority) data.priority = input.priority;
      if (input.category) data.category = input.category;
      if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId;
      if (Object.keys(data).length > 0) await tx.ticket.update({ where: { id }, data });
      if (input.status && input.status !== ticket.status) {
        await this.setStatus(
          tx,
          id,
          input.status,
          input.status === 'closed' ? 'تیکت توسط پشتیبانی بسته شد.' : 'تیکت دوباره باز شد.',
        );
      }
      await this.audit.record(
        {
          action: 'ticket.update',
          entityType: 'ticket',
          entityId: id,
          summary: `تیکت ${ticket.ticketNumber}`,
          before: {
            status: ticket.status,
            priority: ticket.priority,
            category: ticket.category,
            assigneeId: ticket.assigneeId,
          },
          after: {
            status: input.status ?? ticket.status,
            priority: input.priority ?? ticket.priority,
            category: input.category ?? ticket.category,
            assigneeId: input.assigneeId !== undefined ? input.assigneeId : ticket.assigneeId,
          },
        },
        tx,
      );
    });
    return this.getForAdmin(id);
  }

  /** Active staff who can answer tickets (for the assignee picker). */
  async staffOptions(): Promise<StaffOption[]> {
    const users = await this.prisma.user.findMany({
      where: CAN_ANSWER,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
    });
    return users.map((u) => ({ id: u.id, fullName: `${u.firstName} ${u.lastName}`.trim() }));
  }

  /* ------------------------------------------------------------- helpers */

  private async lock(tx: Tx, id: string) {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "Ticket" WHERE "id" = ${id}::uuid FOR UPDATE`;
    if (rows.length === 0) throw AppException.notFound('تیکت یافت نشد.');
    return tx.ticket.findUniqueOrThrow({ where: { id } });
  }

  private async setStatus(
    tx: Tx,
    id: string,
    status: 'open' | 'answered' | 'closed',
    note: string,
  ): Promise<void> {
    const now = new Date();
    await tx.ticket.update({
      where: { id },
      data: {
        status,
        closedAt: status === 'closed' ? now : null,
        ...(status === 'closed' ? { staffUnread: false } : {}),
      },
    });
    await tx.ticketMessage.create({
      data: {
        ticketId: id,
        authorType: 'system',
        body: `${note} (وضعیت: ${TICKET_STATUS_LABELS[status]})`,
        createdAt: now,
      },
    });
  }

  private async assertAssignable(tx: Tx, userId: string): Promise<void> {
    const staff = await tx.user.count({
      where: { id: userId, ...CAN_ANSWER },
    });
    if (!staff) {
      throw AppException.validation([
        { path: 'assigneeId', message: 'کارشناس انتخاب‌شده مجاز به پاسخ‌گویی نیست.' },
      ]);
    }
  }
}
