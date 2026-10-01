import { Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import {
  type AuthResponse,
  type AuthUser,
  type LoginInput,
  loginSchema,
  type RegisterInput,
  registerSchema,
} from '@toolshop/shared';
import type { Request, Response } from 'express';
import { AppException } from '../../common/errors/app-exception';
import { ZBody } from '../../common/decorators/validated.decorator';
import { AppConfig } from '../../config/app-config';
import { CartService } from '../cart/cart.service';
import type { AuthContext } from './auth-context';
import {
  CART_COOKIE,
  clearAuthCookies,
  clearCartCookie,
  REFRESH_COOKIE,
  setAuthCookies,
} from './auth-cookies';
import { AuthService } from './auth.service';
import { AuthRateLimit } from './auth-throttle';
import { CurrentUser, OptionalUser, Public } from './decorators';
import type { ClientInfo } from './session.service';

function clientInfo(request: Request): ClientInfo {
  return { ipAddress: request.ip, userAgent: request.get('user-agent')?.slice(0, 400) };
}

function cookie(request: Request, name: string): string | undefined {
  const value = (request.cookies as Record<string, string> | undefined)?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly carts: CartService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @AuthRateLimit()
  @Post('register')
  async register(
    @ZBody(registerSchema) input: RegisterInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const { user, tokens } = await this.auth.register(input, clientInfo(request));
    setAuthCookies(response, this.config, tokens);
    await this.adoptGuestCart(request, response, user.id);
    return { user };
  }

  @Public()
  @AuthRateLimit()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @ZBody(loginSchema) input: LoginInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const { user, tokens } = await this.auth.login(input, clientInfo(request));
    setAuthCookies(response, this.config, tokens);
    if (user.type === 'customer') await this.adoptGuestCart(request, response, user.id);
    return { user };
  }

  /**
   * Rotates the refresh token. Browsers send it as an httpOnly cookie; non-browser
   * clients may send `{ "refreshToken": "..." }` and read the new pair from the body.
   */
  @Public()
  @AuthRateLimit()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: true } | { accessToken: string; refreshToken: string }> {
    const fromCookie = cookie(request, REFRESH_COOKIE);
    const body = request.body as { refreshToken?: unknown } | undefined;
    const fromBody = typeof body?.refreshToken === 'string' ? body.refreshToken : undefined;
    const token = fromCookie ?? fromBody;
    if (!token) throw new AppException('SESSION_EXPIRED');
    try {
      const tokens = await this.auth.refresh(token, clientInfo(request));
      if (fromCookie) {
        setAuthCookies(response, this.config, tokens);
        return { ok: true };
      }
      return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    } catch (error) {
      if (fromCookie) clearAuthCookies(response, this.config);
      throw error;
    }
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @OptionalUser() user: AuthContext | undefined,
  ): Promise<void> {
    await this.auth.logout(cookie(request, REFRESH_COOKIE), user?.sessionId);
    clearAuthCookies(response, this.config);
  }

  @Get('me')
  me(@CurrentUser() user: AuthContext): Promise<AuthUser> {
    return this.auth.getAuthUser(user.userId);
  }

  private async adoptGuestCart(
    request: Request,
    response: Response,
    userId: string,
  ): Promise<void> {
    const guestToken = cookie(request, CART_COOKIE);
    if (!guestToken) return;
    await this.carts.mergeGuestCartIntoUser(guestToken, userId);
    clearCartCookie(response, this.config);
  }
}
