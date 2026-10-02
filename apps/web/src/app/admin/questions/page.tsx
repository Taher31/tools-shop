'use client';

import {
  type AdminQuestionView,
  type AiDraft,
  QUESTION_STATUS_LABELS,
  QUESTION_STATUSES,
} from '@toolshop/shared';
import { Badge, Button, Field, Textarea } from '@toolshop/ui';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { AiButton, AiDraftNote, ConfidenceBadge } from '@/components/admin/ai-assist';
import { DataTable, Pager, TableCard } from '@/components/admin/data-table';
import { FormDialog } from '@/components/admin/form-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { useUrlList, useAdminMutation } from '@/components/admin/query';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { date } from '@/lib/format';
import { FilterBar } from '@/components/admin/filter-bar';

const VARIANT = { pending: 'warning', answered: 'success', rejected: 'destructive' } as const;

function QuestionsContent() {
  const list = useUrlList<AdminQuestionView>('/admin/questions', { status: 'pending' });
  const [answering, setAnswering] = useState<AdminQuestionView | null>(null);
  const [answer, setAnswer] = useState('');
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const { can } = usePermissions();
  const canUseAi = can('ai.use');
  const suggest = useAdminMutation(
    (id: string) => api.post<AiDraft>(`/admin/ai/questions/${id}/suggest`),
    {
      invalidate: [],
      onSuccess: (result) => {
        setDraft(result);
        setAnswer(result.text);
      },
    },
  );
  const open = (q: AdminQuestionView) => {
    setAnswering(q);
    setDraft(null);
    // Prefill with the stored AI suggestion when there is no human answer yet.
    setAnswer(q.answer ?? q.aiSuggestion?.answer ?? '');
  };
  const save = useAdminMutation(
    ({ id, status }: { id: string; status: 'answered' | 'rejected' }) =>
      api.put(`/admin/questions/${id}/answer`, { answer: answer || 'رد شد', status }),
    { success: 'پاسخ ثبت شد.', onSuccess: () => setAnswering(null) },
  );

  return (
    <>
      <PageHeader
        title="پرسش‌های محصولات"
        description="پرسش‌ها پس از پاسخ کارشناس در صفحه محصول نمایش داده می‌شوند. هوش مصنوعی برای پرسش‌های جدید پاسخ پیشنهادی آماده می‌کند تا با یک کلیک بازبینی و منتشر شوند."
      />
      <TableCard
        toolbar={
          <FilterBar
            list={list}
            searchPlaceholder="متن پرسش، پاسخ یا محصول"
            dateLabel="تاریخ ثبت"
            inline={[
              {
                type: 'select',
                key: 'status',
                label: 'وضعیت',
                options: QUESTION_STATUSES.map((s) => ({
                  value: s,
                  label: QUESTION_STATUS_LABELS[s],
                })),
              },
              {
                type: 'select',
                key: 'answeredBy',
                label: 'پاسخ‌دهنده',
                options: [
                  { value: 'ai', label: 'هوش مصنوعی' },
                  { value: 'staff', label: 'کارشناس' },
                  { value: 'none', label: 'بدون پاسخ' },
                ],
              },
            ]}
          />
        }
      >
        <DataTable
          rows={list.data?.items}
          loading={list.isLoading}
          rowKey={(q) => q.id}
          empty="پرسشی در انتظار پاسخ نیست"
          columns={[
            {
              header: 'محصول',
              cell: (q) => (
                <Link
                  href={`/product/${q.product.slug}`}
                  target="_blank"
                  className="text-info line-clamp-1 max-w-48 hover:underline"
                >
                  {q.product.title}
                </Link>
              ),
            },
            {
              header: 'پرسش',
              cell: (q) => (
                <div className="max-w-md">
                  <p className="text-sm">{q.body}</p>
                  {q.answer ? (
                    <p className="text-success mt-1 text-xs">
                      {q.answeredByAi ? '✦ پاسخ خودکار AI: ' : 'پاسخ: '}
                      {q.answer}
                    </p>
                  ) : q.aiSuggestion ? (
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-violet-700 dark:text-violet-300">
                      <span className="line-clamp-1 max-w-72">
                        ✦ پیشنهاد: {q.aiSuggestion.answer}
                      </span>
                      <ConfidenceBadge value={q.aiSuggestion.confidence} />
                    </p>
                  ) : null}
                </div>
              ),
            },
            { header: 'کاربر', cell: (q) => <span className="text-xs">{q.authorName}</span> },
            { header: 'تاریخ', cell: (q) => <span className="text-xs">{date(q.createdAt)}</span> },
            {
              header: 'وضعیت',
              cell: (q) => (
                <Badge variant={VARIANT[q.status]}>{QUESTION_STATUS_LABELS[q.status]}</Badge>
              ),
            },
            {
              header: '',
              cell: (q) => (
                <Button size="sm" variant="outline" onClick={() => open(q)}>
                  {q.answer ? 'ویرایش پاسخ' : q.aiSuggestion ? 'بازبینی و پاسخ' : 'پاسخ'}
                </Button>
              ),
            },
          ]}
        />
        <Pager data={list.data} onPage={list.setPage} />
      </TableCard>
      <FormDialog
        open={answering !== null}
        onOpenChange={(open) => !open && setAnswering(null)}
        title="پاسخ به پرسش"
        submitLabel="ثبت و انتشار پاسخ"
        loading={save.isPending}
        onSubmit={(e) => {
          e.preventDefault();
          if (answering) save.mutate({ id: answering.id, status: 'answered' });
        }}
      >
        <p className="bg-muted rounded-md p-3 text-sm">{answering?.body}</p>
        {canUseAi && answering ? (
          <div className="flex justify-end">
            <AiButton pending={suggest.isPending} onClick={() => suggest.mutate(answering.id)}>
              پیشنهاد پاسخ با هوش مصنوعی
            </AiButton>
          </div>
        ) : null}
        {draft ? (
          <AiDraftNote confidence={draft.confidence} notes={draft.notes} />
        ) : answering && !answering.answer && answering.aiSuggestion ? (
          <AiDraftNote confidence={answering.aiSuggestion.confidence} notes={null} />
        ) : null}
        <Field label="پاسخ کارشناس" htmlFor="q-answer" required>
          <Textarea
            id="q-answer"
            rows={5}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        </Field>
        <Button
          type="button"
          variant="ghost"
          className="text-destructive"
          onClick={() => answering && save.mutate({ id: answering.id, status: 'rejected' })}
        >
          رد پرسش (عدم انتشار)
        </Button>
      </FormDialog>
    </>
  );
}

export default function QuestionsPage() {
  return (
    <Suspense>
      <QuestionsContent />
    </Suspense>
  );
}
