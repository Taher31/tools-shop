import { z } from 'zod';
import { emailSchema, mobileSchema, textSchema } from './common';
import { isValidNationalCode, normalizeIranianMobile } from '../iran/validators';
import { toEnglishDigits } from '../text/persian';

export const passwordSchema = z
  .string()
  .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد.')
  .max(128, 'رمز عبور بیش از حد طولانی است.')
  .refine((value) => /\p{L}/u.test(value) && /\d|[۰-۹]/.test(value), {
    message: 'رمز عبور باید شامل حروف و عدد باشد.',
  });

/** Login identifier: an Iranian mobile number or an e-mail address. */
export const loginIdentifierSchema = z
  .string()
  .trim()
  .min(3, 'موبایل یا ایمیل را وارد کنید.')
  .max(200)
  .transform((value) => normalizeIranianMobile(value) ?? value.toLowerCase());

export const loginSchema = z.object({
  identifier: loginIdentifierSchema,
  password: z.string().min(1, 'رمز عبور را وارد کنید.').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  firstName: textSchema({ max: 80 }),
  lastName: textSchema({ max: 80 }),
  mobile: mobileSchema,
  email: emailSchema.optional().or(z.literal('').transform(() => undefined)),
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const updateProfileSchema = z.object({
  firstName: textSchema({ max: 80 }),
  lastName: textSchema({ max: 80 }),
  email: emailSchema.nullish().or(z.literal('').transform(() => null)),
  nationalCode: z
    .string()
    .transform((value) => toEnglishDigits(value).trim())
    .refine((value) => value === '' || isValidNationalCode(value), 'کد ملی معتبر نیست.')
    .nullish()
    .transform((value) => value || null),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
