import type { Prisma } from '@toolshop/database';
import {
  type AddressSnapshot,
  type AdminOrderDetail,
  type AdminOrderSummary,
  CUSTOMER_CANCELLABLE_STATUSES,
  ORDER_TRANSITIONS,
  type OrderDetail,
  type OrderSummary,
  type PaymentView,
} from '@toolshop/shared';
import { toRial } from '../../common/utils/money';

export const ORDER_DETAIL_INCLUDE = {
  items: { orderBy: { id: 'asc' }, include: { product: { select: { slug: true } } } },
  history: {
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { firstName: true, lastName: true } } },
  },
  payments: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.OrderInclude;

export const ADMIN_ORDER_INCLUDE = {
  ...ORDER_DETAIL_INCLUDE,
  user: { select: { id: true, firstName: true, lastName: true, mobile: true, email: true } },
} satisfies Prisma.OrderInclude;

export type OrderDetailRecord = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;
export type AdminOrderRecord = Prisma.OrderGetPayload<{ include: typeof ADMIN_ORDER_INCLUDE }>;
type PaymentRecord = OrderDetailRecord['payments'][number];

export function toPaymentView(payment: PaymentRecord): PaymentView {
  return {
    id: payment.id,
    provider: payment.provider,
    amount: toRial(payment.amount),
    status: payment.status,
    referenceId: payment.referenceId,
    cardMask: payment.cardMask,
    failureReason: payment.failureReason,
    createdAt: payment.createdAt.toISOString(),
    verifiedAt: payment.verifiedAt?.toISOString() ?? null,
  };
}

export function toOrderSummary(order: {
  id: string;
  orderNumber: number;
  status: OrderSummary['status'];
  total: bigint;
  createdAt: Date;
  paidAt: Date | null;
  items: { quantity: number }[];
}): OrderSummary {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    total: toRial(order.total),
    itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
  };
}

function toAddressSnapshot(value: Prisma.JsonValue): AddressSnapshot {
  const raw = (value ?? {}) as Partial<Record<keyof AddressSnapshot, string | null>>;
  return {
    recipientName: raw.recipientName ?? '',
    recipientMobile: raw.recipientMobile ?? '',
    province: raw.province ?? '',
    city: raw.city ?? '',
    addressLine: raw.addressLine ?? '',
    plaque: raw.plaque ?? null,
    unit: raw.unit ?? null,
    postalCode: raw.postalCode ?? '',
  };
}

export function toOrderDetail(order: OrderDetailRecord): OrderDetail {
  const reservationOpen =
    order.status === 'awaiting_payment' && order.reservationExpiresAt !== null && order.reservationExpiresAt > new Date();
  return {
    ...toOrderSummary(order),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productSlug: item.product?.slug ?? null,
      title: item.title,
      variantTitle: item.variantTitle,
      sku: item.sku,
      imageUrl: item.imageUrl,
      unitPrice: toRial(item.unitPrice),
      quantity: item.quantity,
      total: toRial(item.total),
    })),
    subtotal: toRial(order.subtotal),
    discountTotal: toRial(order.discountTotal),
    shippingCost: toRial(order.shippingCost),
    taxTotal: toRial(order.taxTotal),
    taxIncluded: order.taxIncluded,
    couponCode: order.couponCode,
    shippingMethodName: order.shippingMethodName,
    shippingAddress: toAddressSnapshot(order.shippingAddress),
    customerNote: order.customerNote,
    trackingCode: order.trackingCode,
    reservationExpiresAt: order.reservationExpiresAt?.toISOString() ?? null,
    history: order.history.map((entry) => ({
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      note: entry.note,
      actorName: entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : null,
      createdAt: entry.createdAt.toISOString(),
    })),
    payments: order.payments.map(toPaymentView),
    canCancel: CUSTOMER_CANCELLABLE_STATUSES.includes(order.status),
    canPay: reservationOpen,
  };
}

export function toAdminOrderSummary(order: {
  id: string;
  orderNumber: number;
  status: OrderSummary['status'];
  total: bigint;
  createdAt: Date;
  paidAt: Date | null;
  items: { quantity: number }[];
  user: { id: string; firstName: string; lastName: string; mobile: string | null };
}): AdminOrderSummary {
  return {
    ...toOrderSummary(order),
    customer: {
      id: order.user.id,
      fullName: `${order.user.firstName} ${order.user.lastName}`,
      mobile: order.user.mobile,
    },
  };
}

export function toAdminOrderDetail(order: AdminOrderRecord): AdminOrderDetail {
  return {
    ...toOrderDetail(order),
    customer: {
      id: order.user.id,
      fullName: `${order.user.firstName} ${order.user.lastName}`,
      mobile: order.user.mobile,
      email: order.user.email,
    },
    adminNote: order.adminNote,
    allowedTransitions: [...ORDER_TRANSITIONS[order.status]].filter((status) => status !== 'refunded'),
  };
}
