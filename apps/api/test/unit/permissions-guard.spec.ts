import { Controller, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@toolshop/shared';
import { describe, expect, it } from 'vitest';
import { AppException } from '../../src/common/errors/app-exception';
import type { AuthContext } from '../../src/modules/auth/auth-context';
import { AdminController, Public, RequirePermissions } from '../../src/modules/auth/decorators';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';

@AdminController('things')
class AdminThingsController {
  @Get()
  @RequirePermissions('order.read')
  list(): void {}

  @Get('refund')
  @RequirePermissions('order.read', 'payment.refund')
  refund(): void {}
}

@Controller('public')
class PublicController {
  @Get()
  @Public()
  index(): void {}
}

function contextFor(controller: object, handler: string, user?: Partial<AuthContext>) {
  const request = {
    user: user ? ({ type: 'staff', roles: [], ...user } as AuthContext) : undefined,
  };
  const prototype = Object.getPrototypeOf(controller) as Record<string, () => void>;
  return {
    getType: () => 'http',
    getHandler: () => prototype[handler],
    getClass: () => controller.constructor,
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

const guard = new PermissionsGuard(new Reflector());
const staff = (...permissions: Permission[]) => ({
  type: 'staff' as const,
  permissions: new Set(permissions),
});

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof AppException ? error.code : 'unexpected';
  }
  return undefined;
}

describe('PermissionsGuard', () => {
  const admin = new AdminThingsController();

  it('lets routes without permission metadata through', () => {
    expect(guard.canActivate(contextFor(new PublicController(), 'index'))).toBe(true);
  });

  it('requires authentication on admin routes', () => {
    expect(errorCode(() => guard.canActivate(contextFor(admin, 'list')))).toBe('UNAUTHENTICATED');
  });

  it('rejects customers even if they somehow carry permissions', () => {
    const customer = {
      type: 'customer' as const,
      permissions: new Set<Permission>(['order.read']),
    };
    expect(errorCode(() => guard.canActivate(contextFor(admin, 'list', customer)))).toBe(
      'FORBIDDEN',
    );
  });

  it('requires every declared permission', () => {
    expect(guard.canActivate(contextFor(admin, 'list', staff('order.read')))).toBe(true);
    expect(
      errorCode(() => guard.canActivate(contextFor(admin, 'refund', staff('order.read')))),
    ).toBe('FORBIDDEN');
    expect(
      guard.canActivate(contextFor(admin, 'refund', staff('order.read', 'payment.refund'))),
    ).toBe(true);
  });
});
