import { cookies } from 'next/headers';
import { toApiError } from './errors';

const API_URL = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const DEFAULT_REVALIDATE = Number(process.env.CATALOG_REVALIDATE_SECONDS ?? 60);

interface ServerFetchOptions {
  /** Seconds the response may be served from the Next.js data cache (public data only). */
  revalidate?: number;
  tags?: string[];
  /** Forward the visitor's cookies (never cached). */
  withSession?: boolean;
}

/**
 * Server-side API access for React Server Components. Public catalog reads are cached
 * in the Next.js data cache; personalised reads forward cookies and are never cached.
 */
export async function serverApi<T>(path: string, options: ServerFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  let init: RequestInit & { next?: { revalidate?: number; tags?: string[] } };
  if (options.withSession) {
    headers.cookie = (await cookies()).toString();
    init = { headers, cache: 'no-store' };
  } else {
    init = { headers, next: { revalidate: options.revalidate ?? DEFAULT_REVALIDATE, tags: options.tags } };
  }
  const response = await fetch(`${API_URL}/api/v1${path}`, init);
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw toApiError(response.status, data);
  return data as T;
}

/** Same as serverApi but resolves to null on 404 (callers then render notFound()). */
export async function serverApiOrNull<T>(path: string, options: ServerFetchOptions = {}): Promise<T | null> {
  try {
    return await serverApi<T>(path, options);
  } catch (error) {
    if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) return null;
    throw error;
  }
}
