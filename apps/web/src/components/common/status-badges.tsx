import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
} from '@toolshop/shared';
import { Badge, type BadgeProps } from '@toolshop/ui';

const ORDER_VARIANTS: Record<OrderStatus, BadgeProps['variant']> = {
  pending: 'secondary',
  awaiting_payment: 'warning',
  paid: 'info',
  processing: 'info',
  packed: 'info',
  shipped: 'default',
  delivered: 'success',
  cancelled: 'destructive',
  returned: 'warning',
  refunded: 'secondary',
};

const PAYMENT_VARIANTS: Record<PaymentStatus, BadgeProps['variant']> = {
  initiated: 'secondary',
  pending: 'warning',
  succeeded: 'success',
  failed: 'destructive',
  cancelled: 'secondary',
  refunded: 'info',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_VARIANTS[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={PAYMENT_VARIANTS[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}
