import { Injectable, Logger } from '@nestjs/common';
import type { UserType } from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { randomToken, sha256 } from '../../common/utils/crypto';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PrincipalService } from './principal.service';
import { TokenService } from './token.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  userId: string;
}

export interface ClientInfo {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Refresh tokens are opaque random strings stored only as SHA-256 hashes and rotated on
 * every use. Presenting an already-rotated token means it was stolen: the whole session
 * is revoked.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly principals: PrincipalService,
    private readonly config: AppConfig,
  ) {}

  async create(user: { id: string; type: UserType }, client: ClientInfo): Promise<IssuedTokens> {
    const refreshToken = randomToken(48);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        ipAddress: client.ipAddress ?? null,
        userAgent: client.userAgent ?? null,
        expiresAt: this.refreshExpiry(),
      },
    });
    const accessToken = await this.tokens.signAccessToken({ sub: user.id, sid: session.id, typ: user.type });
    return { accessToken, refreshToken, sessionId: session.id, userId: user.id };
  }

  async rotate(refreshToken: string, client: ClientInfo): Promise<IssuedTokens> {
    const tokenHash = sha256(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, type: true, isActive: true } } },
    });

    if (!session) {
      const reused = await this.prisma.session.findUnique({ where: { previousTokenHash: tokenHash } });
      if (reused && !reused.revokedAt) {
        this.logger.warn({ sessionId: reused.id, userId: reused.userId }, 'Refresh token reuse detected');
        await this.revoke(reused.id);
      }
      throw new AppException('SESSION_EXPIRED');
    }
    if (session.revokedAt || session.expiresAt <= new Date()) throw new AppException('SESSION_EXPIRED');
    if (!session.user.isActive) throw new AppException('ACCOUNT_DISABLED');

    const nextToken = randomToken(48);
    const updated = await this.prisma.session.updateMany({
      where: { id: session.id, tokenHash },
      data: {
        tokenHash: sha256(nextToken),
        previousTokenHash: tokenHash,
        lastUsedAt: new Date(),
        ipAddress: client.ipAddress ?? session.ipAddress,
        userAgent: client.userAgent ?? session.userAgent,
        expiresAt: this.refreshExpiry(),
      },
    });
    // A concurrent refresh already rotated this token.
    if (updated.count === 0) throw new AppException('SESSION_EXPIRED');

    const accessToken = await this.tokens.signAccessToken({
      sub: session.user.id,
      sid: session.id,
      typ: session.user.type,
    });
    return { accessToken, refreshToken: nextToken, sessionId: session.id, userId: session.user.id };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.principals.markSessionRevoked(sessionId, this.config.auth.accessTtlSeconds);
  }

  async revokeByRefreshToken(refreshToken: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (session) await this.revoke(session.id);
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      select: { id: true },
    });
    for (const session of sessions) await this.revoke(session.id);
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.config.auth.refreshTtlDays * 86_400_000);
  }
}
