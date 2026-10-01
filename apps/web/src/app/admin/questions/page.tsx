'use client';

import {
  type AdminQuestionView,
  QUESTION_STATUS_LABELS,
  QUESTION_STATUSES,
} from '@toolshop/shared';
import { Badge, Button, Field, NativeSelect, Textarea } from '@toolshop/ui';
import Link from 'next/link';
import { useState } from 'react';
import { DataTable, Pager, TableCard } from '@/components/admin/data-table';
import { FormDialog } from '@/components/admin/form-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminList, useAdminMutation } from '@/components/admin/query';
import { api } from '@/lib/api/client';
import { date } from '@/lib/format';

const VARIANT = { pending: 'warning', answered: 'success', rejected: 'destructive' } as const;

export default function QuestionsPage() {
  const list = useAdminList<AdminQuestionView>('/admin/questions', { status: 'pending' });
  const [answering, setAnswering] = useState<AdminQuestionView | null>(null);
  const [answer, setAnswer] = useState('');
  const save = useAdminMutation(
    ({ id, status }: { id: string; status: 'answered' | 'rejected' }) =>
      api.put(`/admin/questions/${id}/answer`, { answer: answer || 'رد شد', status }),
    { success: 'پاسخ ثبت شد.', onSuccess: () => setAnswering(null) },
  );

  return (
    <>
      <PageHeader
        title="پرسش‌های محصولات"
        description="پرسش‌ها پس از پاسخ کارشناس در صفحه محصول نمایش داده می‌شوند. (پاسخ پیشنهادی هوش مصنوعی در فاز ۳ اضافه می‌شود.)"
      />
      <TableCard
        toolbar={
          <NativeSelect
            className="h-9 w-44"
            value={(list.params.status as string) ?? ''}
            onChange={(e) => list.update({ status: e.target.value || undefined })}
            aria-label="وضعیت"
          >
            <option value="">همه</option>
            {QUESTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUESTION_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
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
                  {q.answer ? <p className="text-success mt-1 text-xs">پاسخ: {q.answer}</p> : null}
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAnswering(q);
                    setAnswer(q.answer ?? '');
                  }}
                >
                  {q.answer ? 'ویرایش پاسخ' : 'پاسخ'}
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
