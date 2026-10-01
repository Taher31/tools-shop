/** Stable machine-readable error codes returned by the API (`error.code`). */
export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'SESSION_EXPIRED',
  'ACCOUNT_DISABLED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'OUT_OF_STOCK',
  'CART_EMPTY',
  'CART_CHANGED',
  'INVALID_COUPON',
  'INVALID_SHIPPING_METHOD',
  'INVALID_ORDER_TRANSITION',
  'PAYMENT_FAILED',
  'PAYMENT_PROVIDER_UNAVAILABLE',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Default Persian messages; the API may send a more specific message per error. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: 'درخواست نامعتبر است.',
  VALIDATION_FAILED: 'اطلاعات واردشده معتبر نیست.',
  UNAUTHENTICATED: 'لطفاً وارد حساب کاربری خود شوید.',
  INVALID_CREDENTIALS: 'نام کاربری یا رمز عبور اشتباه است.',
  SESSION_EXPIRED: 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.',
  ACCOUNT_DISABLED: 'حساب کاربری شما غیرفعال است.',
  FORBIDDEN: 'شما به این بخش دسترسی ندارید.',
  NOT_FOUND: 'موردی یافت نشد.',
  CONFLICT: 'این اطلاعات با داده‌های موجود تداخل دارد.',
  RATE_LIMITED: 'تعداد درخواست‌ها زیاد است. لطفاً کمی بعد دوباره تلاش کنید.',
  PAYLOAD_TOO_LARGE: 'حجم فایل یا درخواست بیش از حد مجاز است.',
  UNSUPPORTED_MEDIA_TYPE: 'نوع فایل پشتیبانی نمی‌شود.',
  OUT_OF_STOCK: 'موجودی کالا کافی نیست.',
  CART_EMPTY: 'سبد خرید شما خالی است.',
  CART_CHANGED: 'سبد خرید شما تغییر کرده است. لطفاً دوباره بررسی کنید.',
  INVALID_COUPON: 'کد تخفیف معتبر نیست.',
  INVALID_SHIPPING_METHOD: 'روش ارسال انتخاب‌شده معتبر نیست.',
  INVALID_ORDER_TRANSITION: 'تغییر وضعیت سفارش به این مرحله امکان‌پذیر نیست.',
  PAYMENT_FAILED: 'پرداخت ناموفق بود.',
  PAYMENT_PROVIDER_UNAVAILABLE: 'درگاه پرداخت در دسترس نیست. لطفاً بعداً تلاش کنید.',
  SERVICE_UNAVAILABLE: 'سرویس موقتاً در دسترس نیست.',
  INTERNAL_ERROR: 'خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.',
};

export interface FieldError {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: FieldError[];
    requestId?: string;
  };
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}
