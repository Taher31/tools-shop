import { type ExecutionContext, SetMetadata } from '@nestjs/common';

export const AUTH_THROTTLE_KEY = 'throttle:auth';

/** Applies the strict `auth` rate limit (AUTH_RATE_LIMIT_MAX per window) to a route. */
export const AuthRateLimit = (): MethodDecorator => SetMetadata(AUTH_THROTTLE_KEY, true);

export function isAuthRateLimited(context: ExecutionContext): boolean {
  return Reflect.getMetadata(AUTH_THROTTLE_KEY, context.getHandler()) === true;
}
