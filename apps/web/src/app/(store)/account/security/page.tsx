'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { type ChangePasswordInput, changePasswordSchema } from '@toolshop/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  toast,
} from '@toolshop/ui';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';

export default function SecurityPage() {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema) as never,
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const save = useMutation({
    mutationFn: (input: ChangePasswordInput) => api.post('/account/password', input),
    onSuccess: () => {
      toast.success('رمز عبور تغییر کرد. سایر دستگاه‌ها از حساب خارج شدند.');
      form.reset();
    },
    onError: (error) => applyApiError(form, error),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>تغییر رمز عبور</CardTitle>
        <CardDescription>
          پس از تغییر رمز، نشست‌های فعال روی سایر دستگاه‌ها بسته می‌شوند.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="max-w-sm space-y-4"
          noValidate
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
        >
          <Field
            label="رمز عبور فعلی"
            htmlFor="currentPassword"
            error={form.formState.errors.currentPassword?.message}
          >
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              {...form.register('currentPassword')}
            />
          </Field>
          <Field
            label="رمز عبور جدید"
            htmlFor="newPassword"
            error={form.formState.errors.newPassword?.message}
            hint="حداقل ۸ کاراکتر، شامل حروف و عدد"
          >
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              {...form.register('newPassword')}
            />
          </Field>
          <Button type="submit" loading={save.isPending}>
            تغییر رمز
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
