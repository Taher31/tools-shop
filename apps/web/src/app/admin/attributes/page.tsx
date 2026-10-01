'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ATTRIBUTE_TYPE_LABELS,
  ATTRIBUTE_TYPES,
  type AttributeType,
  type AttributeUpsertInput,
  type AttributeView,
} from '@toolshop/shared';
import { Badge, Button, Field, Input, NativeSelect, Switch } from '@toolshop/ui';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { DataTable, TableCard } from '@/components/admin/data-table';
import { FormDialog } from '@/components/admin/form-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminMutation } from '@/components/admin/query';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { faNumber } from '@/lib/format';

type Row = AttributeView & { usage: { categories: number; products: number } };
interface AttributeForm {
  code: string;
  name: string;
  type: AttributeType;
  unit: string;
  groupName: string;
  isFilterable: boolean;
  isSearchable: boolean;
  isComparable: boolean;
  sortOrder: number;
  options: { value: string; label: string }[];
}

export default function AttributesPage() {
  const { can } = usePermissions();
  const list = useQuery({
    queryKey: ['admin', 'attributes'],
    queryFn: () => api.get<Row[]>('/admin/attributes'),
  });
  const [editing, setEditing] = useState<Row | null | undefined>(undefined);
  const form = useForm<AttributeForm>({
    values: {
      code: editing?.code ?? '',
      name: editing?.name ?? '',
      type: editing?.type ?? 'number',
      unit: editing?.unit ?? '',
      groupName: editing?.groupName ?? '',
      isFilterable: editing?.isFilterable ?? false,
      isSearchable: editing?.isSearchable ?? true,
      isComparable: editing?.isComparable ?? true,
      sortOrder: editing?.sortOrder ?? 0,
      options: editing?.options.map((o) => ({ value: o.value, label: o.label })) ?? [],
    },
  });
  const options = useFieldArray({ control: form.control, name: 'options' });
  const type = useWatch({ control: form.control, name: 'type' });
  const save = useAdminMutation(
    (input: AttributeUpsertInput) =>
      editing
        ? api.put(`/admin/attributes/${editing.id}`, input)
        : api.post('/admin/attributes', input),
    { success: 'ویژگی ذخیره شد.', onSuccess: () => setEditing(undefined) },
  );
  const remove = useAdminMutation((id: string) => api.delete(`/admin/attributes/${id}`), {
    success: 'ویژگی حذف شد.',
  });

  return (
    <>
      <PageHeader
        title="ویژگی‌های فنی"
        description="تعریف مشخصات فنی (توان، ولتاژ، قطر سه‌نظام…) بدون نیاز به تغییر ساختار دیتابیس"
        actions={
          can('attribute.create') ? (
            <Button onClick={() => setEditing(null)}>
              <Plus /> ویژگی جدید
            </Button>
          ) : null
        }
      />
      <TableCard>
        <DataTable
          rows={list.data}
          loading={list.isLoading}
          rowKey={(a) => a.id}
          columns={[
            { header: 'نام', cell: (a) => <span className="font-semibold">{a.name}</span> },
            { header: 'کد', cell: (a) => <span className="ltr font-mono text-xs">{a.code}</span> },
            { header: 'نوع', cell: (a) => ATTRIBUTE_TYPE_LABELS[a.type] },
            { header: 'واحد', cell: (a) => a.unit ?? '—' },
            { header: 'گروه', cell: (a) => <span className="text-xs">{a.groupName ?? '—'}</span> },
            {
              header: 'فیلتر',
              cell: (a) => (a.isFilterable ? <Badge variant="info">بله</Badge> : '—'),
            },
            {
              header: 'استفاده',
              cell: (a) => (
                <span className="text-xs">
                  {faNumber(a.usage.categories)} دسته / {faNumber(a.usage.products)} محصول
                </span>
              ),
            },
            {
              header: '',
              cell: (a) => (
                <div className="flex justify-end gap-1">
                  {can('attribute.update') ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setEditing(a)}
                      aria-label="ویرایش"
                    >
                      <Pencil />
                    </Button>
                  ) : null}
                  {can('attribute.delete') ? (
                    <ConfirmButton
                      size="icon-sm"
                      variant="ghost"
                      aria-label="حذف"
                      title={`حذف ویژگی «${a.name}»؟`}
                      onConfirm={() => remove.mutateAsync(a.id)}
                    >
                      <Trash2 className="text-destructive" />
                    </ConfirmButton>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      </TableCard>
      <FormDialog
        wide
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        title={editing ? 'ویرایش ویژگی' : 'ویژگی جدید'}
        loading={save.isPending}
        onSubmit={form.handleSubmit((v) =>
          save.mutate({
            ...v,
            unit: v.unit || null,
            groupName: v.groupName || null,
            description: null,
            sortOrder: Number(v.sortOrder) || 0,
            options:
              v.type === 'select' || v.type === 'multiselect'
                ? v.options.map((o, i) => ({ ...o, sortOrder: i }))
                : [],
          }),
        )}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="نام فارسی" htmlFor="a-name" required>
            <Input id="a-name" {...form.register('name')} />
          </Field>
          <Field label="کد (انگلیسی)" htmlFor="a-code" required hint="مثال: chuck_size_mm">
            <Input id="a-code" dir="ltr" {...form.register('code')} />
          </Field>
          <Field label="نوع" htmlFor="a-type">
            <NativeSelect
              id="a-type"
              {...form.register('type')}
              disabled={Boolean(editing && editing.usage.products > 0)}
            >
              {ATTRIBUTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ATTRIBUTE_TYPE_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="واحد" htmlFor="a-unit">
            <Input id="a-unit" placeholder="وات، ولت، میلی‌متر…" {...form.register('unit')} />
          </Field>
          <Field label="گروه نمایش" htmlFor="a-group">
            <Input id="a-group" placeholder="موتور و عملکرد" {...form.register('groupName')} />
          </Field>
          <Field label="ترتیب" htmlFor="a-sort">
            <Input id="a-sort" type="number" dir="ltr" {...form.register('sortOrder')} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-5 text-sm">
          {(['isFilterable', 'isSearchable', 'isComparable'] as const).map((key) => (
            <Controller
              key={key}
              control={form.control}
              name={key}
              render={({ field }) => (
                <label className="flex items-center gap-2">
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                  {
                    {
                      isFilterable: 'قابل فیلتر',
                      isSearchable: 'قابل جستجو',
                      isComparable: 'در مقایسه',
                    }[key]
                  }
                </label>
              )}
            />
          ))}
        </div>
        {type === 'select' || type === 'multiselect' ? (
          <div className="border-border space-y-2 rounded-md border p-3">
            <p className="text-sm font-bold">گزینه‌ها</p>
            {options.fields.map((option, index) => (
              <div key={option.id} className="flex gap-2">
                <Input
                  placeholder="مقدار (انگلیسی)"
                  dir="ltr"
                  className="h-9"
                  {...form.register(`options.${index}.value`)}
                />
                <Input
                  placeholder="برچسب فارسی"
                  className="h-9"
                  {...form.register(`options.${index}.label`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => options.remove(index)}
                  aria-label="حذف گزینه"
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => options.append({ value: '', label: '' })}
            >
              <Plus /> افزودن گزینه
            </Button>
          </div>
        ) : null}
      </FormDialog>
    </>
  );
}
