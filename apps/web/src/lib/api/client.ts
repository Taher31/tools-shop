import { ApiError, toApiError } from './errors';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
}

let refreshing: Promise<boolean> | null = null;

export function hasSessionHint(): boolean {
  return typeof document !== 'undefined' && /(?:^|;\s*)ts_session=/.test(document.cookie);
}

export function sessionHintType(): 'customer' | 'staff' | null {
  if (typeof document === 'undefined') return null;
  const match = /(?:^|;\s*)ts_session=([^;]+)/.exec(document.cookie);
  return match?.[1] === 'staff' ? 'staff' : match?.[1] === 'customer' ? 'customer' : null;
}

/** Rotates the refresh token once for all concurrent requests that got a 401. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function request<T>(
  method: Method,
  path: string,
  options: RequestOptions = {},
  retry = true,
): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'same-origin',
    signal: options.signal,
    headers:
      options.body === undefined || isForm ? undefined : { 'content-type': 'application/json' },
    body:
      options.body === undefined
        ? undefined
        : isForm
          ? (options.body as FormData)
          : JSON.stringify(options.body),
  });

  if (response.status === 401 && retry && !path.startsWith('/auth/') && hasSessionHint()) {
    if (await refreshSession()) return request<T>(method, path, options, false);
  }
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw toApiError(response.status, data);
  return data as T;
}

/** Browser API client: same-origin (proxied by Next.js), cookies, automatic refresh. */
export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body: body ?? {} }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, { body: form }),
};

export function toQueryString(
  params: Record<string, string | number | boolean | string[] | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    )
      continue;
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export { ApiError };
