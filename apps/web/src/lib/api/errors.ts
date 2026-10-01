import { ERROR_MESSAGES, type ErrorCode, type FieldError, isApiErrorBody } from '@toolshop/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field errors keyed by path (for forms). */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.map((detail) => [detail.path, detail.message]));
  }
}

export function toApiError(status: number, body: unknown): ApiError {
  if (isApiErrorBody(body)) {
    return new ApiError(status, body.error.code, body.error.message, body.error.details ?? []);
  }
  const code: ErrorCode =
    status === 404
      ? 'NOT_FOUND'
      : status === 429
        ? 'RATE_LIMITED'
        : status >= 500
          ? 'INTERNAL_ERROR'
          : 'BAD_REQUEST';
  return new ApiError(status, code, ERROR_MESSAGES[code]);
}

/** A user-facing Persian message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError)
    return 'ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.';
  return ERROR_MESSAGES.INTERNAL_ERROR;
}
