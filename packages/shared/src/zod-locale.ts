import { z } from 'zod';
import { fa } from 'zod/locales';

/** Switches zod's default validation messages to Persian. Call once per runtime. */
export function configurePersianValidation(): void {
  z.config(fa());
}
