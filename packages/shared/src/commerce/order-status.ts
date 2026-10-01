export const ORDER_STATUSES = [
  'pending',
  'awaiting_payment',
  'paid',
  'processing',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'ثبت اولیه',
  awaiting_payment: 'در انتظار پرداخت',
  paid: 'پرداخت‌شده',
  processing: 'در حال پردازش',
  packed: 'بسته‌بندی‌شده',
  shipped: 'ارسال‌شده',
  delivered: 'تحویل‌شده',
  cancelled: 'لغوشده',
  returned: 'مرجوع‌شده',
  refunded: 'بازپرداخت‌شده',
};

/**
 * Allowed order status transitions. Inventory and payment side-effects of each
 * transition are applied by the order service, never by callers.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: ['refunded'],
  returned: ['refunded'],
  refunded: [],
};

/** Statuses in which stock has already been deducted (payment captured, not yet restocked). */
export const STOCK_COMMITTED_STATUSES: readonly OrderStatus[] = [
  'paid',
  'processing',
  'packed',
  'shipped',
  'delivered',
];

/** Statuses in which the customer may still cancel the order on their own. */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly OrderStatus[] = [
  'pending',
  'awaiting_payment',
];

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['refunded'];

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export class InvalidOrderTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`Order cannot move from "${from}" to "${to}"`);
    this.name = 'InvalidOrderTransitionError';
  }
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}

/** Steps shown in the customer-facing order tracker. */
export const ORDER_TRACKING_STEPS: readonly OrderStatus[] = [
  'paid',
  'processing',
  'packed',
  'shipped',
  'delivered',
];
