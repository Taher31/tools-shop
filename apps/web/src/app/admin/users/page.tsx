'use client';

import { useQuery } from '@tanstack/react-query';
import type { RoleView, StaffUserView } from '@toolshop/shared';
import { Badge, Button, Checkbox, Field, Input, Switch } from '@toolshop/ui';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { DataTable, Pager, SearchInput, TableCard } from '@/components/admin/data-table';
import { FormDialog } from '@/components/admin/form-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminList, useAdminMutation } from '@/components/admin/query';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { dateTime } from '@/lib/format';

export default function UsersPage() {
  const { can } = usePermissions();
  const list = useAdminList<StaffUserView>('/admin/users');
  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => api.get<RoleView[]>('/admin/roles'), enabled: can('role.read') });
  const [editing, setEditing] = useState<StaffUserView | null | undefined>(undefined);
  const [draft, setDraft] = useState({ firstName: '', lastName: '', email: '', mobile: '', password: '', roleIds: [] as string[], isActive: true });
  const open = (user: StaffUserView | null) => {
    setEditing(user);
    setDraft({ firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', email: user?.email ?? '', mobile: user?.mobile ?? '', password: '', roleIds: user?.roles.map((r) => r.id) ?? [], isActive: user?.isActive ?? true });
  };
  const save = useAdminMutation(
    () =>
      editing
        ? api.put(`/admin/users/${editing.id}`, { firstName: draft.firstName, lastName: draft.lastName, roleIds: draft.roleIds, isActive: draft.isActive, password: draft.password })
        : api.post('/admin/users', { ...draft, mobile: draft.mobile || undefined }),
    { success: 'کاربر ذخیره شد.', onSuccess: () => setEditing(undefined) },
  );

  return (
    <>
      <PageHeader title="کاربران مدیریتی" description="کارکنان فروشگاه و نقش‌های آن‌ها" actions={can('user.manage') ? <Button onClick={() => open(null)}><Plus /> کاربر جدید</Button> : null} />
      <TableCard toolbar={<SearchInput onSearch={list.setSearch} placeholder="نام یا ایمیل" className="w-64" />}>
        <DataTable
          rows={list.data?.items}
          loading={list.isLoading}
          rowKey={(u) => u.id}
          columns={[
            { header: 'نام', cell: (u) => <span className="font-semibold">{u.fullName}</span> },
            { header: 'ایمیل', cell: (u) => <span className="ltr text-xs">{u.email}</span> },
            { header: 'نقش‌ها', cell: (u) => <div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r.id} variant="info">{r.name}</Badge>)}</div> },
            { header: 'آخرین ورود', cell: (u) => <span className="text-xs">{u.lastLoginAt ? dateTime(u.lastLoginAt) : '—'}</span> },
            { header: 'وضعیت', cell: (u) => (u.isActive ? <Badge variant="success">فعال</Badge> : <Badge variant="destructive">غیرفعال</Badge>) },
            { header: '', cell: (u) => (can('user.manage') ? <Button size="icon-sm" variant="ghost" onClick={() => open(u)} aria-label="ویرایش"><Pencil /></Button> : null) },
          ]}
        />
        <Pager data={list.data} onPage={list.setPage} />
      </TableCard>
      <FormDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} title={editing ? 'ویرایش کاربر' : 'کاربر جدید'} loading={save.isPending} onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="نام" htmlFor="u-fn"><Input id="u-fn" value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} /></Field>
          <Field label="نام خانوادگی" htmlFor="u-ln"><Input id="u-ln" value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} /></Field>
          <Field label="ایمیل (نام کاربری)" htmlFor="u-em"><Input id="u-em" dir="ltr" disabled={Boolean(editing)} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
          <Field label="موبایل" htmlFor="u-mob"><Input id="u-mob" dir="ltr" disabled={Boolean(editing)} value={draft.mobile} onChange={(e) => setDraft({ ...draft, mobile: e.target.value })} /></Field>
          <Field label={editing ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور'} htmlFor="u-pw" className="sm:col-span-2" hint="حداقل ۸ کاراکتر شامل حروف و عدد">
            <Input id="u-pw" type="password" dir="ltr" autoComplete="new-password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
          </Field>
        </div>
        <Field label="نقش‌ها">
          <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
            {roles.data?.map((role) => (
              <label key={role.id} className="flex items-start gap-2 text-sm">
                <Checkbox checked={draft.roleIds.includes(role.id)} onCheckedChange={(c) => setDraft({ ...draft, roleIds: c ? [...draft.roleIds, role.id] : draft.roleIds.filter((id) => id !== role.id) })} />
                <span>{role.name}<span className="block text-[11px] text-muted-foreground">{role.description}</span></span>
              </label>
            ))}
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm"><Switch checked={draft.isActive} onCheckedChange={(v) => setDraft({ ...draft, isActive: v })} /> فعال</label>
      </FormDialog>
    </>
  );
}
