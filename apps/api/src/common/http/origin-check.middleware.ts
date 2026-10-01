import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppConfig } from '../../config/app-config';
import { AppException } from '../errors/app-exception';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth for cookie-authenticated requests. Cookies are SameSite=Lax,
 * and additionally every state-changing browser request must come from an allowed
 * origin. Requests without Origin/Referer (server-to-server, payment gateway callbacks,
 * bots with bearer tokens) are not affected because they do not carry ambient cookies
 * from a victim's browser.
 */
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  private readonly allowed: Set<string>;

  constructor(config: AppConfig) {
    this.allowed = new Set(config.corsOrigins.map((origin) => origin.replace(/\/$/, '')));
  }

  use(request: Request, _response: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(request.method)) return next();
    const origin = request.get('origin') ?? this.originFromReferer(request.get('referer'));
    if (!origin || this.allowed.has(origin)) return next();
    next(new AppException('FORBIDDEN', 'درخواست از مبدا نامعتبر ارسال شده است.'));
  }

  private originFromReferer(referer: string | undefined): string | undefined {
    if (!referer) return undefined;
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }
}
