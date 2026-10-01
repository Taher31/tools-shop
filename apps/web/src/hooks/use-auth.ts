'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from '@toolshop/shared';
import { api, hasSessionHint } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

async function fetchMe(): Promise<AuthUser | null> {
  if (!hasSessionHint()) return null;
  try {
    return await api.get<AuthUser>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

export function useAuth() {
  const query = useQuery({ queryKey: AUTH_QUERY_KEY, queryFn: fetchMe, staleTime: 5 * 60_000 });
  return { user: query.data ?? null, isLoading: query.isLoading, refetch: query.refetch };
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<AuthResponse>('/auth/login', input),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user);
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
      void queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => api.post<AuthResponse>('/auth/register', input),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user);
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    onSettled: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
    },
  });
}
