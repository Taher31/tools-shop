import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { AppException } from '../../common/errors/app-exception';
import { REDIS } from '../../infrastructure/redis/redis.constants';

const MAX_FAILURES = 8;
const WINDOW_SECONDS = 15 * 60;
const key = (identifier: string) => `auth:failures:${identifier}`;

/** Per-account brute-force protection (in addition to per-IP rate limiting). */
@Injectable()
export class LoginAttemptsService {
  private readonly logger = new Logger(LoginAttemptsService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async assertNotLocked(identifier: string): Promise<void> {
    try {
      const failures = Number((await this.redis.get(key(identifier))) ?? 0);
      if (failures >= MAX_FAILURES) {
        throw new AppException(
          'RATE_LIMITED',
          'به دلیل تلاش‌های ناموفق متعدد، ورود به این حساب موقتاً مسدود شده است. ۱۵ دقیقه دیگر تلاش کنید.',
        );
      }
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.warn({ err: error }, 'Login attempt check unavailable');
    }
  }

  async recordFailure(identifier: string): Promise<void> {
    try {
      const failures = await this.redis.incr(key(identifier));
      if (failures === 1) await this.redis.expire(key(identifier), WINDOW_SECONDS);
    } catch (error) {
      this.logger.warn({ err: error }, 'Could not record login failure');
    }
  }

  async reset(identifier: string): Promise<void> {
    await this.redis.del(key(identifier)).catch(() => undefined);
  }
}
