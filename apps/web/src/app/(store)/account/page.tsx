'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type AuthUser, type UpdateProfileInput, updateProfileSchema } from '@toolshop/shared';
import { Button, Card, CardContent, CardHeader, CardTitle, Field, Input, toast } from '@toolshop/ui';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { AUTH_QUERY_KEY, useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';

type ProfileForm = z.input<typeof updateProfileSchema>;

export default function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const form = useForm<ProfileForm>({
    resolver: zodResolver(updateProfileSchema) as never,
    values: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
      nationalCode: user?.nationalCode ?? '',
    },
  });
  const save = useMutation({
    mutationFn: (input: UpdateProfileInput) => api.put<AuthUser>('/account/profile', input),
    onSuccess: (updated) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, updated);
      toast.success('اطلاعات حساب ذخیره شد.');
    },
    onError: (error) => applyApiError(form, error),
  });
  const errors = form.formState.errors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>اطلاعات حساب کاربری</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid max-w-2xl gap-4 sm:grid-cols-2" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v as unknown as UpdateProfileInput))}>
          <Field label="نام" htmlFor="firstName" required error={errors.firstName?.message}>
            <Input id="firstName" {...form.register('firstName')} />
          </Field>
          <Field label="نام خانوادگی" htmlFor="lastName" required error={errors.lastName?.message}>
            <Input id="lastName" {...form.register('lastName')} />
          </Field>
          <Field label="شماره موبایل" hint="برای تغییر شماره موبایل با پشتیبانی تماس بگیرید.">
            <Input value={user?.mobile ?? ''} disabled dir="ltr" className="text-left" />
          </Field>
          <Field label="ایمیل" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" dir="ltr" className="text-left" {...form.register('email')} />
          </Field>
          <Field label="کد ملی" htmlFor="nationalCode" hint="برای صدور فاکتور رسمی" error={errors.nationalCode?.message}>
            <Input id="nationalCode" inputMode="numeric" dir="ltr" className="text-left" {...form.register('nationalCode')} />
          </Field>
          <div className="flex items-end sm:col-span-2">
            <Button type="submit" loading={save.isPending}>
              ذخیره تغییرات
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
