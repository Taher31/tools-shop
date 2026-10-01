'use client';

import { useQuery } from '@tanstack/react-query';
import type { AdminCategoryView, AttributeView, CategoryUpsertInput } from '@toolshop/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  cn,
  EmptyState,
  Field,
  Input,
  NativeSelect,
  Switch,
  Textarea,
} from '@toolshop/ui';
import { ChevronDown, ChevronLeft, FolderTree, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminMutation } from '@/components/admin/query';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { faNumber } from '@/lib/format';

function flatten(
  nodes: AdminCategoryView[],
  depth = 0,
): { node: AdminCategoryView; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flatten(node.children as AdminCategoryView[], depth + 1),
  ]);
}

function TreeItem({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: AdminCategoryView;
  depth: number;
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const children = node.children as AdminCategoryView[];
  return (
    <li>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md px-2 py-1.5 text-sm',
          selected === node.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn('size-5', children.length === 0 && 'invisible')}
          aria-label="باز/بسته"
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-between text-start"
          onClick={() => onSelect(node.id)}
        >
          <span className={cn(!node.isActive && 'line-through opacity-60')}>{node.name}</span>
          <span className="text-xs opacity-70">{faNumber(node.productCount)}</span>
        </button>
      </div>
      {open && children.length > 0 ? (
        <ul className="border-border ms-4 border-s ps-1">
          {children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

interface CategoryForm {
  name: string;
  slug: string;
  parentId: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
}

function CategoryEditor({
  category,
  all,
  onSaved,
}: {
  category: AdminCategoryView | null;
  all: AdminCategoryView[];
  onSaved: (id: string) => void;
}) {
  const { can } = usePermissions();
  const form = useForm<CategoryForm>({
    values: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      parentId: category?.parentId ?? '',
      description: category?.description ?? '',
      imageUrl: category?.imageUrl ?? '',
      isActive: category?.isActive ?? true,
      sortOrder: category?.sortOrder ?? 0,
      seoTitle: category?.seoTitle ?? '',
      seoDescription: category?.seoDescription ?? '',
    },
  });
  const save = useAdminMutation(
    (input: CategoryUpsertInput) =>
      category
        ? api.put<AdminCategoryView>(`/admin/categories/${category.id}`, input)
        : api.post<AdminCategoryView>('/admin/categories', input),
    { success: 'دسته‌بندی ذخیره شد.', onSuccess: (saved) => onSaved(saved.id) },
  );
  const remove = useAdminMutation(() => api.delete(`/admin/categories/${category?.id}`), {
    success: 'دسته‌بندی حذف شد.',
    onSuccess: () => onSaved(''),
  });
  const editable = category ? can('category.update') : can('category.create');

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={form.handleSubmit((v) =>
        save.mutate({
          name: v.name,
          slug: v.slug || undefined,
          parentId: v.parentId || null,
          description: v.description || null,
          imageUrl: v.imageUrl || null,
          isActive: v.isActive,
          sortOrder: Number(v.sortOrder) || 0,
          seoTitle: v.seoTitle || null,
          seoDescription: v.seoDescription || null,
        }),
      )}
    >
      <Field label="نام" htmlFor="c-name" required>
        <Input id="c-name" {...form.register('name', { required: true })} disabled={!editable} />
      </Field>
      <Field label="نامک" htmlFor="c-slug" hint="خالی = خودکار">
        <Input
          id="c-slug"
          dir="ltr"
          className="text-left"
          {...form.register('slug')}
          disabled={!editable}
        />
      </Field>
      <Field label="دسته والد" htmlFor="c-parent">
        <NativeSelect id="c-parent" {...form.register('parentId')} disabled={!editable}>
          <option value="">— دسته اصلی —</option>
          {flatten(all)
            .filter(({ node }) => node.id !== category?.id)
            .map(({ node, depth }) => (
              <option key={node.id} value={node.id}>{`${'— '.repeat(depth)}${node.name}`}</option>
            ))}
        </NativeSelect>
      </Field>
      <Field label="ترتیب نمایش" htmlFor="c-sort">
        <Input
          id="c-sort"
          type="number"
          dir="ltr"
          {...form.register('sortOrder')}
          disabled={!editable}
        />
      </Field>
      <Field label="توضیحات" htmlFor="c-desc" className="md:col-span-2">
        <Textarea id="c-desc" rows={2} {...form.register('description')} disabled={!editable} />
      </Field>
      <Field label="آدرس تصویر" htmlFor="c-img">
        <Input
          id="c-img"
          dir="ltr"
          className="text-left"
          {...form.register('imageUrl')}
          disabled={!editable}
        />
      </Field>
      <Controller
        control={form.control}
        name="isActive"
        render={({ field }) => (
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!editable} />{' '}
            فعال (نمایش در فروشگاه)
          </label>
        )}
      />
      <Field label="عنوان سئو" htmlFor="c-seo">
        <Input id="c-seo" {...form.register('seoTitle')} disabled={!editable} />
      </Field>
      <Field label="توضیحات متا" htmlFor="c-seod">
        <Input id="c-seod" {...form.register('seoDescription')} disabled={!editable} />
      </Field>
      {editable ? (
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" loading={save.isPending}>
            {category ? 'ذخیره' : 'ایجاد دسته‌بندی'}
          </Button>
          {category && can('category.delete') ? (
            <ConfirmButton
              type="button"
              variant="ghost"
              className="text-destructive"
              title="حذف دسته‌بندی؟"
              description="فقط دسته‌های بدون زیرمجموعه و محصول قابل حذف هستند."
              loading={remove.isPending}
              onConfirm={() => remove.mutateAsync(undefined)}
            >
              <Trash2 /> حذف
            </ConfirmButton>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function assignmentState(
  category: AdminCategoryView,
): Record<string, { assigned: boolean; isRequired: boolean; isFilterable: boolean }> {
  return Object.fromEntries(
    category.attributes.map((a) => [
      a.attribute.id,
      { assigned: true, isRequired: a.isRequired, isFilterable: a.isFilterable },
    ]),
  );
}

function AttributeAssignment({ category }: { category: AdminCategoryView }) {
  const { can } = usePermissions();
  const attributes = useQuery({
    queryKey: ['admin', 'attributes'],
    queryFn: () => api.get<(AttributeView & { usage: unknown })[]>('/admin/attributes'),
  });
  const [state, setState] = useState(() => assignmentState(category));
  const [loadedCategory, setLoadedCategory] = useState(category);
  if (loadedCategory !== category) {
    setLoadedCategory(category);
    setState(assignmentState(category));
  }
  const save = useAdminMutation(
    () =>
      api.put(`/admin/categories/${category.id}/attributes`, {
        attributes: Object.entries(state)
          .filter(([, v]) => v.assigned)
          .map(([attributeId, v], sortOrder) => ({
            attributeId,
            isRequired: v.isRequired,
            isFilterable: v.isFilterable,
            sortOrder,
          })),
      }),
    { success: 'ویژگی‌های دسته‌بندی ذخیره شد.' },
  );
  const editable = can('category.update');
  const set = (
    id: string,
    patch: Partial<{ assigned: boolean; isRequired: boolean; isFilterable: boolean }>,
  ) =>
    setState((s) => ({
      ...s,
      [id]: { assigned: false, isRequired: false, isFilterable: true, ...s[id], ...patch },
    }));

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        ویژگی‌های انتخاب‌شده برای این دسته و همه زیرمجموعه‌های آن در فرم محصول نمایش داده می‌شوند.
      </p>
      <div className="border-border max-h-80 overflow-y-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground sticky top-0 text-xs">
            <tr>
              <th className="p-2 text-start">ویژگی</th>
              <th className="p-2">اختصاص</th>
              <th className="p-2">الزامی</th>
              <th className="p-2">فیلتر</th>
            </tr>
          </thead>
          <tbody>
            {attributes.data?.map((attribute) => {
              const row = state[attribute.id];
              return (
                <tr key={attribute.id} className="border-border border-t">
                  <td className="p-2">
                    {attribute.name}{' '}
                    <span className="ltr text-muted-foreground font-mono text-[11px]">
                      {attribute.code}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <Checkbox
                      checked={row?.assigned ?? false}
                      disabled={!editable}
                      onCheckedChange={(v) => set(attribute.id, { assigned: v === true })}
                    />
                  </td>
                  <td className="p-2 text-center">
                    <Checkbox
                      checked={row?.isRequired ?? false}
                      disabled={!editable || !row?.assigned}
                      onCheckedChange={(v) => set(attribute.id, { isRequired: v === true })}
                    />
                  </td>
                  <td className="p-2 text-center">
                    <Checkbox
                      checked={row?.isFilterable ?? false}
                      disabled={!editable || !row?.assigned}
                      onCheckedChange={(v) => set(attribute.id, { isFilterable: v === true })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editable ? (
        <Button size="sm" loading={save.isPending} onClick={() => save.mutate(undefined)}>
          ذخیره ویژگی‌ها
        </Button>
      ) : null}
    </div>
  );
}

export default function CategoriesPage() {
  const { can } = usePermissions();
  const tree = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api.get<AdminCategoryView[]>('/admin/categories'),
  });
  const [selectedId, setSelectedId] = useState<string | 'new' | ''>('');
  const all = tree.data ?? [];
  const selected = flatten(all).find(({ node }) => node.id === selectedId)?.node ?? null;

  return (
    <>
      <PageHeader
        title="دسته‌بندی‌ها"
        description="ساختار درختی دسته‌ها و ویژگی‌های فنی هر دسته (به زیرمجموعه‌ها ارث می‌رسد)"
        actions={
          can('category.create') ? (
            <Button onClick={() => setSelectedId('new')}>
              <Plus /> دسته جدید
            </Button>
          ) : null
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[20rem_1fr]">
        <Card>
          <CardContent className="p-2">
            <ul>
              {all.map((node) => (
                <TreeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  selected={selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
        <div className="space-y-5">
          {selectedId === '' ? (
            <Card>
              <EmptyState icon={<FolderTree />} title="یک دسته‌بندی را انتخاب کنید" />
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>{selected ? `ویرایش «${selected.name}»` : 'دسته‌بندی جدید'}</CardTitle>
                  {selected ? <Badge>{faNumber(selected.productCount)} محصول</Badge> : null}
                </CardHeader>
                <CardContent>
                  <CategoryEditor
                    key={selected?.id ?? 'new'}
                    category={selected}
                    all={all}
                    onSaved={setSelectedId}
                  />
                </CardContent>
              </Card>
              {selected ? (
                <Card>
                  <CardHeader>
                    <CardTitle>ویژگی‌های فنی دسته</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AttributeAssignment category={selected} />
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
