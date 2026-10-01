'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type OrderSummary,
  type Paginated,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  type TicketCreateInput,
  ticketCreateSchema,
  type TicketDetail,
} from '@toolshop/shared';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  NativeSelect,
  Spinner,
  Textarea,
} from '@toolshop/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';
import { date, faNumber } from '@/lib/format';

type FormValues = {
  subject: string;
  category: TicketCreateInput['category'];
  orderId: string;
  body: string;
};

function NewTicketForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const presetOrder = useSearchParams().get('order') ?? '';
  const orders = useQuery({
    queryKey: ['orders', 'for-ticket'],
    queryFn: () => api.get<Paginated<OrderSummary>>('/account/orders?page=1&pageSize=20'),
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(ticketCreateSchema) as never,
    defaultValues: {
      subject: '',
      category: presetOrder ? 'order' : 'product',
      orderId: presetOrder,
      body: '',
    },
  });
  const create = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<TicketDetail>('/account/tickets', { ...values, orderId: values.orderId || null }),
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      router.replace(`/account/tickets/${ticket.id}`);
    },
    onError: (error) => applyApiError(form, error),
  });
  const { errors } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>درخواست پشتیبانی جدید</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((v) => create.mutate(v))}
        >
          <Field label="موضوع" htmlFor="t-category" error={errors.category?.message}>
            <NativeSelect id="t-category" {...form.register('category')}>
              {TICKET_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {TICKET_CATEGORY_LABELS[category]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="سفارش مرتبط (اختیاری)" htmlFor="t-order" error={errors.orderId?.message}>
            <NativeSelect id="t-order" {...form.register('orderId')}>
              <option value="">بدون سفارش</option>
              {orders.data?.items.map((order) => (
                <option key={order.id} value={order.id}>
                  سفارش {faNumber(order.orderNumber)} – {date(order.createdAt)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="عنوان"
            htmlFor="t-subject"
            error={errors.subject?.message}
            className="sm:col-span-2"
          >
            <Input id="t-subject" maxLength={150} {...form.register('subject')} />
          </Field>
          <Field
            label="شرح درخواست"
            htmlFor="t-body"
            error={errors.body?.message}
            className="sm:col-span-2"
          >
            <Textarea
              id="t-body"
              rows={6}
              maxLength={5000}
              placeholder="مدل کالا، شماره سفارش یا هر جزئیاتی که به بررسی سریع‌تر کمک می‌کند را بنویسید."
              {...form.register('body')}
            />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              انصراف
            </Button>
            <Button type="submit" variant="accent" disabled={create.isPending}>
              {create.isPending ? <Spinner /> : null} ثبت درخواست
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function NewTicketPage() {
  return (
    <Suspense>
      <NewTicketForm />
    </Suspense>
  );
}
