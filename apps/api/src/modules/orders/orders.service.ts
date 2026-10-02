import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Order, Prisma } from '@toolshop/database';
import {
  type AdminOrderDetail,
  type AdminOrderListQuery,
  type AdminOrderSummary,
  assertOrderTransition,
  CUSTOMER_CANCELLABLE_STATUSES,
  InvalidOrderTransitionError,
  type OrderDetail,
  type OrderStatus,
  type OrderStatusUpdateInput,
  type OrderSummary,
  type Paginated,
  type PaginationQuery,
  STOCK_COMMITTED_STATUSES,
  hasPermission,
} from '@toolshop/shared';
import type { Queue } from 'bullmq';
import { dayRange, rialRange } from '../../common/utils/filters';
import { AppException } from '../../common/errors/app-exception';
import { paginate, paginationArgs } from '../../common/utils/pagination';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { QUEUES } from '../../infrastructure/queue/queue.constants';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { CouponsService } from '../coupons/coupons.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  ADMIN_ORDER_INCLUDE,
  ORDER_DETAIL_INCLUDE,
  toAdminOrderDetail,
  toAdminOrderSummary,
  toOrderDetail,
  toOrderSummary,
} from './order.mapper';
import { InvoicesService } from '../invoices/invoices.service';

export interface OrderActor {
  type: 'customer' | 'staff' | 'system';
  id?: string | null;
}

export const ORDER_JOBS = {
  EXPIRE: 'expire-order',
  SWEEP: 'sweep-expired-orders',
} as const;

/** A payment started this recently keeps the order alive (the customer is at the bank). */
const PAYMENT_GRACE_MS = 15 * 60_000;

/**
 * Owns the order state machine. Every transition goes through `transition()`, which
 * validates it against ORDER_TRANSITIONS, applies inventory/coupon side effects in the
 * same transaction, records history and emits an outbox event.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly coupons: CouponsService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly invoices: InvoicesService,
    @InjectQueue(QUEUES.ORDERS) private readonly queue: Queue,
  ) {}

  /** Locks the order row for the rest of the transaction. */
  async lock(tx: Tx, orderId: string): Promise<Order> {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE`;
    if (rows.length === 0) throw AppException.notFound('سفارش یافت نشد.');
    return tx.order.findUniqueOrThrow({ where: { id: orderId } });
  }

  async transition(
    tx: Tx,
    order: Order,
    to: OrderStatus,
    actor: OrderActor,
    options: { note?: string | null; trackingCode?: string | null } = {},
  ): Promise<Order> {
    try {
      assertOrderTransition(order.status, to);
    } catch (error) {
      if (error instanceof InvalidOrderTransitionError)
        throw new AppException('INVALID_ORDER_TRANSITION');
      throw error;
    }
    const reference = `ORDER-${order.orderNumber}`;
    const data: Prisma.OrderUpdateInput = { status: to };

    switch (to) {
      case 'paid':
        await this.inventory.commitReservations(tx, order.id, reference);
        data.paidAt = new Date();
        await this.incrementSoldCounts(tx, order.id);
        await this.invoices.issueSaleInvoice(tx, order.id);
        break;
      case 'cancelled':
        if (STOCK_COMMITTED_STATUSES.includes(order.status)) {
          await this.inventory.restockOrder(tx, order.id, 'cancellation', reference);
        } else {
          await this.inventory.releaseReservations(
            tx,
            order.id,
            actor.type === 'system' ? 'expired' : 'released',
          );
          await this.coupons.releaseForOrder(tx, order.id);
          await tx.payment.updateMany({
            where: { orderId: order.id, status: { in: ['initiated', 'pending'] } },
            data: { status: 'cancelled', failureReason: 'سفارش لغو شد.' },
          });
        }
        data.cancelledAt = new Date();
        data.cancelReason = options.note ?? null;
        data.reservationExpiresAt = null;
        break;
      case 'shipped':
        data.shippedAt = new Date();
        if (options.trackingCode) data.trackingCode = options.trackingCode;
        break;
      case 'delivered':
        data.deliveredAt = new Date();
        break;
      case 'returned':
        await this.inventory.restockOrder(tx, order.id, 'return', reference);
        break;
      default:
        break;
    }

    const updated = await tx.order.update({ where: { id: order.id }, data });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: to,
        note: options.note ?? null,
        actorType: actor.type,
        actorId: actor.id ?? null,
      },
    });
    await this.outbox.record(tx, [
      {
        type: 'order.status_changed',
        aggregateType: 'order',
        aggregateId: order.id,
        payload: { orderId: order.id, from: order.status, to },
      },
      ...(to === 'paid'
        ? [
            {
              type: 'order.paid' as const,
              aggregateType: 'order',
              aggregateId: order.id,
              payload: { orderId: order.id },
            },
          ]
        : []),
    ]);
    return updated;
  }

  async scheduleExpiry(orderId: string, expiresAt: Date): Promise<void> {
    const delay = Math.max(0, expiresAt.getTime() - Date.now()) + 1_000;
    await this.queue
      .add(
        ORDER_JOBS.EXPIRE,
        { orderId },
        { jobId: `expire-${orderId}-${expiresAt.getTime()}`, delay },
      )
      .catch((error: unknown) =>
        this.logger.warn(
          { err: error, orderId },
          'Could not schedule order expiry (sweeper will handle it)',
        ),
      );
  }

  /**
   * Cancels an unpaid order whose reservation ran out, returning the stock. If the
   * customer started a payment moments ago the order gets a short grace period.
   */
  async expire(orderId: string): Promise<'expired' | 'skipped' | 'extended'> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const order = await this.lock(tx, orderId);
      if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) return 'skipped' as const;
      if (!order.reservationExpiresAt || order.reservationExpiresAt > new Date())
        return 'skipped' as const;
      const recentPayment = await tx.payment.findFirst({
        where: {
          orderId,
          status: 'pending',
          createdAt: { gt: new Date(Date.now() - PAYMENT_GRACE_MS) },
        },
      });
      if (recentPayment) {
        const extended = new Date(recentPayment.createdAt.getTime() + PAYMENT_GRACE_MS);
        await tx.order.update({ where: { id: orderId }, data: { reservationExpiresAt: extended } });
        await tx.stockReservation.updateMany({
          where: { orderId, status: 'active' },
          data: { expiresAt: extended },
        });
        return 'extended' as const;
      }
      await this.transition(
        tx,
        order,
        'cancelled',
        { type: 'system' },
        { note: 'لغو خودکار به دلیل عدم پرداخت در مهلت مقرر' },
      );
      return 'expired' as const;
    });
    if (outcome === 'extended') {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { reservationExpiresAt: true },
      });
      if (order?.reservationExpiresAt)
        await this.scheduleExpiry(orderId, order.reservationExpiresAt);
    }
    if (outcome !== 'skipped') this.outbox.flush();
    return outcome;
  }

  /** Safety net for lost delayed jobs. */
  async sweepExpired(): Promise<number> {
    const overdue = await this.prisma.order.findMany({
      where: {
        status: { in: ['pending', 'awaiting_payment'] },
        reservationExpiresAt: { lte: new Date() },
      },
      select: { id: true },
      take: 200,
    });
    let expired = 0;
    for (const { id } of overdue) {
      if ((await this.expire(id)) === 'expired') expired += 1;
    }
    return expired;
  }

  async cancelByCustomer(
    orderId: string,
    userId: string,
    reason: string | null,
  ): Promise<OrderDetail> {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lock(tx, orderId);
      if (order.userId !== userId) throw AppException.notFound('سفارش یافت نشد.');
      if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
        throw new AppException(
          'INVALID_ORDER_TRANSITION',
          'این سفارش دیگر توسط شما قابل لغو نیست. با پشتیبانی تماس بگیرید.',
        );
      }
      await this.transition(
        tx,
        order,
        'cancelled',
        { type: 'customer', id: userId },
        { note: reason ?? 'لغو توسط مشتری' },
      );
    });
    this.outbox.flush();
    return this.getForCustomer(orderId, userId);
  }

  async updateByStaff(
    orderId: string,
    input: OrderStatusUpdateInput,
    actor: AuthContext,
  ): Promise<AdminOrderDetail> {
    if (input.status === 'refunded') {
      throw new AppException(
        'INVALID_ORDER_TRANSITION',
        'بازپرداخت فقط از بخش پرداخت‌ها و با ثبت تراکنش برگشت انجام می‌شود.',
      );
    }
    if (input.status === 'cancelled' && !hasPermission(actor.permissions, 'order.cancel')) {
      throw AppException.forbidden('شما مجوز لغو سفارش را ندارید.');
    }
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lock(tx, orderId);
      if (input.status === 'shipped' && !input.trackingCode && !order.trackingCode) {
        throw AppException.validation([
          { path: 'trackingCode', message: 'کد رهگیری مرسوله را وارد کنید.' },
        ]);
      }
      const updated = await this.transition(
        tx,
        order,
        input.status,
        { type: 'staff', id: actor.userId },
        input,
      );
      await this.audit.record(
        {
          action: input.status === 'cancelled' ? 'order.cancel' : 'order.status',
          entityType: 'order',
          entityId: orderId,
          summary: `سفارش ${order.orderNumber}: ${order.status} → ${updated.status}`,
          before: { status: order.status },
          after: {
            status: updated.status,
            note: input.note ?? null,
            trackingCode: updated.trackingCode,
          },
        },
        tx,
      );
    });
    this.outbox.flush();
    return this.getForAdmin(orderId);
  }

  async updateAdminNote(orderId: string, note: string | null): Promise<AdminOrderDetail> {
    await this.prisma.order.update({ where: { id: orderId }, data: { adminNote: note } });
    return this.getForAdmin(orderId);
  }

  async listForCustomer(userId: string, query: PaginationQuery): Promise<Paginated<OrderSummary>> {
    const where: Prisma.OrderWhereInput = { userId };
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { items: { select: { quantity: true } } },
        ...paginationArgs(query),
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(orders.map(toOrderSummary), total, query);
  }

  async getForCustomer(orderId: string, userId: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!order) throw AppException.notFound('سفارش یافت نشد.');
    return toOrderDetail(order);
  }

  async listForAdmin(query: AdminOrderListQuery): Promise<Paginated<AdminOrderSummary>> {
    const where: Prisma.OrderWhereInput = {
      status: query.status,
      userId: query.customerId,
      shippingMethodId: query.shippingMethodId,
      createdAt: dayRange(query),
      total: rialRange(query.minTotal, query.maxTotal),
    };
    if (query.q) {
      const term = query.q.trim();
      const number = Number(term.replace(/^#/, ''));
      where.OR = [
        ...(Number.isInteger(number) && number > 0 ? [{ orderNumber: number }] : []),
        { user: { mobile: { contains: term } } },
        { user: { lastName: { contains: term, mode: 'insensitive' } } },
        { user: { firstName: { contains: term, mode: 'insensitive' } } },
        { trackingCode: { contains: term } },
      ];
    }
    const orderBy: Prisma.OrderOrderByWithRelationInput =
      query.sort === 'oldest'
        ? { createdAt: 'asc' }
        : query.sort === 'total_desc'
          ? { total: 'desc' }
          : query.sort === 'total_asc'
            ? { total: 'asc' }
            : { createdAt: 'desc' };
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy,
        include: {
          items: { select: { quantity: true } },
          user: { select: { id: true, firstName: true, lastName: true, mobile: true } },
        },
        ...paginationArgs(query),
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(orders.map(toAdminOrderSummary), total, query);
  }

  async getForAdmin(orderId: string): Promise<AdminOrderDetail> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ADMIN_ORDER_INCLUDE,
    });
    if (!order) throw AppException.notFound('سفارش یافت نشد.');
    return toAdminOrderDetail(order);
  }

  private async incrementSoldCounts(tx: Tx, orderId: string): Promise<void> {
    const items = await tx.orderItem.groupBy({
      by: ['productId'],
      where: { orderId, productId: { not: null } },
      _sum: { quantity: true },
    });
    for (const item of items) {
      if (!item.productId) continue;
      await tx.product.update({
        where: { id: item.productId },
        data: { soldCount: { increment: item._sum.quantity ?? 0 } },
      });
    }
  }
}
