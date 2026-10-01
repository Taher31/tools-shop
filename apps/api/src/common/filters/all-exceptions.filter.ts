import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ERROR_MESSAGES, type ApiErrorBody, type ErrorCode } from '@toolshop/shared';
import { ZodError } from 'zod';
import { AppException } from '../errors/app-exception';
import { zodIssuesToFieldErrors } from '../pipes/zod-validation.pipe';

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

interface PrismaLikeError {
  name: string;
  code: string;
  meta?: { target?: unknown; modelName?: string };
}

function isPrismaKnownError(error: unknown): error is PrismaLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'PrismaClientKnownRequestError' &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

/**
 * Single place that turns every error into the `{ error: { code, message } }` envelope.
 * Internal details (stack traces, SQL, provider responses) are logged, never returned.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { id?: string | number }>();
    const { status, body } = this.toResponse(exception);
    body.error.requestId = request.id !== undefined ? String(request.id) : undefined;

    if (status >= 500) {
      this.logger.error(
        {
          err: exception,
          path: request.url,
          method: request.method,
          requestId: body.error.requestId,
        },
        'Unhandled error',
      );
    } else if (status !== 401 && status !== 404) {
      this.logger.debug({ code: body.error.code, path: request.url }, body.error.message);
    }

    if (!response.headersSent) response.status(status).json(body);
  }

  private toResponse(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof AppException) {
      return { status: exception.getStatus(), body: { error: { ...exception.body } } };
    }
    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          error: {
            code: 'VALIDATION_FAILED',
            message: ERROR_MESSAGES.VALIDATION_FAILED,
            details: zodIssuesToFieldErrors(exception.issues),
          },
        },
      };
    }
    if (isPrismaKnownError(exception)) {
      return this.fromPrisma(exception);
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
      return { status, body: { error: { code, message: ERROR_MESSAGES[code] } } };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: 'INTERNAL_ERROR', message: ERROR_MESSAGES.INTERNAL_ERROR } },
    };
  }

  private fromPrisma(error: PrismaLikeError): { status: number; body: ApiErrorBody } {
    switch (error.code) {
      case 'P2002': {
        const target = Array.isArray(error.meta?.target)
          ? (error.meta.target as string[]).join(', ')
          : undefined;
        return {
          status: HttpStatus.CONFLICT,
          body: {
            error: {
              code: 'CONFLICT',
              message: 'مقدار واردشده تکراری است.',
              details: target
                ? [{ path: target, message: 'این مقدار قبلاً ثبت شده است.' }]
                : undefined,
            },
          },
        };
      }
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          body: { error: { code: 'CONFLICT', message: 'این مورد به داده‌های دیگری وابسته است.' } },
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          body: { error: { code: 'NOT_FOUND', message: ERROR_MESSAGES.NOT_FOUND } },
        };
      default:
        this.logger.error({ err: error }, 'Unhandled database error');
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          body: { error: { code: 'INTERNAL_ERROR', message: ERROR_MESSAGES.INTERNAL_ERROR } },
        };
    }
  }
}
