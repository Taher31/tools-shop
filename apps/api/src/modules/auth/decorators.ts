import {
  applyDecorators,
  Controller,
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Permission } from '@toolshop/shared';
import type { Request } from 'express';
import { AppException } from '../../common/errors/app-exception';
import type { AuthContext } from './auth-context';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const PERMISSIONS_KEY = 'auth:permissions';
export const STAFF_ONLY_KEY = 'auth:staffOnly';
export const ADMIN_CONTROLLER_KEY = 'auth:adminController';

export type AuthenticatedRequest = Request & { user?: AuthContext; id?: string | number };

/** Route is reachable without authentication (the user is still resolved if logged in). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Staff-only route that requires every listed permission. */
export const RequirePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(PERMISSIONS_KEY, permissions), SetMetadata(STAFF_ONLY_KEY, true));

/**
 * Admin controller mounted under /admin. Every handler of an admin controller MUST
 * declare @RequirePermissions – this is verified at application startup.
 */
export const AdminController = (path: string): ClassDecorator =>
  applyDecorators(
    Controller(`admin/${path}`),
    SetMetadata(STAFF_ONLY_KEY, true),
    SetMetadata(ADMIN_CONTROLLER_KEY, true),
  );

/** Injects the authenticated user; throws 401 when the route is public and nobody is logged in. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new AppException('UNAUTHENTICATED');
    return request.user;
  },
);

/** Injects the user if logged in, otherwise undefined (for public routes). */
export const OptionalUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
