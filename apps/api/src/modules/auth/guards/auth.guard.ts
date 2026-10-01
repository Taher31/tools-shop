import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@toolshop/shared';
import { AppException } from '../../../common/errors/app-exception';
import { RequestContext } from '../../../common/http/request-context';
import type { AuthContext } from '../auth-context';
import { ACCESS_COOKIE } from '../auth-cookies';
import { type AuthenticatedRequest, IS_PUBLIC_KEY } from '../decorators';
import { PrincipalService } from '../principal.service';
import { type AccessTokenClaims, TokenService } from '../token.service';

/**
 * Global guard: resolves the user from the access-token cookie (browser) or the
 * `Authorization: Bearer` header (bots, mobile apps). Routes are private by default.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly principals: PrincipalService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const token = this.extractToken(request);
    if (token) {
      const claims = await this.tokens.verifyAccessToken(token);
      if (!claims) {
        if (isPublic) return true;
        throw new AppException('SESSION_EXPIRED');
      }
      const user = await this.resolve(claims);
      if (user) {
        request.user = user;
        RequestContext.setUser(user);
        return true;
      }
      if (!isPublic) throw new AppException('SESSION_EXPIRED');
    }

    if (isPublic) return true;
    throw new AppException('UNAUTHENTICATED');
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const header = request.get('authorization');
    if (header?.startsWith('Bearer ')) return header.slice(7).trim() || undefined;
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[ACCESS_COOKIE];
  }

  private async resolve(claims: AccessTokenClaims): Promise<AuthContext | null> {
    if (await this.principals.isSessionRevoked(claims.sid)) return null;
    const principal = await this.principals.load(claims.sub);
    if (!principal) return null;
    if (!principal.isActive) throw new AppException('ACCOUNT_DISABLED');
    return {
      userId: claims.sub,
      sessionId: claims.sid,
      type: principal.type,
      firstName: principal.firstName,
      lastName: principal.lastName,
      roles: principal.roles,
      permissions: new Set<Permission>(principal.permissions),
    };
  }
}
