'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configurePersianValidation } from '@toolshop/shared';
import { DirectionProvider, Toaster } from '@toolshop/ui';
import { type ReactNode, useState } from 'react';
import { ApiError } from '@/lib/api/errors';

configurePersianValidation();

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <DirectionProvider dir="rtl">
        {children}
        <Toaster />
      </DirectionProvider>
    </QueryClientProvider>
  );
}
