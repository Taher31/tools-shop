'use client';

import { useQuery } from '@tanstack/react-query';
import type { ContentPageView, FaqItemView } from '@toolshop/shared';
import {
  Button,
  Field,
  Input,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@toolshop/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { DataTable, TableCard } from '@/components/admin/data-table';
import { FormDialog } from '@/components/admin/form-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminMutation } from '@/components/admin/query';
import { api } from '@/lib/api/client';
import { dateTime } from '@/lib/format';

type PageRow = ContentPageView & { isPublished: boolean };
type FaqRow = FaqItemView & { sortOrder: number; isPublished: boolean };

function PagesTab() {
  const pages = useQuery({
    queryKey: ['admin', 'pages'],
    queryFn: () => api.get<PageRow[]>('/admin/content/pages'),
  });
  const [editing, setEditing] = useState<PageRow | null>(null);
  const [draft, setDraft] = useState({
    title: '',
    body: '',
    seoTitle: '',
    seoDescription: '',
    isPublished: true,
  });
  const save = useAdminMutation(
    () =>
      api.put(`/admin/content/pages/${editing?.slug}`, {
        ...draft,
        seoTitle: draft.seoTitle || null,
        seoDescription: draft.seoDescription || null,
      }),
    { success: 'صفحه ذخیره شد.', onSuccess: () => setEditing(null) },
  );
  return (
    <TableCard>
      <DataTable
        rows={pages.data}
        loading={pages.isLoading}
        rowKey={(p) => p.slug}
        columns={[
          { header: 'عنوان', cell: (p) => <span className="font-semibold">{p.title}</span> },
          {
            header: 'آدرس',
            cell: (p) => (
              <Link href={`/${p.slug}`} target="_blank" className="ltr text-info font-mono text-xs">
                /{p.slug}
              </Link>
            ),
          },
          {
            header: 'آخرین ویرایش',
            cell: (p) => <span className="text-xs">{dateTime(p.updatedAt)}</span>,
          },
          {
            header: '',
            cell: (p) => (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="ویرایش"
                onClick={() => {
                  setEditing(p);
                  setDraft({
                    title: p.title,
                    body: p.body,
                    seoTitle: p.seoTitle ?? '',
                    seoDescription: p.seoDescription ?? '',
                    isPublished: p.isPublished,
                  });
                }}
              >
                <Pencil />
              </Button>
            ),
          },
        ]}
      />
      <FormDialog
        wide
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={`ویرایش صفحه «${editing?.title ?? ''}»`}
        loading={save.isPending}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <Field label="عنوان" htmlFor="pg-title">
          <Input
            id="pg-title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </Field>
        <Field
          label="متن صفحه"
          htmlFor="pg-body"
          hint="HTML ساده (p, h2, ul, li, a, table) یا متن با پاراگراف‌های جدا؛ کدهای ناامن حذف می‌شوند."
        >
          <Textarea
            id="pg-body"
            rows={14}
            dir="rtl"
            className="font-mono text-xs"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="عنوان سئو" htmlFor="pg-seo">
            <Input
              id="pg-seo"
              value={draft.seoTitle}
              onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })}
            />
          </Field>
          <Field label="توضیحات متا" htmlFor="pg-seod">
            <Input
              id="pg-seod"
              value={draft.seoDescription}
              onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={draft.isPublished}
            onCheckedChange={(v) => setDraft({ ...draft, isPublished: v })}
          />{' '}
          منتشرشده
        </label>
      </FormDialog>
    </TableCard>
  );
}

function FaqTab() {
  const faq = useQuery({
    queryKey: ['admin', 'faq'],
    queryFn: () => api.get<FaqRow[]>('/admin/content/faq'),
  });
  const [editing, setEditing] = useState<FaqRow | null | undefined>(undefined);
  const [draft, setDraft] = useState({
    question: '',
    answer: '',
    category: '',
    sortOrder: 0,
    isPublished: true,
  });
  const open = (row: FaqRow | null) => {
    setEditing(row);
    setDraft({
      question: row?.question ?? '',
      answer: row?.answer ?? '',
      category: row?.category ?? '',
      sortOrder: row?.sortOrder ?? faq.data?.length ?? 0,
      isPublished: row?.isPublished ?? true,
    });
  };
  const save = useAdminMutation(
    () =>
      editing
        ? api.put(`/admin/content/faq/${editing.id}`, {
            ...draft,
            category: draft.category || null,
          })
        : api.post('/admin/content/faq', { ...draft, category: draft.category || null }),
    { success: 'پرسش ذخیره شد.', onSuccess: () => setEditing(undefined) },
  );
  const remove = useAdminMutation((id: string) => api.delete(`/admin/content/faq/${id}`), {
    success: 'حذف شد.',
  });
  return (
    <TableCard
      toolbar={
        <Button size="sm" onClick={() => open(null)}>
          <Plus /> پرسش جدید
        </Button>
      }
    >
      <DataTable
        rows={faq.data}
        loading={faq.isLoading}
        rowKey={(f) => f.id}
        columns={[
          { header: 'پرسش', cell: (f) => <span className="font-semibold">{f.question}</span> },
          { header: 'دسته', cell: (f) => f.category ?? '—' },
          { header: 'وضعیت', cell: (f) => (f.isPublished ? 'منتشرشده' : 'پیش‌نویس') },
          {
            header: '',
            cell: (f) => (
              <div className="flex justify-end gap-1">
                <Button size="icon-sm" variant="ghost" aria-label="ویرایش" onClick={() => open(f)}>
                  <Pencil />
                </Button>
                <ConfirmButton
                  size="icon-sm"
                  variant="ghost"
                  aria-label="حذف"
                  title="حذف این پرسش؟"
                  onConfirm={() => remove.mutateAsync(f.id)}
                >
                  <Trash2 className="text-destructive" />
                </ConfirmButton>
              </div>
            ),
          },
        ]}
      />
      <FormDialog
        open={editing !== undefined}
        onOpenChange={(o) => !o && setEditing(undefined)}
        title={editing ? 'ویرایش پرسش' : 'پرسش جدید'}
        loading={save.isPending}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <Field label="پرسش" htmlFor="fq-q">
          <Input
            id="fq-q"
            value={draft.question}
            onChange={(e) => setDraft({ ...draft, question: e.target.value })}
          />
        </Field>
        <Field label="پاسخ" htmlFor="fq-a">
          <Textarea
            id="fq-a"
            rows={5}
            value={draft.answer}
            onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="دسته" htmlFor="fq-c">
            <Input
              id="fq-c"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
          </Field>
          <Field label="ترتیب" htmlFor="fq-s">
            <Input
              id="fq-s"
              type="number"
              dir="ltr"
              value={draft.sortOrder}
              onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={draft.isPublished}
            onCheckedChange={(v) => setDraft({ ...draft, isPublished: v })}
          />{' '}
          منتشرشده
        </label>
      </FormDialog>
    </TableCard>
  );
}

export default function ContentPage() {
  return (
    <>
      <PageHeader
        title="صفحات و سوالات متداول"
        description="این محتوا در فاز ۳ به‌عنوان منبع دانش دستیار هوش مصنوعی هم استفاده می‌شود."
      />
      <Tabs defaultValue="pages" dir="rtl">
        <TabsList className="mb-4">
          <TabsTrigger value="pages">صفحات</TabsTrigger>
          <TabsTrigger value="faq">سوالات متداول</TabsTrigger>
        </TabsList>
        <TabsContent value="pages" className="pt-0">
          <PagesTab />
        </TabsContent>
        <TabsContent value="faq" className="pt-0">
          <FaqTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
