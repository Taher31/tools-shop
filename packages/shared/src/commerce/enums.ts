export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'پیش‌نویس',
  active: 'فعال',
  archived: 'بایگانی',
};

export const PAYMENT_STATUSES = [
  'initiated',
  'pending',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  initiated: 'ایجادشده',
  pending: 'در انتظار تأیید',
  succeeded: 'موفق',
  failed: 'ناموفق',
  cancelled: 'لغوشده',
  refunded: 'بازپرداخت‌شده',
};

export const STOCK_MOVEMENT_TYPES = [
  'purchase',
  'sale',
  'return',
  'adjustment',
  'cancellation',
  'transfer_in',
  'transfer_out',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];
export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  purchase: 'ورود کالا (خرید)',
  sale: 'فروش',
  return: 'مرجوعی',
  adjustment: 'اصلاح موجودی',
  cancellation: 'بازگشت از سفارش لغوشده',
  transfer_in: 'انتقال ورودی',
  transfer_out: 'انتقال خروجی',
};

export const RESERVATION_STATUSES = ['active', 'committed', 'released', 'expired'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const ATTRIBUTE_TYPES = ['text', 'number', 'boolean', 'select', 'multiselect'] as const;
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];
export const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  text: 'متن',
  number: 'عدد',
  boolean: 'بله/خیر',
  select: 'انتخابی',
  multiselect: 'چندانتخابی',
};

export const COUPON_TYPES = ['percent', 'fixed', 'free_shipping'] as const;
export type CouponType = (typeof COUPON_TYPES)[number];
export const COUPON_TYPE_LABELS: Record<CouponType, string> = {
  percent: 'درصدی',
  fixed: 'مبلغ ثابت',
  free_shipping: 'ارسال رایگان',
};

export const USER_TYPES = ['customer', 'staff'] as const;
export type UserType = (typeof USER_TYPES)[number];

export const USAGE_TYPES = ['home', 'semi_industrial', 'industrial'] as const;
export type UsageType = (typeof USAGE_TYPES)[number];
export const USAGE_TYPE_LABELS: Record<UsageType, string> = {
  home: 'خانگی',
  semi_industrial: 'نیمه‌صنعتی',
  industrial: 'صنعتی',
};

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'در انتظار بررسی',
  approved: 'تأییدشده',
  rejected: 'ردشده',
};

export const QUESTION_STATUSES = ['pending', 'answered', 'rejected'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];
export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  pending: 'در انتظار پاسخ',
  answered: 'پاسخ داده شده',
  rejected: 'ردشده',
};

export const MARKETPLACE_SYNC_STATUSES = [
  'not_synced',
  'pending',
  'synced',
  'failed',
  'disabled',
] as const;
export type MarketplaceSyncStatus = (typeof MARKETPLACE_SYNC_STATUSES)[number];

export const AUDIT_ACTOR_TYPES = ['user', 'system', 'ai'] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const TICKET_STATUSES = ['open', 'answered', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'در انتظار پاسخ پشتیبانی',
  answered: 'پاسخ داده شده',
  closed: 'بسته‌شده',
};

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'کم',
  normal: 'عادی',
  high: 'زیاد',
  urgent: 'فوری',
};

export const TICKET_CATEGORIES = [
  'order',
  'product',
  'payment',
  'shipping',
  'warranty',
  'other',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  order: 'پیگیری سفارش',
  product: 'مشاوره و سوال درباره کالا',
  payment: 'پرداخت و بازپرداخت',
  shipping: 'ارسال و تحویل',
  warranty: 'گارانتی و خدمات پس از فروش',
  other: 'سایر',
};

export const INVOICE_TYPES = ['sale', 'credit_note'] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];
export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  sale: 'فاکتور فروش',
  credit_note: 'اعلامیه برگشت از فروش',
};
