'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  type Paginated,
  type QuestionCreateInput,
  questionCreateSchema,
  type QuestionView,
  type ReviewCreateInput,
  reviewCreateSchema,
  type ReviewView,
} from '@toolshop/shared';
import { Alert, Badge, Button, EmptyState, Field, Input, Textarea, toast } from '@toolshop/ui';
import { BadgeCheck, MessageSquare, Star } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { date } from '@/lib/format';
import { Stars } from './rating';

function LoginPrompt({ action }: { action: string }) {
  const pathname = usePathname();
  return (
    <p className="bg-muted rounded-md px-4 py-3 text-sm">
      برای {action}{' '}
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className="text-info font-bold hover:underline"
      >
        وارد حساب کاربری
      </Link>{' '}
      شوید.
    </p>
  );
}

export function ReviewsSection({ productId }: { productId: string }) {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const { data } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => api.get<Paginated<ReviewView>>(`/products/${productId}/reviews?pageSize=20`),
  });
  const form = useForm<ReviewCreateInput>({
    resolver: zodResolver(reviewCreateSchema) as never,
    defaultValues: { rating: 5, title: '', body: '' },
  });
  const mutation = useMutation({
    mutationFn: (input: ReviewCreateInput) => api.post(`/products/${productId}/reviews`, input),
    onSuccess: () => {
      setSubmitted(true);
      form.reset();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const rating = form.watch('rating');

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div>
        {data && data.items.length > 0 ? (
          <ul className="divide-border divide-y">
            {data.items.map((review) => (
              <li key={review.id} className="py-4">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Stars value={review.rating} />
                  {review.title ? <span className="font-bold">{review.title}</span> : null}
                </div>
                <p className="text-sm leading-7">{review.body}</p>
                <p className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                  {review.authorName} · {date(review.createdAt)}
                  {review.isVerifiedBuyer ? (
                    <Badge variant="success" className="text-[11px]">
                      <BadgeCheck className="size-3" /> خریدار
                    </Badge>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<MessageSquare />}
            title="هنوز نظری ثبت نشده است"
            description="اولین نفری باشید که درباره این کالا نظر می‌دهد."
          />
        )}
      </div>
      <div className="border-border h-fit rounded-lg border p-4">
        <p className="mb-3 font-bold">ثبت نظر</p>
        {!user ? (
          <LoginPrompt action="ثبت نظر" />
        ) : submitted ? (
          <Alert variant="success">نظر شما ثبت شد و پس از بررسی منتشر می‌شود.</Alert>
        ) : (
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <Field label="امتیاز شما">
              <div className="flex gap-1" role="radiogroup" aria-label="امتیاز">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={rating === value}
                    aria-label={`${value} ستاره`}
                    onClick={() => form.setValue('rating', value)}
                  >
                    <Star
                      className={`size-6 ${value <= rating ? 'fill-accent text-accent' : 'text-border'}`}
                    />
                  </button>
                ))}
              </div>
            </Field>
            <Field
              label="عنوان"
              htmlFor="review-title"
              error={form.formState.errors.title?.message}
            >
              <Input id="review-title" {...form.register('title')} />
            </Field>
            <Field
              label="متن نظر"
              htmlFor="review-body"
              required
              error={form.formState.errors.body?.message}
            >
              <Textarea id="review-body" rows={4} {...form.register('body')} />
            </Field>
            <Button type="submit" className="w-full" loading={mutation.isPending}>
              ثبت نظر
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export function QuestionsSection({ productId }: { productId: string }) {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const { data } = useQuery({
    queryKey: ['questions', productId],
    queryFn: () => api.get<Paginated<QuestionView>>(`/products/${productId}/questions?pageSize=20`),
  });
  const form = useForm<QuestionCreateInput>({
    resolver: zodResolver(questionCreateSchema) as never,
    defaultValues: { body: '' },
  });
  const mutation = useMutation({
    mutationFn: (input: QuestionCreateInput) => api.post(`/products/${productId}/questions`, input),
    onSuccess: () => {
      setSubmitted(true);
      form.reset();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div>
        {data && data.items.length > 0 ? (
          <ul className="space-y-4">
            {data.items.map((question) => (
              <li key={question.id} className="border-border rounded-lg border p-4">
                <p className="text-sm font-semibold leading-7">
                  <span className="bg-secondary text-primary me-2 rounded-sm px-1.5 text-xs">
                    پرسش
                  </span>
                  {question.body}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {question.authorName} · {date(question.createdAt)}
                </p>
                {question.answer ? (
                  <div className="border-accent mt-3 border-s-2 ps-3 text-sm leading-7">
                    <span className="text-primary font-bold">پاسخ {question.answeredBy}: </span>
                    {question.answer}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<MessageSquare />}
            title="هنوز پرسشی ثبت نشده است"
            description="سؤال فنی درباره این کالا دارید؟ از کارشناسان ما بپرسید."
          />
        )}
      </div>
      <div className="border-border h-fit rounded-lg border p-4">
        <p className="mb-3 font-bold">پرسش از کارشناس</p>
        {!user ? (
          <LoginPrompt action="ثبت پرسش" />
        ) : submitted ? (
          <Alert variant="success">پرسش شما ثبت شد و پس از پاسخ کارشناس نمایش داده می‌شود.</Alert>
        ) : (
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <Field
              label="متن پرسش"
              htmlFor="question-body"
              required
              error={form.formState.errors.body?.message}
            >
              <Textarea
                id="question-body"
                rows={4}
                placeholder="مثلاً: آیا این دریل برای سوراخکاری بتن مناسب است؟"
                {...form.register('body')}
              />
            </Field>
            <Button type="submit" className="w-full" loading={mutation.isPending}>
              ثبت پرسش
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
