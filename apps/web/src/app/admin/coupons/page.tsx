'use client';

import {
  COUPON_TYPE_LABELS,
  COUPON_TYPES,
  type CouponType,
  type CouponUpsertInput,
  type CouponView,
} from '@toolshop/shared';
import { Badge, Button, Field, Input, NativeSelect, Switch } from '@toolshop/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { DataTable, Pager, SearchInput, TableCard } from '@/components/admin/data-table';
import { FormDialog } from '@/components/admin/form-dialog';
import { MoneyInput } from '@/components/admin/money-input';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminList, useAdminMutation } from '@/components/admin/query';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { date, faNumber, price } from '@/lib/format';

interface CouponForm {
  code: string;
  description: string;
  type: CouponType;
  percent: string;
  fixed: number | null;
  maxDiscount: number | null;
  minSubtotal: number | null;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perCustomerLimit: string;
  isActive: boolean;
}

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

export default function CouponsPage() {
  const { can } = usePermissions();
  const list = useAdminList<CouponView>('/admin/coupons');
  const [editing, setEditing] = useState<CouponView | null | undefined>(undefined);
  const form = useForm<CouponForm>({
    values: {
      code: editing?.code ?? '',
      description: editing?.description ?? '',
      type: editing?.type ?? 'percent',
      percent: editing?.type === 'percent' ? String(editing.value) : '10',
      fixed: editing?.type === 'fixed' ? editing.value : null,
      maxDiscount: editing?.maxDiscount ?? null,
      minSubtotal: editing?.minSubtotal ?? null,
      startsAt: toDateInput(editing?.startsAt ?? null),
      endsAt: toDateInput(editing?.endsAt ?? null),
      usageLimit: editing?.usageLimit ? String(editing.usageLimit) : '',
      perCustomerLimit: editing?.perCustomerLimit ? String(editing.perCustomerLimit) : '',
      isActive: editing?.isActive ?? true,
    },
  });
  const type = form.watch('type');
  const save = useAdminMutation(
    (input: CouponUpsertInput) =>
      editing ? api.put(`/admin/coupons/${editing.id}`, input) : api.post('/admin/coupons', input),
    { success: 'کد تخفیف ذخیره شد.', onSuccess: () => setEditing(undefined) },
  );
  const remove = useAdminMutation((id: string) => api.delete(`/admin/coupons/${id}`), {
    success: 'کد تخفیف حذف/غیرفعال شد.',
  });

  return (
    <>
      <PageHeader
        title="کدهای تخفیف"
        actions={
          can('coupon.manage') ? (
            <Button onClick={() => setEditing(null)}>
              <Plus /> کد جدید
            </Button>
          ) : null
        }
      />
      <TableCard
        toolbar={<SearchInput onSearch={list.setSearch} placeholder="جستجوی کد" className="w-56" />}
      >
        <DataTable
          rows={list.data?.items}
          loading={list.isLoading}
          rowKey={(c) => c.id}
          columns={[
            {
              header: 'کد',
              cell: (c) => <span className="ltr font-mono font-bold">{c.code}</span>,
            },
            { header: 'نوع', cell: (c) => COUPON_TYPE_LABELS[c.type] },
            {
              header: 'مقدار',
              cell: (c) =>
                c.type === 'percent'
                  ? `٪${faNumber(c.value)}`
                  : c.type === 'fixed'
                    ? price(c.value)
                    : '—',
            },
            { header: 'حداقل خرید', cell: (c) => (c.minSubtotal ? price(c.minSubtotal) : '—') },
            {
              header: 'استفاده',
              cell: (c) =>
                `${faNumber(c.usedCount)}${c.usageLimit ? ` از ${faNumber(c.usageLimit)}` : ''}`,
            },
            {
              header: 'اعتبار',
              cell: (c) => (
                <span className="text-xs">{c.endsAt ? `تا ${date(c.endsAt)}` : 'بدون انقضا'}</span>
              ),
            },
            {
              header: 'وضعیت',
              cell: (c) =>
                c.isActive ? <Badge variant="success">فعال</Badge> : <Badge>غیرفعال</Badge>,
            },
            {
              header: '',
              cell: (c) =>
                can('coupon.manage') ? (
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setEditing(c)}
                      aria-label="ویرایش"
                    >
                      <Pencil />
                    </Button>
                    <ConfirmButton
                      size="icon-sm"
                      variant="ghost"
                      aria-label="حذف"
                      title={`حذف کد ${c.code}؟`}
                      description="کدهای استفاده‌شده غیرفعال می‌شوند تا سوابق حفظ شود."
                      onConfirm={() => remove.mutateAsync(c.id)}
                    >
                      <Trash2 className="text-destructive" />
                    </ConfirmButton>
                  </div>
                ) : null,
            },
          ]}
        />
        <Pager data={list.data} onPage={list.setPage} />
      </TableCard>
      <FormDialog
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        title={editing ? 'ویرایش کد تخفیف' : 'کد تخفیف جدید'}
        loading={save.isPending}
        onSubmit={form.handleSubmit((v) =>
          save.mutate({
            code: v.code,
            description: v.description || null,
            type: v.type,
            value:
              v.type === 'percent' ? Number(v.percent) : v.type === 'fixed' ? (v.fixed ?? 0) : 0,
            maxDiscount: v.maxDiscount,
            minSubtotal: v.minSubtotal,
            startsAt: v.startsAt ? new Date(v.startsAt) : null,
            endsAt: v.endsAt ? new Date(`${v.endsAt}T23:59:59`) : null,
            usageLimit: v.usageLimit ? Number(v.usageLimit) : null,
            perCustomerLimit: v.perCustomerLimit ? Number(v.perCustomerLimit) : null,
            isActive: v.isActive,
          }),
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="کد" htmlFor="cp-code" required>
            <Input id="cp-code" dir="ltr" className="uppercase" {...form.register('code')} />
          </Field>
          <Field label="نوع" htmlFor="cp-type">
            <NativeSelect id="cp-type" {...form.register('type')}>
              {COUPON_TYPES.map((t) => (
                <option key={t} value={t}>
                  {COUPON_TYPE_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {type === 'percent' ? (
            <Field label="درصد تخفیف" htmlFor="cp-pct">
              <Input
                id="cp-pct"
                type="number"
                min={1}
                max={100}
                dir="ltr"
                {...form.register('percent')}
              />
            </Field>
          ) : type === 'fixed' ? (
            <Field label="مبلغ تخفیف">
              <Controller
                control={form.control}
                name="fixed"
                render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />}
              />
            </Field>
          ) : null}
          {type === 'percent' ? (
            <Field label="سقف تخفیف">
              <Controller
                control={form.control}
                name="maxDiscount"
                render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />}
              />
            </Field>
          ) : null}
          <Field label="حداقل مبلغ خرید">
            <Controller
              control={form.control}
              name="minSubtotal"
              render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />}
            />
          </Field>
          <Field label="از تاریخ" htmlFor="cp-start">
            <Input id="cp-start" type="date" dir="ltr" {...form.register('startsAt')} />
          </Field>
          <Field label="تا تاریخ" htmlFor="cp-end">
            <Input id="cp-end" type="date" dir="ltr" {...form.register('endsAt')} />
          </Field>
          <Field label="سقف کل استفاده" htmlFor="cp-limit">
            <Input id="cp-limit" type="number" dir="ltr" {...form.register('usageLimit')} />
          </Field>
          <Field label="سقف استفاده هر مشتری" htmlFor="cp-plimit">
            <Input id="cp-plimit" type="number" dir="ltr" {...form.register('perCustomerLimit')} />
          </Field>
          <Field label="توضیحات" htmlFor="cp-desc" className="sm:col-span-2">
            <Input id="cp-desc" {...form.register('description')} />
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
        </div>
      </FormDialog>
    </>
  );
}
