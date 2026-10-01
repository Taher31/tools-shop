'use client';

import { hasPermission, type Permission } from '@toolshop/shared';
import { useAuth } from './use-auth';

/** UI-level permission checks (the API enforces them regardless). */
export function usePermissions() {
  const { user } = useAuth();
  const granted = new Set<string>(user?.permissions ?? []);
  return {
    can: (permission: Permission | Permission[]) => user?.type === 'staff' && hasPermission(granted, permission),
  };
}
