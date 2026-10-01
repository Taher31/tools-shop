import { Injectable } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import {
  type CartTotals,
  type CheckoutInput,
  type CheckoutPreview,
  type CheckoutResult,
} from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { AppConfig } from '../../config/app-config';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { toAddressView } from '../account/address.mapper';
import type { ClientInfo } from '../auth/session.service';
import { CartService } from '../cart/cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentProviderRegistry } from '../payments/payment-provider.registry';
import { PaymentsService } from '../payments/payments.service';
import { serves, shippingRule, ShippingService } from '../shipping/shipping.service';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carts: CartService,
    private readonly shipping: ShippingService,
    private readonly inventory: InventoryService,
    private readonly coupons: CouponsService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly providers: PaymentProviderRegistry,
    private readonly outbox: OutboxService,
    private readonly config: AppConfig,
  ) {}

  async preview(userId: string, addressId?: string): Promise<CheckoutPreview> {
    const cart = await this.carts.find({ userId });
    if (!cart || cart.items.length === 0) throw new AppException('CART_EMPTY');
    const addresses = await this.prisma.address.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    const selected = addresses.find((a) => a.id === addressId) ?? addresses[0];
    const priced = await this.carts.price(cart, userId);
    const merchandise = priced.pricing.subtotal - priced.pricing.couponDiscount;
    return {
      cart: priced.view,
      shippingOptions: await this.shipping.optionsFor(selected?.province ?? null, merchandise),
      addresses: addresses.map(toAddressView),
      paymentProviders: this.providers.available(),
    };
  }

  /** Final totals for a chosen address and shipping method (shown before paying). */
  async quote(userId: string, addressId: string, shippingMethodId: string): Promise<CartTotals> {
    const cart = await this.carts.find({ userId });
    if (!cart || cart.items.length === 0) throw new AppException('CART_EMPTY');
    const { method } = await this.resolveDelivery(userId, addressId, shippingMethodId);
    const priced = await this.carts.price(cart, userId, { shipping: shippingRule(method) });
    return priced.view.totals;
  }

  /**
   * Creates the order: re-prices the cart on the server, reserves stock (row locks make
   * overselling impossible), redeems the coupon and empties the cart – all in one
   * transaction – then opens a payment at the gateway.
   */
  async placeOrder(
    userId: string,
    input: CheckoutInput,
    client: ClientInfo,
  ): Promise<CheckoutResult> {
    const provider = this.providers.get(input.paymentProvider);
    const { address, method } = await this.resolveDelivery(
      userId,
      input.addressId,
      input.shippingMethodId,
    );
    const expiresAt = new Date(Date.now() + this.config.checkout.reservationTtlMinutes * 60_000);

    const order = await this.prisma.$transaction(
      async (tx) => {
        const cart = await this.carts.find({ userId }, tx);
        if (!cart || cart.items.length === 0) throw new AppException('CART_EMPTY');
        const priced = await this.carts.price(cart, userId, {
          shipping: shippingRule(method),
          client: tx,
        });

        if (priced.view.lines.some((line) => line.issue !== null)) {
          throw new AppException('CART_CHANGED', priced.view.warnings.join(' ') || undefined);
        }
        if (cart.couponCode && !priced.coupon) {
          throw new AppException('INVALID_COUPON', priced.view.warnings.join(' ') || undefined);
        }
        const { pricing } = priced;
        if (input.expectedTotal !== undefined && input.expectedTotal !== pricing.total) {
          throw new AppException(
            'CART_CHANGED',
            'مبلغ سفارش تغییر کرده است. لطفاً سبد خرید را دوباره بررسی کنید.',
          );
        }

        const created = await tx.order.create({
          data: {
            userId,
            status: 'pending',
            subtotal: BigInt(pricing.subtotal),
            discountTotal: BigInt(pricing.couponDiscount),
            shippingCost: BigInt(pricing.shippingCost ?? 0),
            taxTotal: BigInt(pricing.tax),
            taxIncluded: pricing.taxIncluded,
            total: BigInt(pricing.total),
            couponId: priced.coupon?.couponId ?? null,
            couponCode: priced.coupon?.rule.code ?? null,
            shippingMethodId: method.id,
            shippingMethodName: method.name,
            shippingAddress: {
              recipientName: address.recipientName,
              recipientMobile: address.recipientMobile,
              province: address.province,
              city: address.city,
              addressLine: address.addressLine,
              plaque: address.plaque,
              unit: address.unit,
              postalCode: address.postalCode,
            } satisfies Prisma.InputJsonValue,
            customerNote: input.note,
            reservationExpiresAt: expiresAt,
            ipAddress: client.ipAddress ?? null,
            userAgent: client.userAgent ?? null,
            items: {
              create: priced.orderableLines.map(({ line }) => ({
                productId: line.productId,
                variantId: line.variantId,
                title: line.title,
                variantTitle: line.variantTitle,
                sku: line.sku,
                imageUrl: line.imageUrl,
                unitPrice: BigInt(line.unitPrice),
                compareAtPrice: line.compareAtPrice ? BigInt(line.compareAtPrice) : null,
                quantity: line.quantity,
                total: BigInt(line.lineTotal),
              })),
            },
            history: { create: { toStatus: 'pending', actorType: 'customer', actorId: userId } },
          },
        });

        await this.inventory.reserve(
          tx,
          created.id,
          priced.orderableLines.map(({ line }) => ({
            variantId: line.variantId,
            quantity: line.quantity,
            label: line.title,
          })),
          expiresAt,
        );
        if (priced.coupon) {
          await this.coupons.redeem(tx, {
            couponId: priced.coupon.couponId,
            userId,
            orderId: created.id,
            amount: pricing.couponDiscount,
          });
        }
        const awaiting = await this.orders.transition(tx, created, 'awaiting_payment', {
          type: 'system',
        });
        await this.carts.clear(tx, cart.id);
        await this.outbox.record(tx, [
          {
            type: 'order.created',
            aggregateType: 'order',
            aggregateId: created.id,
            payload: { orderId: created.id },
          },
        ]);
        return awaiting;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
    this.outbox.flush();
    await this.orders.scheduleExpiry(order.id, expiresAt);

    try {
      const { paymentUrl, amount } = await this.payments.start(order.id, userId, provider.code);
      return { orderId: order.id, orderNumber: order.orderNumber, amount, paymentUrl };
    } catch (error) {
      // The order exists and stock is reserved; the customer can retry from the order page.
      const message = error instanceof AppException ? error.body.message : undefined;
      throw new AppException('PAYMENT_PROVIDER_UNAVAILABLE', message, [
        { path: 'orderId', message: order.id },
      ]);
    }
  }

  private async resolveDelivery(userId: string, addressId: string, shippingMethodId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId, deletedAt: null },
    });
    if (!address)
      throw AppException.validation([{ path: 'addressId', message: 'آدرس انتخاب‌شده یافت نشد.' }]);
    const method = await this.prisma.shippingMethod.findFirst({
      where: { id: shippingMethodId, isActive: true },
    });
    if (!method || !serves(method, address.province)) {
      throw new AppException(
        'INVALID_SHIPPING_METHOD',
        'این روش ارسال برای آدرس انتخاب‌شده در دسترس نیست.',
      );
    }
    return { address, method };
  }
}
