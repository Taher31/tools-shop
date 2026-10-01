import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Redis } from 'ioredis';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { REDIS } from '../../infrastructure/redis/redis.constants';
import { Public } from '../auth/decorators';
import { SearchIndexService } from '../search/search-index.service';

type Check = 'up' | 'down';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly search: SearchIndexService,
  ) {}

  /** Liveness: the process is running. */
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Readiness: database is required; Redis and search are reported but degrade
   * gracefully (the API keeps serving with fallbacks).
   */
  @Get()
  async ready(@Res({ passthrough: true }) response: Response) {
    const [database, redis, search] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then((): Check => 'up').catch((): Check => 'down'),
      this.redis.ping().then((): Check => 'up').catch((): Check => 'down'),
      this.search.isHealthy().then((ok): Check => (ok ? 'up' : 'down')),
    ]);
    const status = database === 'up' ? (redis === 'up' && search === 'up' ? 'ok' : 'degraded') : 'down';
    if (status === 'down') response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status, checks: { database, redis, search } };
  }
}
