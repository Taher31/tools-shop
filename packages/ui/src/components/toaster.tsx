'use client';

import { Toaster as SonnerToaster } from 'sonner';

export { toast } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      dir="rtl"
      position="top-center"
      richColors
      closeButton
      toastOptions={{ style: { fontFamily: 'var(--font-family-base)' } }}
    />
  );
}
