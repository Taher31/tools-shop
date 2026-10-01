'use client';

import { useQuery } from '@tanstack/react-query';
import type { MessengerChannelView, MessengerUpdateInput } from '@toolshop/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Input,
  Skeleton,
  Spinner,
  Switch,
} from '@toolshop/ui';
import { MessageCircle, Webhook } from 'lucide-react';
import { useState } from 'react';
import { useAdminMutation } from '@/components/admin/query';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { dateTime } from '@/lib/format';

function MessengerCard({ view, canManage }: { view: MessengerChannelView; canManage: boolean }) {
  const [token, setToken] = useState('');
  const path = `/admin/ai/messengers/${view.channel}`;
  const invalidate = [['admin', 'ai', 'messengers']];
  const save = useAdminMutation(
    (input: MessengerUpdateInput) => api.put<MessengerChannelView>(path, input),
    { success: 'تنظیمات ربات ذخیره شد.', invalidate, onSuccess: () => setToken('') },
  );
  const webhook = useAdminMutation(() => api.post<MessengerChannelView>(`${path}/webhook`), {
    success: 'وب‌هوک ثبت شد؛ ربات آماده پاسخ‌گویی است.',
    invalidate,
  });
  const busy = save.isPending || webhook.isPending;

  return (
    <Card className={cn(!view.available && 'opacity-90')}>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MessageCircle className="text-info size-5" />
          <CardTitle>ربات {view.label}</CardTitle>
          {!view.available ? (
            <Badge variant="warning">نیازمند مستندات رسمی</Badge>
          ) : view.enabled && view.webhookAt ? (
            <Badge variant="success">فعال</Badge>
          ) : view.token.configured ? (
            <Badge variant="warning">{view.enabled ? 'وب‌هوک ثبت نشده' : 'غیرفعال'}</Badge>
          ) : (
            <Badge variant="secondary">پیکربندی نشده</Badge>
          )}
          <label className="ms-auto flex items-center gap-2 text-sm">
            فعال
            <Switch
              checked={view.enabled}
              disabled={!canManage || busy || !view.available || !view.token.configured}
              onCheckedChange={(enabled) => save.mutate({ enabled })}
              aria-label={`فعال‌سازی ربات ${view.label}`}
            />
          </label>
        </div>
        {view.botUsername ? (
          <p className="ltr text-muted-foreground text-end text-sm">@{view.botUsername}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant={view.available ? 'info' : 'warning'}>{view.note}</Alert>
        {view.lastError ? <Alert variant="destructive">{view.lastError}</Alert> : null}
        {view.available && canManage ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Input
                type="password"
                autoComplete="off"
                dir="ltr"
                className="min-w-0 flex-1 text-left"
                placeholder={view.token.preview ?? '123456:ABC-…'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                aria-label={`توکن ربات ${view.label}`}
              />
              <Button
                disabled={!token.trim() || busy}
                onClick={() => save.mutate({ enabled: true, botToken: token.trim() })}
              >
                {save.isPending ? <Spinner /> : null}
                بررسی و ذخیره توکن
              </Button>
            </div>
            {save.error instanceof ApiError && save.error.fieldErrors()['botToken'] ? (
              <p className="text-destructive text-xs" role="alert">
                {save.error.fieldErrors()['botToken']}
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs">
              توکن پیش از ذخیره با سرور {view.label} بررسی و به‌صورت رمزنگاری‌شده نگهداری می‌شود.
            </p>
          </div>
        ) : null}
        {view.available ? (
          <div className="border-border flex flex-wrap items-center gap-3 border-t pt-4 text-xs">
            <span className="text-muted-foreground">
              {view.webhookAt ? `وب‌هوک: ${dateTime(view.webhookAt)}` : 'وب‌هوک هنوز ثبت نشده است.'}
            </span>
            {view.lastActivityAt ? (
              <span className="text-muted-foreground">
                آخرین پاسخ: {dateTime(view.lastActivityAt)}
              </span>
            ) : null}
            {canManage && view.token.configured ? (
              <Button
                size="sm"
                variant="outline"
                className="ms-auto"
                disabled={busy}
                onClick={() => webhook.mutate()}
              >
                {webhook.isPending ? <Spinner /> : <Webhook />}
                {view.webhookAt ? 'ثبت مجدد وب‌هوک' : 'ثبت وب‌هوک'}
              </Button>
            ) : null}
            {canManage && view.token.configured ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={busy}
                onClick={() => save.mutate({ enabled: false, botToken: '' })}
              >
                حذف توکن
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AiMessengers({ canManage }: { canManage: boolean }) {
  const list = useQuery({
    queryKey: ['admin', 'ai', 'messengers'],
    queryFn: () => api.get<MessengerChannelView[]>('/admin/ai/messengers'),
  });
  if (!list.data) return <Skeleton className="h-80" />;
  return (
    <div className="space-y-5">
      <Alert variant="info">
        ربات‌ها همان دستیار فروشگاه را در پیام‌رسان ارائه می‌کنند: جست‌وجو و مقایسه محصول با قیمت و
        موجودی زنده، اطلاعات ارسال و مرجوعی. فقط به پیام‌های خصوصی پاسخ داده می‌شود؛ قابلیت «ربات
        پیام‌رسان‌ها» باید در تنظیمات روشن باشد و نشانی سایت باید HTTPS و از اینترنت در دسترس باشد.
      </Alert>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {list.data.map((view) => (
          <MessengerCard key={view.channel} view={view} canManage={canManage} />
        ))}
      </div>
    </div>
  );
}
