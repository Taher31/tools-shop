import { toast } from '@toolshop/ui';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { ApiError, errorMessage } from './api/errors';

/** Puts API validation errors on the matching form fields; anything else becomes a toast. */
export function applyApiError<T extends FieldValues>(form: UseFormReturn<T>, error: unknown): void {
  if (error instanceof ApiError && error.details.length > 0) {
    let matched = false;
    for (const detail of error.details) {
      if (detail.path && detail.path !== '_' && detail.path in form.getValues()) {
        form.setError(detail.path as Path<T>, { message: detail.message });
        matched = true;
      }
    }
    if (matched) return;
  }
  toast.error(errorMessage(error));
}

/** Only allow same-site relative redirects after login (prevents open redirects). */
export function safeNext(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
