import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuthContext } from '../../modules/auth/auth-context';

export interface RequestContextData {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  user?: AuthContext;
}

const storage = new AsyncLocalStorage<RequestContextData>();

/**
 * Per-request context (request id, client ip, authenticated user) available to any
 * service without threading it through every call – used mainly by the audit log.
 */
export const RequestContext = {
  run<T>(data: RequestContextData, callback: () => T): T {
    return storage.run(data, callback);
  },
  get(): RequestContextData | undefined {
    return storage.getStore();
  },
  setUser(user: AuthContext | undefined): void {
    const store = storage.getStore();
    if (store) store.user = user;
  },
};
