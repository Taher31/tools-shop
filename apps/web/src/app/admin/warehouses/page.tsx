'use client';

import { useQuery } from '@tanstack/react-query';
import {
  IRAN_PROVINCE_NAMES,
  type WarehouseUpsertInput,
  type WarehouseView,
} from '@toolshop/shared';
import { Badge, Button, Field, Input, NativeSelect, Switch } from '@toolshop/ui';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { DataTable, TableCard } from '@/components/admin/data-table';
import { FormDialog } from '@/components/admin/form-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminMutation } from '@/components/admin/query';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { faNumber } from '@/lib/format';

type WarehouseForm = {
  code: string;
  name: string;
  province: string;
  city: string;
  address: string;
  phone: string;
  priority: number;
  isActive: boolean;
  isDefault: boolean;
};

export default function WarehousesPage() {
  const { can } = usePermissions();
  const list = useQuery({
    queryKey: ['admin', 'warehouses'],
    queryFn: () => api.get<WarehouseView[]>('/admin/warehouses'),
  });
  const [editing, setEditing] = useState<WarehouseView | null | undefined>(undefined);
  const form = useForm<WarehouseForm>({
    values: {
      code: editing?.code ?? '',
      name: editing?.name ?? '',
      province: editing?.province ?? '',
      city: editing?.city ?? '',
      address: editing?.address ?? '',
      phone: editing?.phone ?? '',
      priority: editing?.priority ?? 100,
      isActive: editing?.isActive ?? true,
      isDefault: editing?.isDefault ?? false,
    },
  });
  const save = useAdminMutation(
    (input: WarehouseUpsertInput) =>
      editing
        ? api.put(`/admin/warehouses/${editing.id}`, input)
        : api.post('/admin/warehouses', input),
    { success: 'انبار ذخیره شد.', onSuccess: () => setEditing(undefined) },
  );

  return (
    <>
      <PageHeader
        title="انبارها"
        description="اولویت کمتر = برداشت زودتر هنگام رزرو موجودی برای سفارش"
        actions={
          can('warehouse.manage') ? (
            <Button onClick={() => setEditing(null)}>
              <Plus /> انبار جدید
            </Button>
          ) : null
        }
      />
      <TableCard>
        <DataTable
          rows={list.data}
          loading={list.isLoading}
          rowKey={(w) => w.id}
          columns={[
            { header: 'کد', cell: (w) => <span className="ltr font-mono">{w.code}</span> },
            { header: 'نام', cell: (w) => <span className="font-semibold">{w.name}</span> },
            { header: 'محل', cell: (w) => [w.province, w.city].filter(Boolean).join('، ') || '—' },
            { header: 'اولویت', cell: (w) => faNumber(w.priority) },
            {
              header: 'وضعیت',
              cell: (w) => (
                <div className="flex gap-1">
                  {w.isActive ? <Badge variant="success">فعال</Badge> : <Badge>غیرفعال</Badge>}
                  {w.isDefault ? <Badge variant="info">پیش‌فرض</Badge> : null}
                </div>
              ),
            },
            {
              header: '',
              cell: (w) =>
                can('warehouse.manage') ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setEditing(w)}
                    aria-label="ویرایش"
                  >
                    <Pencil />
                  </Button>
                ) : null,
            },
          ]}
        />
      </TableCard>
      <FormDialog
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        title={editing ? 'ویرایش انبار' : 'انبار جدید'}
        loading={save.isPending}
        onSubmit={form.handleSubmit((v) =>
          save.mutate({
            ...v,
            province: v.province || null,
            city: v.city || null,
            address: v.address || null,
            phone: v.phone || null,
            priority: Number(v.priority) || 0,
          }),
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="کد" htmlFor="w-code" required hint="انگلیسی، مثال: MAIN">
            <Input id="w-code" dir="ltr" {...form.register('code')} />
          </Field>
          <Field label="نام" htmlFor="w-name" required>
            <Input id="w-name" {...form.register('name')} />
          </Field>
          <Field label="استان" htmlFor="w-prov">
            <NativeSelect id="w-prov" {...form.register('province')}>
              <option value="">—</option>
              {IRAN_PROVINCE_NAMES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="شهر" htmlFor="w-city">
            <Input id="w-city" {...form.register('city')} />
          </Field>
          <Field label="آدرس" htmlFor="w-addr" className="sm:col-span-2">
            <Input id="w-addr" {...form.register('address')} />
          </Field>
          <Field label="تلفن" htmlFor="w-phone">
            <Input id="w-phone" dir="ltr" {...form.register('phone')} />
          </Field>
          <Field label="اولویت برداشت" htmlFor="w-prio">
            <Input id="w-prio" type="number" dir="ltr" {...form.register('priority')} />
          </Field>
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={field.value} onCheckedChange={field.onChange} /> فعال
              </label>
            )}
          />
          <Controller
            control={form.control}
            name="isDefault"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={field.value} onCheckedChange={field.onChange} /> انبار پیش‌فرض
              </label>
            )}
          />
        </div>
      </FormDialog>
    </>
  );
}
