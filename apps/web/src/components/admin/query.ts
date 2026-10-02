'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import type { Paginated } from '@toolshop/shared';
import { toast } from '@toolshop/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { api, toQueryString } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';

export type Params = Record<string, string | number | boolean | undefined>;

/** Paginated admin list with search and filters held in component state. */
export function useAdminList<T>(path: string, initial: Params = {}) {
  const [params, setParams] = useState<Params>({ page: 1, pageSize: 20, ...initial });
  const query = useQuery({
    queryKey: ['admin', path, params],
    queryFn: () => api.get<Paginated<T>>(`${path}${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  });
  const update = useCallback(
    (patch: Params) => setParams((current) => ({ ...current, page: 1, ...patch })),
    [],
  );
  const setPage = useCallback((page: number) => setParams((current) => ({ ...current, page })), []);
  const setSearch = useCallback((q: string) => update({ q: q || undefined }), [update]);
  const initialKey = JSON.stringify(initial);
  const reset = useCallback(
    () => setParams({ page: 1, pageSize: 20, ...(JSON.parse(initialKey) as Params) }),
    [initialKey],
  );
  return { ...query, params, update, setPage, setSearch, reset };
}

const PAGE_SIZE = 20;

/**
 * Paginated admin list whose filters live in the URL (shareable links, back/forward and
 * reload keep the view). A default that the user clears is written as an empty value
 * so "all" stays selected. Pages using it must render inside <Suspense>.
 */
export function useUrlList<T>(path: string, defaults: Params = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const defaultsKey = JSON.stringify(defaults);
  const params = useMemo<Params>(() => {
    const result: Params = { page: 1, pageSize: PAGE_SIZE, ...(JSON.parse(defaultsKey) as Params) };
    search.forEach((value, key) => {
      result[key] = key === 'page' || key === 'pageSize' ? Number(value) || 1 : value || undefined;
    });
    return result;
  }, [search, defaultsKey]);

  const query = useQuery({
    queryKey: ['admin', path, params],
    queryFn: () => api.get<Paginated<T>>(`${path}${toQueryString(params)}`),
    placeholderData: keepPreviousData,
  });

  const write = useCallback(
    (next: Params) => {
      const fallback = JSON.parse(defaultsKey) as Params;
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(next)) {
        if (key === 'page' && value === 1) continue;
        if (key === 'pageSize' && value === PAGE_SIZE) continue;
        const empty = value === undefined || value === '';
        if (empty) {
          if (fallback[key] !== undefined) qs.set(key, '');
          continue;
        }
        if (fallback[key] === value) continue;
        qs.set(key, String(value));
      }
      const target = qs.size > 0 ? `${pathname}?${qs.toString()}` : pathname;
      router.replace(target, { scroll: false });
    },
    [router, pathname, defaultsKey],
  );

  const update = useCallback(
    (patch: Params) => write({ ...params, ...patch, page: 1 }),
    [params, write],
  );
  const setPage = useCallback((page: number) => write({ ...params, page }), [params, write]);
  const setSearch = useCallback((q: string) => update({ q: q || undefined }), [update]);
  /** Back to the page's default view. */
  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);
  return { ...query, params, update, setPage, setSearch, reset };
}

export type UrlList = Pick<
  ReturnType<typeof useUrlList>,
  'params' | 'update' | 'setSearch' | 'reset'
>;

/** Mutation that toasts errors/success and invalidates admin queries. */
export function useAdminMutation<TInput, TResult = unknown>(
  request: (input: TInput) => Promise<TResult>,
  options: {
    success?: string;
    invalidate?: QueryKey[];
    onSuccess?: (result: TResult) => void;
  } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (result) => {
      if (options.success) toast.success(options.success);
      for (const key of options.invalidate ?? [['admin']])
        void queryClient.invalidateQueries({ queryKey: key });
      options.onSuccess?.(result);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
