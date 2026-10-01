'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CartView } from '@toolshop/shared';
import { toast } from '@toolshop/ui';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';

export const CART_QUERY_KEY = ['cart'] as const;

export function useCart() {
  return useQuery({ queryKey: CART_QUERY_KEY, queryFn: () => api.get<CartView>('/cart'), staleTime: 10_000 });
}

function useCartMutation<TInput>(request: (input: TInput) => Promise<CartView>, successMessage?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (cart) => {
      queryClient.setQueryData(CART_QUERY_KEY, cart);
      if (successMessage) toast.success(successMessage);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useAddToCart() {
  return useCartMutation(
    (input: { variantId: string; quantity: number }) => api.post<CartView>('/cart/items', input),
    'به سبد خرید اضافه شد.',
  );
}

export function useUpdateCartItem() {
  return useCartMutation((input: { itemId: string; quantity: number }) =>
    api.patch<CartView>(`/cart/items/${input.itemId}`, { quantity: input.quantity }),
  );
}

export function useRemoveCartItem() {
  return useCartMutation((itemId: string) => api.delete<CartView>(`/cart/items/${itemId}`), 'از سبد خرید حذف شد.');
}

export function useApplyCoupon() {
  return useCartMutation((code: string) => api.post<CartView>('/cart/coupon', { code }), 'کد تخفیف اعمال شد.');
}

export function useRemoveCoupon() {
  return useCartMutation(() => api.delete<CartView>('/cart/coupon'));
}
