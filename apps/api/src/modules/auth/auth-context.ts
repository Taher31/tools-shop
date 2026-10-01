import type { Permission, UserType } from '@toolshop/shared';

/** The authenticated principal attached to a request. */
export interface AuthContext {
  userId: string;
  sessionId: string;
  type: UserType;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: ReadonlySet<Permission>;
}

export interface CachedPrincipal {
  type: UserType;
  isActive: boolean;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: Permission[];
}
