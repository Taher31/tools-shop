'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@toolshop/ui';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { useAuth } from './use-auth';

export function useWishlistIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wishlist', 'ids'],
    queryFn: () => api.get<string[]>('/account/wishlist/ids'),
    enabled: user?.type === 'customer',
  });
}

export function useToggleWishlist() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ productId, add }: { productId: string; add: boolean }) =>
      add ? api.put<string[]>(`/account/wishlist/${productId}`) : api.delete<string[]>(`/account/wishlist/${productId}`),
    onSuccess: (ids, { add }) => {
      queryClient.setQueryData(['wishlist', 'ids'], ids);
      void queryClient.invalidateQueries({ queryKey: ['wishlist', 'items'] });
      toast.success(add ? 'به علاقه‌مندی‌ها اضافه شد.' : 'از علاقه‌مندی‌ها حذف شد.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return {
    ...mutation,
    toggle: (productId: string, add: boolean) => {
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      mutation.mutate({ productId, add });
    },
  };
}
