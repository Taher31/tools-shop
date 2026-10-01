import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission, type Permission } from '@toolshop/shared';
import { AppException } from '../../../common/errors/app-exception';
import { type AuthenticatedRequest, PERMISSIONS_KEY, STAFF_ONLY_KEY } from '../decorators';

/** RBAC: staff-only routes require a staff user holding every declared permission. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    const staffOnly = this.reflector.getAllAndOverride<boolean>(STAFF_ONLY_KEY, targets) ?? false;
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, targets) ?? [];
    if (!staffOnly && required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw new AppException('UNAUTHENTICATED');
    if (user.type !== 'staff') throw new AppException('FORBIDDEN');
    if (!hasPermission(user.permissions, required)) throw new AppException('FORBIDDEN');
    return true;
  }
}
