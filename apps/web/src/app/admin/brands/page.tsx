'use client';

import { useQuery } from '@tanstack/react-query';
import type { AdminBrandView, BrandUpsertInput } from '@toolshop/shared';
import { Badge, Button, Field, Input, Switch, Textarea } from '@toolshop/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { DataTable, TableCard } from '@/components/admin/data-table';
import { FormDialog } from '@/components/admin/form-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminMutation } from '@/components/admin/query';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { faNumber } from '@/lib/format';

type BrandForm = { name: string; englishName: string; slug: string; country: string; website: string; description: string; isActive: boolean };

export default function BrandsPage() {
  const { can } = usePermissions();
  const brands = useQuery({ queryKey: ['admin', 'brands'], queryFn: () => api.get<AdminBrandView[]>('/admin/brands') });
  const [editing, setEditing] = useState<AdminBrandView | null | undefined>(undefined);
  const form = useForm<BrandForm>({
    values: {
      name: editing?.name ?? '',
      englishName: editing?.englishName ?? '',
      slug: editing?.slug ?? '',
      country: editing?.country ?? '',
      website: editing?.website ?? '',
      description: editing?.description ?? '',
      isActive: editing?.isActive ?? true,
    },
  });
  const save = useAdminMutation(
    (input: BrandUpsertInput) => (editing ? api.put(`/admin/brands/${editing.id}`, input) : api.post('/admin/brands', input)),
    { success: 'برند ذخیره شد.', onSuccess: () => setEditing(undefined) },
  );
  const remove = useAdminMutation((id: string) => api.delete(`/admin/brands/${id}`), { success: 'برند حذف شد.' });

  return (
    <>
      <PageHeader title="برندها" actions={can('brand.create') ? <Button onClick={() => setEditing(null)}><Plus /> برند جدید</Button> : null} />
      <TableCard>
        <DataTable
          rows={brands.data}
          loading={brands.isLoading}
          rowKey={(b) => b.id}
          columns={[
            { header: 'نام', cell: (b) => <span className="font-semibold">{b.name}</span> },
            { header: 'نام انگلیسی', cell: (b) => <span className="ltr">{b.englishName ?? '—'}</span> },
            { header: 'نامک', cell: (b) => <span className="ltr font-mono text-xs">{b.slug}</span> },
            { header: 'کشور', cell: (b) => b.country ?? '—' },
            { header: 'محصولات', cell: (b) => faNumber(b.productCount) },
            { header: 'وضعیت', cell: (b) => (b.isActive ? <Badge variant="success">فعال</Badge> : <Badge>غیرفعال</Badge>) },
            {
              header: '',
              cell: (b) => (
                <div className="flex justify-end gap-1">
                  {can('brand.update') ? <Button size="icon-sm" variant="ghost" onClick={() => setEditing(b)} aria-label="ویرایش"><Pencil /></Button> : null}
                  {can('brand.delete') ? (
                    <ConfirmButton size="icon-sm" variant="ghost" aria-label="حذف" title={`حذف برند «${b.name}»؟`} description="برندهای دارای محصول قابل حذف نیستند." onConfirm={() => remove.mutateAsync(b.id)}>
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
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        title={editing ? 'ویرایش برند' : 'برند جدید'}
        loading={save.isPending}
        onSubmit={form.handleSubmit((v) =>
          save.mutate({
            name: v.name,
            englishName: v.englishName || null,
            slug: v.slug || undefined,
            country: v.country || null,
            website: v.website || null,
            description: v.description || null,
            isActive: v.isActive,
            logoUrl: null,
            seoTitle: null,
            seoDescription: null,
          }),
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="نام" htmlFor="b-name" required><Input id="b-name" {...form.register('name')} /></Field>
          <Field label="نام انگلیسی" htmlFor="b-en"><Input id="b-en" dir="ltr" {...form.register('englishName')} /></Field>
          <Field label="نامک" htmlFor="b-slug" hint="خالی = خودکار"><Input id="b-slug" dir="ltr" {...form.register('slug')} /></Field>
          <Field label="کشور" htmlFor="b-country"><Input id="b-country" {...form.register('country')} /></Field>
          <Field label="وب‌سایت" htmlFor="b-web" className="sm:col-span-2"><Input id="b-web" dir="ltr" {...form.register('website')} /></Field>
          <Field label="توضیحات" htmlFor="b-desc" className="sm:col-span-2"><Textarea id="b-desc" rows={3} {...form.register('description')} /></Field>
          <Controller control={form.control} name="isActive" render={({ field }) => <label className="flex items-center gap-2 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} /> فعال</label>} />
        </div>
      </FormDialog>
    </>
  );
}
