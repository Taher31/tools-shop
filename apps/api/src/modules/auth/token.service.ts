import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserType } from '@toolshop/shared';
import { AppConfig } from '../../config/app-config';

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  typ: UserType;
}

const ISSUER = 'toolshop-api';
const AUDIENCE = 'toolshop';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return this.jwt.signAsync(claims, {
      secret: this.config.auth.accessSecret,
      expiresIn: this.config.auth.accessTtlSeconds,
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithm: 'HS256',
    });
  }

  /** Returns the claims, or null when the token is invalid or expired. */
  async verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.config.auth.accessSecret,
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
      return payload;
    } catch {
      return null;
    }
  }
}
