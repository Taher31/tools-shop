import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: Request & { id?: string | number }, _response: Response, next: NextFunction): void {
    RequestContext.run(
      {
        requestId: request.id !== undefined ? String(request.id) : undefined,
        ipAddress: request.ip,
        userAgent: request.get('user-agent')?.slice(0, 400),
      },
      next,
    );
  }
}
