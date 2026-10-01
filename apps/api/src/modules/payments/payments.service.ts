import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import {
  type AdminPaymentView,
  type ListQuery,
  type Paginated,
  type PaymentResultView,
  type RefundInput,
} from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { toRial } from '../../common/utils/money';
import { paginate, paginationArgs } from '../../common/utils/pagination';
import { AppConfig } from '../../config/app-config';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { toPaymentView } from '../orders/order.mapper';
import { OrdersService } from '../orders/orders.service';
import { PaymentProviderRegistry } from './payment-provider.registry';

export interface CallbackOutcome {
  result: PaymentResultView;
  redirectUrl: string;
}

const RESULT_MESSAGES = {
  succeeded: 'پرداخت با موفقیت انجام شد و سفارش شما ثبت شد.',
  failed: 'پرداخت ناموفق بود. در صورت کسر وجه، مبلغ حداکثر تا ۷۲ ساعت به حساب شما بازمی‌گردد.',
  cancelled: 'پرداخت توسط شما لغو شد.',
} as const;

/**
 * Orchestrates payment attempts: creates them at the gateway, verifies callbacks
 * (idempotently, under a row lock) and moves the order to `paid`. Gateway specifics
 * live entirely in the provider adapters.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PaymentProviderRegistry,
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly config: AppConfig,
  ) {}

  /** Starts a payment attempt for an order awaiting payment; returns the gateway URL. */
  async start(orderId: string, userId: string, providerCode?: string): Promise<{ paymentUrl: string; amount: number }> {
    const provider = this.registry.get(providerCode);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { user: { select: { mobile: true, email: true } } },
    });
    if (!order) throw AppException.notFound('سفارش یافت نشد.');
    if (order.status !== 'awaiting_payment') {
      throw new AppException('INVALID_ORDER_TRANSITION', 'این سفارش در انتظار پرداخت نیست.');
    }
    if (!order.reservationExpiresAt || order.reservationExpiresAt <= new Date()) {
      throw new AppException('INVALID_ORDER_TRANSITION', 'مهلت پرداخت این سفارش به پایان رسیده است.');
    }

    const amount = toRial(order.total);
    const payment = await this.prisma.payment.create({
      data: { orderId: order.id, provider: provider.code, amount: order.total, status: 'initiated' },
    });
    try {
      const created = await provider.createPayment({
        paymentId: payment.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount,
        callbackUrl: `${this.config.publicUrl}/api/v1/payments/callback/${provider.code}`,
        description: `پرداخت سفارش ${order.orderNumber}`,
        customer: { mobile: order.user.mobile, email: order.user.email },
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'pending', authority: created.authority, providerData: (created.raw ?? undefined) as Prisma.InputJsonValue },
      });
      return { paymentUrl: created.redirectUrl, amount };
    } catch (error) {
      this.logger.error({ err: error, paymentId: payment.id, provider: provider.code }, 'Payment creation failed');
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed', failureReason: 'خطا در اتصال به درگاه پرداخت' },
      });
      throw new AppException('PAYMENT_PROVIDER_UNAVAILABLE');
    }
  }

  /** Gateway callback (GET or POST). Always ends in a redirect to the result page. */
  async handleCallback(providerCode: string, params: Record<string, string>): Promise<CallbackOutcome> {
    if (!this.registry.has(providerCode)) throw AppException.notFound();
    const provider = this.registry.get(providerCode);
    const { authority } = provider.parseCallback(params);
    const payment = authority
      ? await this.prisma.payment.findUnique({ where: { provider_authority: { provider: providerCode, authority } } })
      : null;
    if (!payment) {
      this.logger.warn({ provider: providerCode, authority }, 'Callback for unknown payment');
      throw AppException.notFound('تراکنش یافت نشد.');
    }

    // Verify outside the transaction (network call), then apply the result under a lock.
    const verification =
      payment.status === 'pending' || payment.status === 'initiated'
        ? await provider
            .verifyPayment({ authority: payment.authority ?? '', amount: toRial(payment.amount), callbackParams: params })
            .catch((error: unknown) => {
              this.logger.error({ err: error, paymentId: payment.id }, 'Payment verification error');
              return { status: 'failed' as const, reason: 'خطا در تأیید تراکنش با درگاه' };
            })
        : null;

    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status" FROM "Payment" WHERE "id" = ${payment.id}::uuid FOR UPDATE`;
      const current = rows[0]?.status;
      if (!verification || (current !== 'pending' && current !== 'initiated')) return; // already processed

      if (verification.status === 'succeeded') {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'succeeded',
            referenceId: verification.referenceId,
            cardMask: verification.cardMask,
            verifiedAt: new Date(),
            providerData: (verification.raw ?? undefined) as Prisma.InputJsonValue,
          },
        });
        const order = await this.orders.lock(tx, payment.orderId);
        if (order.status === 'awaiting_payment') {
          await this.orders.transition(tx, order, 'paid', { type: 'system' }, { note: `پرداخت موفق – کد پیگیری ${verification.referenceId}` });
        } else {
          // Money arrived for an order that is no longer payable (e.g. expired): flag for refund.
          await tx.order.update({
            where: { id: order.id },
            data: { adminNote: `پرداخت موفق پس از لغو سفارش (کد پیگیری ${verification.referenceId}) – نیازمند بازپرداخت` },
          });
          await this.outbox.record(tx, [
            {
              type: 'payment.orphaned',
              aggregateType: 'payment',
              aggregateId: payment.id,
              payload: { paymentId: payment.id, orderId: order.id },
            },
          ]);
          await this.audit.record(
            {
              action: 'payment.orphaned',
              entityType: 'payment',
              entityId: payment.id,
              summary: `پرداخت سفارش لغوشده ${order.orderNumber} – نیازمند بازپرداخت`,
              actorType: 'system',
              actorId: null,
            },
            tx,
          );
        }
      } else {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: verification.status, failureReason: verification.reason },
        });
      }
    });
    this.outbox.flush();

    const result = await this.resultForPayment(payment.id);
    const redirect = new URL(`${this.config.publicUrl}/checkout/result`);
    redirect.searchParams.set('order', result.orderId);
    return { result, redirectUrl: redirect.toString() };
  }

  /** Outcome of the latest payment attempt, for the storefront result page. */
  async resultForOrder(orderId: string, userId: string): Promise<PaymentResultView> {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, order: { userId } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!payment) throw AppException.notFound('پرداختی برای این سفارش یافت نشد.');
    return this.resultForPayment(payment.id);
  }

  async refund(paymentId: string, input: RefundInput): Promise<AdminPaymentView> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment) throw AppException.notFound('پرداخت یافت نشد.');
    if (payment.status !== 'succeeded') throw AppException.conflict('فقط پرداخت‌های موفق قابل بازپرداخت هستند.');
    const refundable = toRial(payment.amount) - toRial(payment.refundedAmount);
    const amount = input.amount ?? refundable;
    if (amount <= 0 || amount > refundable) {
      throw AppException.validation([{ path: 'amount', message: `حداکثر مبلغ قابل بازپرداخت ${refundable} ریال است.` }]);
    }

    const provider = this.registry.get(payment.provider);
    const outcome = await provider.refundPayment({
      authority: payment.authority ?? '',
      referenceId: payment.referenceId,
      amount,
    });
    if (outcome.status !== 'succeeded') {
      throw new AppException('PAYMENT_FAILED', `بازپرداخت توسط درگاه رد شد: ${outcome.reason}`);
    }

    await this.prisma.$transaction(async (tx) => {
      const refundedAmount = payment.refundedAmount + BigInt(amount);
      const fullyRefunded = refundedAmount >= payment.amount;
      await tx.payment.update({
        where: { id: paymentId },
        data: { refundedAmount, refundedAt: new Date(), ...(fullyRefunded ? { status: 'refunded' } : {}) },
      });
      await this.audit.record(
        {
          action: 'payment.refund',
          entityType: 'payment',
          entityId: paymentId,
          summary: `بازپرداخت ${amount} ریال برای سفارش ${payment.order.orderNumber}`,
          before: { refundedAmount: payment.refundedAmount, status: payment.status },
          after: { refundedAmount, status: fullyRefunded ? 'refunded' : payment.status, reason: input.reason, reference: outcome.reference },
        },
        tx,
      );
      if (fullyRefunded) {
        const order = await this.orders.lock(tx, payment.orderId);
        if (order.status === 'cancelled' || order.status === 'returned') {
          await this.orders.transition(tx, order, 'refunded', { type: 'system' }, { note: input.reason });
        }
      }
    });
    this.outbox.flush();
    return this.adminOne(paymentId);
  }

  async adminList(query: ListQuery): Promise<Paginated<AdminPaymentView>> {
    const term = query.q?.trim();
    const orderNumber = term ? Number(term.replace(/^#/, '')) : NaN;
    const where: Prisma.PaymentWhereInput = term
      ? {
          OR: [
            { referenceId: { contains: term } },
            { authority: { contains: term } },
            ...(Number.isInteger(orderNumber) ? [{ order: { orderNumber } }] : []),
          ],
        }
      : {};
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: ADMIN_PAYMENT_INCLUDE,
        ...paginationArgs(query),
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginate(payments.map(toAdminPaymentView), total, query);
  }

  private async adminOne(id: string): Promise<AdminPaymentView> {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id }, include: ADMIN_PAYMENT_INCLUDE });
    return toAdminPaymentView(payment);
  }

  private async resultForPayment(paymentId: string): Promise<PaymentResultView> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { order: { select: { id: true, orderNumber: true, status: true } } },
    });
    const status = payment.status;
    const message =
      status === 'succeeded'
        ? payment.order.status === 'cancelled'
          ? 'پرداخت انجام شد اما مهلت سفارش به پایان رسیده بود. مبلغ به حساب شما بازگردانده می‌شود.'
          : RESULT_MESSAGES.succeeded
        : status === 'cancelled'
          ? RESULT_MESSAGES.cancelled
          : status === 'pending' || status === 'initiated'
            ? 'پرداخت در انتظار تأیید است.'
            : RESULT_MESSAGES.failed;
    return {
      status,
      orderId: payment.order.id,
      orderNumber: payment.order.orderNumber,
      amount: toRial(payment.amount),
      referenceId: payment.referenceId,
      message,
    };
  }
}

const ADMIN_PAYMENT_INCLUDE = {
  order: { select: { id: true, orderNumber: true, user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.PaymentInclude;

function toAdminPaymentView(payment: Prisma.PaymentGetPayload<{ include: typeof ADMIN_PAYMENT_INCLUDE }>): AdminPaymentView {
  return {
    ...toPaymentView(payment),
    order: { id: payment.order.id, orderNumber: payment.order.orderNumber },
    customerName: `${payment.order.user.firstName} ${payment.order.user.lastName}`,
  };
}
