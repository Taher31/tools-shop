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
import { useCallback, useState } from 'react';
import { api, toQueryString } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';

type Params = Record<string, string | number | boolean | undefined>;

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
  return { ...query, params, update, setPage, setSearch };
}

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
