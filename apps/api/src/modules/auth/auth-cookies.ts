import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../../config/app-config';

export const ACCESS_COOKIE = 'ts_at';
export const REFRESH_COOKIE = 'ts_rt';
export const CART_COOKIE = 'ts_cart';
/**
 * Non-sensitive hint readable by JavaScript and the Next.js proxy ("a session probably
 * exists"). It grants nothing: every request is still authorized by the API.
 */
export const SESSION_HINT_COOKIE = 'ts_session';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

function baseOptions(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.auth.cookieSecure,
    sameSite: 'lax',
    domain: config.auth.cookieDomain,
  };
}

export function setAuthCookies(
  response: Response,
  config: AppConfig,
  tokens: { accessToken: string; refreshToken: string; userType: 'customer' | 'staff' },
): void {
  response.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(config),
    path: '/',
    maxAge: config.auth.accessTtlSeconds * 1000,
  });
  response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(config),
    path: REFRESH_COOKIE_PATH,
    maxAge: config.auth.refreshTtlDays * 86_400_000,
  });
  response.cookie(SESSION_HINT_COOKIE, tokens.userType, {
    ...baseOptions(config),
    httpOnly: false,
    path: '/',
    maxAge: config.auth.refreshTtlDays * 86_400_000,
  });
}

export function clearAuthCookies(response: Response, config: AppConfig): void {
  response.clearCookie(ACCESS_COOKIE, { ...baseOptions(config), path: '/' });
  response.clearCookie(REFRESH_COOKIE, { ...baseOptions(config), path: REFRESH_COOKIE_PATH });
  response.clearCookie(SESSION_HINT_COOKIE, { ...baseOptions(config), httpOnly: false, path: '/' });
}

export function setCartCookie(response: Response, config: AppConfig, token: string): void {
  response.cookie(CART_COOKIE, token, {
    ...baseOptions(config),
    path: '/',
    maxAge: 60 * 86_400_000,
  });
}

export function clearCartCookie(response: Response, config: AppConfig): void {
  response.clearCookie(CART_COOKIE, { ...baseOptions(config), path: '/' });
}

/** Anonymous assistant visitor (binds a guest's chat history to their browser). */
export const AI_VISITOR_COOKIE = 'ts_ai';

export function setAiVisitorCookie(response: Response, config: AppConfig, token: string): void {
  response.cookie(AI_VISITOR_COOKIE, token, {
    ...baseOptions(config),
    path: '/api/v1/ai',
    maxAge: 30 * 86_400_000,
  });
}
