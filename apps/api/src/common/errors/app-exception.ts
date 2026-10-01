import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_MESSAGES, type ErrorCode, type FieldError } from '@toolshop/shared';

export interface AppExceptionBody {
  code: ErrorCode;
  message: string;
  details?: FieldError[];
}

const DEFAULT_STATUS: Partial<Record<ErrorCode, HttpStatus>> = {
  BAD_REQUEST: HttpStatus.BAD_REQUEST,
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  SESSION_EXPIRED: HttpStatus.UNAUTHORIZED,
  ACCOUNT_DISABLED: HttpStatus.FORBIDDEN,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  PAYLOAD_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  UNSUPPORTED_MEDIA_TYPE: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  OUT_OF_STOCK: HttpStatus.CONFLICT,
  CART_EMPTY: HttpStatus.UNPROCESSABLE_ENTITY,
  CART_CHANGED: HttpStatus.CONFLICT,
  INVALID_COUPON: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_SHIPPING_METHOD: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_ORDER_TRANSITION: HttpStatus.CONFLICT,
  PAYMENT_FAILED: HttpStatus.PAYMENT_REQUIRED,
  PAYMENT_PROVIDER_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
};

/**
 * Domain error with a stable code and a user-facing Persian message. Anything thrown
 * that is not an AppException is treated as an internal error and never leaked.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string, details?: FieldError[], status?: HttpStatus) {
    const body: AppExceptionBody = { code, message: message ?? ERROR_MESSAGES[code] };
    if (details?.length) body.details = details;
    super(body, status ?? DEFAULT_STATUS[code] ?? HttpStatus.BAD_REQUEST);
    this.code = code;
  }

  get body(): AppExceptionBody {
    return this.getResponse() as AppExceptionBody;
  }

  static notFound(message = 'موردی یافت نشد.'): AppException {
    return new AppException('NOT_FOUND', message);
  }

  static conflict(message: string, details?: FieldError[]): AppException {
    return new AppException('CONFLICT', message, details);
  }

  static forbidden(message?: string): AppException {
    return new AppException('FORBIDDEN', message);
  }

  static badRequest(message: string, details?: FieldError[]): AppException {
    return new AppException('BAD_REQUEST', message, details);
  }

  static validation(details: FieldError[], message?: string): AppException {
    return new AppException('VALIDATION_FAILED', message, details);
  }
}
