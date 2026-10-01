'use client';

import { useQuery } from '@tanstack/react-query';
import { IRAN_PROVINCE_NAMES, type ShippingMethodUpsertInput, type ShippingMethodView } from '@toolshop/shared';
import { Badge, Button, Checkbox, Field, Input, Switch } from '@toolshop/ui';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { DataTable, TableCard } from '@/components/admin/data-table';
import { FormDialog } from '@/components/admin/form-dialog';
import { MoneyInput } from '@/components/admin/money-input';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminMutation } from '@/components/admin/query';
import { api } from '@/lib/api/client';
import { faNumber, price } from '@/lib/format';

interface ShippingForm {
  code: string;
  name: string;
  description: string;
  baseCost: number | null;
  freeShippingThreshold: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  provinces: string[];
  isActive: boolean;
  sortOrder: number;
}

export default function ShippingPage() {
  const list = useQuery({ queryKey: ['admin', 'shipping'], queryFn: () => api.get<ShippingMethodView[]>('/admin/shipping-methods') });
  const [editing, setEditing] = useState<ShippingMethodView | null | undefined>(undefined);
  const form = useForm<ShippingForm>({
    values: {
      code: editing?.code ?? '',
      name: editing?.name ?? '',
      description: editing?.description ?? '',
      baseCost: editing?.baseCost ?? 0,
      freeShippingThreshold: editing?.freeShippingThreshold ?? null,
      estimatedDaysMin: editing?.estimatedDaysMin ?? 1,
      estimatedDaysMax: editing?.estimatedDaysMax ?? 3,
      provinces: editing?.provinces ?? [],
      isActive: editing?.isActive ?? true,
      sortOrder: editing?.sortOrder ?? 0,
    },
  });
  const save = useAdminMutation(
    (input: ShippingMethodUpsertInput) => (editing ? api.put(`/admin/shipping-methods/${editing.id}`, input) : api.post('/admin/shipping-methods', input)),
    { success: 'روش ارسال ذخیره شد.', onSuccess: () => setEditing(undefined) },
  );

  return (
    <>
      <PageHeader title="روش‌های ارسال" actions={<Button onClick={() => setEditing(null)}><Plus /> روش جدید</Button>} />
      <TableCard>
        <DataTable
          rows={list.data}
          loading={list.isLoading}
          rowKey={(m) => m.id}
          columns={[
            { header: 'نام', cell: (m) => <span className="font-semibold">{m.name}</span> },
            { header: 'هزینه پایه', cell: (m) => (m.baseCost === 0 ? 'رایگان / پس‌کرایه' : price(m.baseCost)) },
            { header: 'ارسال رایگان از', cell: (m) => (m.freeShippingThreshold ? price(m.freeShippingThreshold) : '—') },
            { header: 'زمان تحویل', cell: (m) => `${faNumber(m.estimatedDaysMin)}–${faNumber(m.estimatedDaysMax)} روز` },
            { header: 'محدوده', cell: (m) => <span className="text-xs">{m.provinces.length === 0 ? 'سراسر کشور' : m.provinces.join('، ')}</span> },
            { header: 'وضعیت', cell: (m) => (m.isActive ? <Badge variant="success">فعال</Badge> : <Badge>غیرفعال</Badge>) },
            { header: '', cell: (m) => <Button size="icon-sm" variant="ghost" onClick={() => setEditing(m)} aria-label="ویرایش"><Pencil /></Button> },
          ]}
        />
      </TableCard>
      <FormDialog
        wide
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        title={editing ? 'ویرایش روش ارسال' : 'روش ارسال جدید'}
        loading={save.isPending}
        onSubmit={form.handleSubmit((v) =>
          save.mutate({
            ...v,
            description: v.description || null,
            baseCost: v.baseCost ?? 0,
            estimatedDaysMin: Number(v.estimatedDaysMin),
            estimatedDaysMax: Number(v.estimatedDaysMax),
            sortOrder: Number(v.sortOrder) || 0,
          }),
        )}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="کد" htmlFor="s-code" required><Input id="s-code" dir="ltr" {...form.register('code')} /></Field>
          <Field label="نام" htmlFor="s-name" required className="sm:col-span-2"><Input id="s-name" {...form.register('name')} /></Field>
          <Field label="هزینه پایه"><Controller control={form.control} name="baseCost" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} /></Field>
          <Field label="ارسال رایگان برای خرید بالای"><Controller control={form.control} name="freeShippingThreshold" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} /></Field>
          <Field label="ترتیب" htmlFor="s-sort"><Input id="s-sort" type="number" dir="ltr" {...form.register('sortOrder')} /></Field>
          <Field label="حداقل روز" htmlFor="s-min"><Input id="s-min" type="number" dir="ltr" {...form.register('estimatedDaysMin')} /></Field>
          <Field label="حداکثر روز" htmlFor="s-max"><Input id="s-max" type="number" dir="ltr" {...form.register('estimatedDaysMax')} /></Field>
          <Controller control={form.control} name="isActive" render={({ field }) => <label className="flex items-center gap-2 self-end pb-2 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} /> فعال</label>} />
          <Field label="توضیحات" htmlFor="s-desc" className="sm:col-span-3"><Input id="s-desc" {...form.register('description')} /></Field>
        </div>
        <Controller
          control={form.control}
          name="provinces"
          render={({ field }) => (
            <Field label="استان‌های تحت پوشش (هیچ‌کدام = سراسر کشور)">
              <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-4">
                {IRAN_PROVINCE_NAMES.map((province) => (
                  <label key={province} className="flex items-center gap-1.5 text-xs">
                    <Checkbox checked={field.value.includes(province)} onCheckedChange={(c) => field.onChange(c ? [...field.value, province] : field.value.filter((p) => p !== province))} />
                    {province}
                  </label>
                ))}
              </div>
            </Field>
          )}
        />
      </FormDialog>
    </>
  );
}
