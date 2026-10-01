'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type AddressUpsertInput, addressUpsertSchema, type AddressView, IRAN_PROVINCE_NAMES } from '@toolshop/shared';
import { Button, Checkbox, Dialog, DialogContent, DialogHeader, DialogTitle, Field, Input, Label, NativeSelect, Textarea, toast } from '@toolshop/ui';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { api } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';

type AddressFormValues = z.input<typeof addressUpsertSchema>;

export function AddressDialog({
  open,
  onOpenChange,
  address,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address?: AddressView | null;
  onSaved?: (address: AddressView) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressUpsertSchema) as never,
    values: {
      title: address?.title ?? '',
      recipientName: address?.recipientName ?? '',
      recipientMobile: address?.recipientMobile ?? '',
      province: address?.province ?? 'تهران',
      city: address?.city ?? '',
      addressLine: address?.addressLine ?? '',
      plaque: address?.plaque ?? '',
      unit: address?.unit ?? '',
      postalCode: address?.postalCode ?? '',
      isDefault: address?.isDefault ?? false,
    },
  });
  const save = useMutation({
    mutationFn: (input: AddressUpsertInput) =>
      address ? api.put<AddressView>(`/account/addresses/${address.id}`, input) : api.post<AddressView>('/account/addresses', input),
    onSuccess: (saved) => {
      toast.success('آدرس ذخیره شد.');
      void queryClient.invalidateQueries({ queryKey: ['addresses'] });
      void queryClient.invalidateQueries({ queryKey: ['checkout'] });
      onSaved?.(saved);
      onOpenChange(false);
    },
    onError: (error) => applyApiError(form, error),
  });
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{address ? 'ویرایش آدرس' : 'افزودن آدرس جدید'}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3 sm:grid-cols-2"
          noValidate
          onSubmit={form.handleSubmit((values) => save.mutate(values as unknown as AddressUpsertInput))}
        >
          <Field label="عنوان آدرس" htmlFor="title" hint="مثلاً: کارگاه، منزل" error={errors.title?.message}>
            <Input id="title" {...form.register('title')} />
          </Field>
          <Field label="نام و نام خانوادگی گیرنده" htmlFor="recipientName" required error={errors.recipientName?.message}>
            <Input id="recipientName" autoComplete="name" {...form.register('recipientName')} />
          </Field>
          <Field label="موبایل گیرنده" htmlFor="recipientMobile" required error={errors.recipientMobile?.message}>
            <Input id="recipientMobile" type="tel" dir="ltr" className="text-left" {...form.register('recipientMobile')} />
          </Field>
          <Field label="استان" htmlFor="province" required error={errors.province?.message}>
            <NativeSelect id="province" {...form.register('province')}>
              {IRAN_PROVINCE_NAMES.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="شهر" htmlFor="city" required error={errors.city?.message}>
            <Input id="city" autoComplete="address-level2" {...form.register('city')} />
          </Field>
          <Field label="کد پستی" htmlFor="postalCode" required error={errors.postalCode?.message} hint="۱۰ رقم بدون خط تیره">
            <Input id="postalCode" inputMode="numeric" dir="ltr" className="text-left" {...form.register('postalCode')} />
          </Field>
          <Field label="نشانی کامل" htmlFor="addressLine" required error={errors.addressLine?.message} className="sm:col-span-2">
            <Textarea id="addressLine" rows={2} autoComplete="street-address" {...form.register('addressLine')} />
          </Field>
          <Field label="پلاک" htmlFor="plaque" error={errors.plaque?.message}>
            <Input id="plaque" {...form.register('plaque')} />
          </Field>
          <Field label="واحد" htmlFor="unit" error={errors.unit?.message}>
            <Input id="unit" {...form.register('unit')} />
          </Field>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox id="isDefault" checked={form.watch('isDefault') ?? false} onCheckedChange={(v) => form.setValue('isDefault', v === true)} />
            <Label htmlFor="isDefault" className="font-normal">
              آدرس پیش‌فرض
            </Label>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" loading={save.isPending}>
              ذخیره آدرس
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddressText({ address }: { address: Pick<AddressView, 'province' | 'city' | 'addressLine' | 'plaque' | 'unit' | 'postalCode' | 'recipientName' | 'recipientMobile'> }) {
  return (
    <div className="space-y-1 text-sm leading-7">
      <p>
        {address.province}، {address.city}، {address.addressLine}
        {address.plaque ? `، پلاک ${address.plaque}` : ''}
        {address.unit ? `، واحد ${address.unit}` : ''}
      </p>
      <p className="text-xs text-muted-foreground">
        گیرنده: {address.recipientName} · <span className="ltr">{address.recipientMobile}</span> · کد پستی: <span className="ltr">{address.postalCode}</span>
      </p>
    </div>
  );
}
