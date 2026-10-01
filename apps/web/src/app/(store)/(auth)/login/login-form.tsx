'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema } from '@toolshop/shared';
import { Button, Field, Input } from '@toolshop/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useLogin } from '@/hooks/use-auth';
import { applyApiError, safeNext } from '@/lib/forms';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const login = useLogin();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema) as never,
    defaultValues: { identifier: '', password: '' },
  });

  return (
    <>
      <h1 className="text-xl font-extrabold">ورود به حساب کاربری</h1>
      <p className="text-muted-foreground mb-6 mt-1 text-sm">با شماره موبایل یا ایمیل وارد شوید.</p>
      <form
        className="space-y-4"
        noValidate
        onSubmit={form.handleSubmit((values) =>
          login.mutate(values, {
            onSuccess: ({ user }) => {
              router.replace(next === '/' && user.type === 'staff' ? '/admin' : next);
              router.refresh();
            },
            onError: (error) => applyApiError(form, error),
          }),
        )}
      >
        <Field
          label="شماره موبایل یا ایمیل"
          htmlFor="identifier"
          error={form.formState.errors.identifier?.message}
        >
          <Input
            id="identifier"
            autoComplete="username"
            inputMode="email"
            dir="ltr"
            className="text-left"
            {...form.register('identifier')}
          />
        </Field>
        <Field label="رمز عبور" htmlFor="password" error={form.formState.errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            className="text-left"
            {...form.register('password')}
          />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={login.isPending}>
          ورود
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        حساب کاربری ندارید؟{' '}
        <Link
          href={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="text-info font-bold hover:underline"
        >
          ثبت‌نام کنید
        </Link>
      </p>
    </>
  );
}
