'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type RegisterInput, registerSchema } from '@toolshop/shared';
import { Button, Field, Input } from '@toolshop/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useRegister } from '@/hooks/use-auth';
import { applyApiError, safeNext } from '@/lib/forms';

type RegisterForm = z.input<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const register = useRegister();
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema) as never,
    defaultValues: { firstName: '', lastName: '', mobile: '', email: '', password: '' },
  });
  const errors = form.formState.errors;

  return (
    <>
      <h1 className="text-xl font-extrabold">ایجاد حساب کاربری</h1>
      <p className="text-muted-foreground mb-6 mt-1 text-sm">
        برای ثبت سفارش و پیگیری آن، حساب کاربری بسازید.
      </p>
      <form
        className="space-y-4"
        noValidate
        onSubmit={form.handleSubmit((values) =>
          register.mutate(values as unknown as RegisterInput, {
            onSuccess: () => {
              router.replace(next);
              router.refresh();
            },
            onError: (error) => applyApiError(form, error),
          }),
        )}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="نام" htmlFor="firstName" required error={errors.firstName?.message}>
            <Input id="firstName" autoComplete="given-name" {...form.register('firstName')} />
          </Field>
          <Field label="نام خانوادگی" htmlFor="lastName" required error={errors.lastName?.message}>
            <Input id="lastName" autoComplete="family-name" {...form.register('lastName')} />
          </Field>
        </div>
        <Field
          label="شماره موبایل"
          htmlFor="mobile"
          required
          error={errors.mobile?.message}
          hint="مثال: ۰۹۱۲۱۲۳۴۵۶۷"
        >
          <Input
            id="mobile"
            type="tel"
            autoComplete="tel"
            dir="ltr"
            className="text-left"
            {...form.register('mobile')}
          />
        </Field>
        <Field label="ایمیل (اختیاری)" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            className="text-left"
            {...form.register('email')}
          />
        </Field>
        <Field
          label="رمز عبور"
          htmlFor="password"
          required
          error={errors.password?.message}
          hint="حداقل ۸ کاراکتر، شامل حروف و عدد"
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            className="text-left"
            {...form.register('password')}
          />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={register.isPending}>
          ثبت‌نام
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        قبلاً ثبت‌نام کرده‌اید؟{' '}
        <Link
          href={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="text-info font-bold hover:underline"
        >
          وارد شوید
        </Link>
      </p>
    </>
  );
}
