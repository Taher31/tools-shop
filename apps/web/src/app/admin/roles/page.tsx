'use client';

import { useQuery } from '@tanstack/react-query';
import type { PermissionDefinition, RoleView } from '@toolshop/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  cn,
  Field,
  Input,
} from '@toolshop/ui';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminMutation } from '@/components/admin/query';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { faNumber } from '@/lib/format';

export default function RolesPage() {
  const { can } = usePermissions();
  const roles = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => api.get<RoleView[]>('/admin/roles'),
  });
  const catalog = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: () => api.get<PermissionDefinition[]>('/admin/roles/permissions'),
  });
  const [selectedId, setSelectedId] = useState<string | 'new'>('');
  const selected = roles.data?.find((r) => r.id === selectedId) ?? null;
  const [draft, setDraft] = useState({
    key: '',
    name: '',
    description: '',
    permissions: [] as string[],
  });

  const [loaded, setLoaded] = useState<{ id: string; role: RoleView | null }>({
    id: '',
    role: null,
  });
  if (loaded.id !== selectedId || loaded.role !== selected) {
    setLoaded({ id: selectedId, role: selected });
    if (selectedId === 'new') setDraft({ key: '', name: '', description: '', permissions: [] });
    else if (selected)
      setDraft({
        key: selected.key,
        name: selected.name,
        description: selected.description ?? '',
        permissions: selected.permissions,
      });
  }

  const groups = useMemo(() => {
    const map = new Map<string, PermissionDefinition[]>();
    for (const p of catalog.data ?? [])
      map.set(p.groupLabel, [...(map.get(p.groupLabel) ?? []), p]);
    return [...map.entries()];
  }, [catalog.data]);

  const save = useAdminMutation(
    () =>
      selected
        ? api.put<RoleView>(`/admin/roles/${selected.id}`, {
            ...draft,
            description: draft.description || null,
          })
        : api.post<RoleView>('/admin/roles', { ...draft, description: draft.description || null }),
    { success: 'نقش ذخیره شد.', onSuccess: (role) => setSelectedId(role.id) },
  );
  const remove = useAdminMutation(() => api.delete(`/admin/roles/${selected?.id}`), {
    success: 'نقش حذف شد.',
    onSuccess: () => setSelectedId(''),
  });
  const locked = selected?.key === 'super_admin' || !can('role.manage');
  const toggle = (key: string, on: boolean) =>
    setDraft((d) => ({
      ...d,
      permissions: on
        ? [...new Set([...d.permissions, key])]
        : d.permissions.filter((p) => p !== key),
    }));

  return (
    <>
      <PageHeader
        title="نقش‌ها و دسترسی‌ها"
        description="دسترسی‌ها granular هستند و در API برای هر درخواست بررسی می‌شوند."
        actions={
          can('role.manage') ? (
            <Button onClick={() => setSelectedId('new')}>
              <Plus /> نقش جدید
            </Button>
          ) : null
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[18rem_1fr]">
        <Card>
          <CardContent className="space-y-1 p-2">
            {roles.data?.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedId(role.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-start text-sm',
                  selectedId === role.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                <span>
                  {role.name}
                  {role.isSystem ? <Lock className="ms-1 inline size-3 opacity-60" /> : null}
                </span>
                <span className="text-xs opacity-70">{faNumber(role.usersCount)} کاربر</span>
              </button>
            ))}
          </CardContent>
        </Card>
        {selectedId ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{selected ? selected.name : 'نقش جدید'}</CardTitle>
              <Badge variant="info">{faNumber(draft.permissions.length)} دسترسی</Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              {selected?.key === 'super_admin' ? (
                <p className="bg-muted rounded-md p-3 text-sm">
                  نقش مدیر ارشد همیشه همه دسترسی‌ها را دارد و قابل ویرایش نیست.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="نام نقش" htmlFor="r-name">
                  <Input
                    id="r-name"
                    value={draft.name}
                    disabled={locked}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </Field>
                <Field label="کلید (انگلیسی)" htmlFor="r-key">
                  <Input
                    id="r-key"
                    dir="ltr"
                    value={draft.key}
                    disabled={locked || selected?.isSystem}
                    onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                  />
                </Field>
                <Field label="توضیح" htmlFor="r-desc">
                  <Input
                    id="r-desc"
                    value={draft.description}
                    disabled={locked}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {groups.map(([group, permissions]) => {
                  const all = permissions.every((p) => draft.permissions.includes(p.key));
                  return (
                    <div key={group} className="border-border rounded-md border p-3">
                      <label className="mb-2 flex items-center gap-2 text-sm font-bold">
                        <Checkbox
                          checked={all}
                          disabled={locked}
                          onCheckedChange={(c) =>
                            permissions.forEach((p) => toggle(p.key, c === true))
                          }
                        />{' '}
                        {group}
                      </label>
                      <div className="space-y-1.5 ps-1">
                        {permissions.map((p) => (
                          <label key={p.key} className="flex items-center gap-2 text-[13px]">
                            <Checkbox
                              checked={draft.permissions.includes(p.key)}
                              disabled={locked}
                              onCheckedChange={(c) => toggle(p.key, c === true)}
                            />
                            {p.label}
                            <span className="ltr text-muted-foreground ms-auto font-mono text-[10px]">
                              {p.key}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {!locked ? (
                <div className="flex gap-2">
                  <Button loading={save.isPending} onClick={() => save.mutate(undefined)}>
                    ذخیره نقش
                  </Button>
                  {selected && !selected.isSystem ? (
                    <ConfirmButton
                      variant="ghost"
                      className="text-destructive"
                      title="حذف این نقش؟"
                      description="نقش‌هایی که به کاربر اختصاص دارند قابل حذف نیستند."
                      loading={remove.isPending}
                      onConfirm={() => remove.mutateAsync(undefined)}
                    >
                      <Trash2 /> حذف نقش
                    </ConfirmButton>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
