import { Inject, Injectable, Logger } from '@nestjs/common';
import { isPermission, SUPER_ADMIN_ROLE, ALL_PERMISSIONS, type Permission } from '@toolshop/shared';
import type { Redis } from 'ioredis';
import { CacheService } from '../../infrastructure/redis/cache.service';
import { REDIS } from '../../infrastructure/redis/redis.constants';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { CachedPrincipal } from './auth-context';

const PRINCIPAL_TTL_SECONDS = 60;
const principalKey = (userId: string) => `auth:principal:${userId}`;
const revokedSessionKey = (sessionId: string) => `auth:revoked:${sessionId}`;

/**
 * Loads (and briefly caches) who a user is and what they may do. Role or user changes
 * call `invalidate*` so permission changes take effect within seconds.
 */
@Injectable()
export class PrincipalService {
  private readonly logger = new Logger(PrincipalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async load(userId: string): Promise<CachedPrincipal | null> {
    const cached = await this.cache.get<CachedPrincipal>(principalKey(userId));
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        type: true,
        isActive: true,
        firstName: true,
        lastName: true,
        roles: {
          select: {
            role: { select: { key: true, permissions: { select: { permissionKey: true } } } },
          },
        },
      },
    });
    if (!user) return null;

    const roles = user.roles.map((entry) => entry.role.key);
    const permissions = new Set<Permission>();
    if (user.type === 'staff') {
      if (roles.includes(SUPER_ADMIN_ROLE)) {
        ALL_PERMISSIONS.forEach((permission) => permissions.add(permission));
      }
      for (const entry of user.roles) {
        for (const { permissionKey } of entry.role.permissions) {
          if (isPermission(permissionKey)) permissions.add(permissionKey);
        }
      }
    }
    const principal: CachedPrincipal = {
      type: user.type,
      isActive: user.isActive,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions: [...permissions],
    };
    await this.cache.set(principalKey(userId), principal, PRINCIPAL_TTL_SECONDS);
    return principal;
  }

  async invalidate(userId: string): Promise<void> {
    await this.cache.del(principalKey(userId));
  }

  async invalidateAll(): Promise<void> {
    await this.cache.delByPrefix('auth:principal:');
  }

  async markSessionRevoked(sessionId: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(revokedSessionKey(sessionId), '1', 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn({ err: error }, 'Could not cache session revocation');
    }
  }

  async isSessionRevoked(sessionId: string): Promise<boolean> {
    try {
      return (await this.redis.exists(revokedSessionKey(sessionId))) === 1;
    } catch {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        select: { revokedAt: true },
      });
      return !session || session.revokedAt !== null;
    }
  }
}
