'use client';

import { useQuery } from '@tanstack/react-query';
import {
  INTEGRATION_STATUS_LABELS,
  type IntegrationLogView,
  type IntegrationStatus,
  type IntegrationView,
  MARKETPLACE_SYNC_STATUS_LABELS,
  MARKETPLACE_SYNC_STATUSES,
  type Paginated,
} from '@toolshop/shared';
import {
  Alert,
  Badge,
  type BadgeProps,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Skeleton,
  Switch,
} from '@toolshop/ui';
import { ArrowDownToLine, ArrowUpFromLine, PlugZap, RefreshCw, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/admin/page-header';
import { useAdminMutation } from '@/components/admin/query';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api/client';
import { dateTime, faNumber } from '@/lib/format';

const STATUS_VARIANT: Record<IntegrationStatus, BadgeProps['variant']> = {
  not_configured: 'secondary',
  ready: 'success',
  error: 'destructive',
};

function LogsDialog({ code, onClose }: { code: string; onClose: () => void }) {
  const logs = useQuery({
    queryKey: ['admin', 'integrations', code, 'logs'],
    queryFn: () =>
      api.get<Paginated<IntegrationLogView>>(`/admin/integrations/${code}/logs?pageSize=50`),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>گزارش همگام‌سازی</DialogTitle>
        </DialogHeader>
        {!logs.data ? (
          <Skeleton className="h-40" />
        ) : logs.data.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">رویدادی ثبت نشده است.</p>
        ) : (
          <ul className="divide-border max-h-[60vh] divide-y overflow-y-auto text-sm">
            {logs.data.items.map((log) => (
              <li key={log.id} className="flex flex-wrap items-start gap-2 py-2">
                <Badge
                  variant={
                    log.level === 'error'
                      ? 'destructive'
                      : log.level === 'warning'
                        ? 'warning'
                        : 'secondary'
                  }
                >
                  {log.action}
                </Badge>
                <span className="min-w-0 flex-1">{log.message}</span>
                <span className="text-muted-foreground text-xs">{dateTime(log.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IntegrationCard({ integration }: { integration: IntegrationView }) {
  const { can } = usePermissions();
  const manage = can('integration.manage');
  const [values, setValues] = useState<Record<string, string>>({});
  const [showLogs, setShowLogs] = useState(false);
  const path = `/admin/integrations/${integration.code}`;
  const invalidate = [['admin', 'integrations']];
  const save = useAdminMutation(
    (input: { isEnabled?: boolean; credentials?: Record<string, string> }) =>
      api.put<IntegrationView>(path, input),
    { success: 'تنظیمات اتصال ذخیره شد.', invalidate, onSuccess: () => setValues({}) },
  );
  const test = useAdminMutation(() => api.post<IntegrationView>(`${path}/test`), { invalidate });
  const sync = useAdminMutation(
    (failed: boolean) =>
      api.post<{ queued: number }>(`${path}/sync${failed ? '?failed=true' : ''}`),
    { invalidate },
  );
  const changed = Object.keys(values).length > 0;
  const total = MARKETPLACE_SYNC_STATUSES.reduce((sum, s) => sum + integration.listings[s], 0);

  return (
    <Card className={cn(!integration.available && 'opacity-90')}>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {integration.kind === 'push' ? (
            <ArrowUpFromLine className="text-info size-5" />
          ) : (
            <ArrowDownToLine className="text-info size-5" />
          )}
          <CardTitle>{integration.name}</CardTitle>
          <Badge variant={STATUS_VARIANT[integration.status]}>
            {INTEGRATION_STATUS_LABELS[integration.status]}
          </Badge>
          {!integration.available ? <Badge variant="warning">نیازمند مستندات رسمی</Badge> : null}
          <label className="ms-auto flex items-center gap-2 text-sm">
            فعال
            <Switch
              checked={integration.isEnabled}
              disabled={
                !manage || save.isPending || (!integration.available && !integration.isEnabled)
              }
              onCheckedChange={(checked) => save.mutate({ isEnabled: checked })}
              aria-label={`فعال‌سازی ${integration.name}`}
            />
          </label>
        </div>
        <p className="text-muted-foreground text-sm">{integration.description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant={integration.available ? 'info' : 'warning'}>{integration.notes}</Alert>
        {integration.lastError ? (
          <Alert variant="destructive">{integration.lastError}</Alert>
        ) : null}

        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({ credentials: values });
          }}
        >
          {integration.credentialFields.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              htmlFor={`${integration.code}-${field.key}`}
              required={field.required}
              hint={
                field.configured ? (
                  <>
                    ذخیره‌شده: <span dir="ltr">{field.preview}</span>
                  </>
                ) : (
                  'تنظیم نشده'
                )
              }
            >
              <Input
                id={`${integration.code}-${field.key}`}
                dir="ltr"
                type={field.secret ? 'password' : 'text'}
                autoComplete="off"
                disabled={!manage}
                placeholder={field.configured ? 'برای تغییر مقدار جدید وارد کنید' : ''}
                value={values[field.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              />
            </Field>
          ))}
          {manage ? (
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button type="submit" size="sm" disabled={!changed} loading={save.isPending}>
                ذخیره اطلاعات اتصال
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={test.isPending}
                onClick={() => test.mutate(undefined)}
              >
                <PlugZap /> آزمون اتصال
              </Button>
              {integration.kind === 'push' && integration.isEnabled ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={sync.isPending}
                    onClick={() => sync.mutate(false)}
                  >
                    <RefreshCw /> همگام‌سازی همه
                  </Button>
                  {integration.listings.failed > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => sync.mutate(true)}
                    >
                      تلاش دوباره برای خطاها
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </form>

        {integration.kind === 'pull' && integration.feedUrl ? (
          <p className="bg-muted rounded-md p-3 text-xs">
            آدرس فید: <span className="ltr inline-block font-mono">{integration.feedUrl}</span>
            <br />
            به‌جای «…» توکن ذخیره‌شده را قرار دهید. فید فقط وقتی اتصال فعال باشد پاسخ می‌دهد.
          </p>
        ) : null}

        <div className="border-border flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3 text-xs">
          {integration.kind === 'push'
            ? MARKETPLACE_SYNC_STATUSES.filter((s) => integration.listings[s] > 0).map((s) => (
                <span key={s}>
                  {MARKETPLACE_SYNC_STATUS_LABELS[s]}: <b>{faNumber(integration.listings[s])}</b>
                </span>
              ))
            : null}
          {integration.kind === 'push' && total === 0 ? (
            <span className="text-muted-foreground">هنوز کالایی ارسال نشده است.</span>
          ) : null}
          {integration.lastSyncAt ? (
            <span>آخرین همگام‌سازی: {dateTime(integration.lastSyncAt)}</span>
          ) : null}
          {integration.lastCheckedAt ? (
            <span>آخرین آزمون: {dateTime(integration.lastCheckedAt)}</span>
          ) : null}
          <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setShowLogs(true)}>
            <ScrollText /> گزارش رویدادها
          </Button>
        </div>
      </CardContent>
      {showLogs ? <LogsDialog code={integration.code} onClose={() => setShowLogs(false)} /> : null}
    </Card>
  );
}

export default function IntegrationsPage() {
  const integrations = useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn: () => api.get<IntegrationView[]>('/admin/integrations'),
    refetchInterval: 15_000,
  });
  return (
    <>
      <PageHeader
        title="مرکز اتصال‌ها"
        description="اطلاعات فروشگاه مرجع اصلی است؛ تغییر قیمت و موجودی به‌صورت خودکار برای اتصال‌های فعال ارسال می‌شود. اعتبارنامه‌ها رمزنگاری‌شده ذخیره می‌شوند."
      />
      {!integrations.data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {integrations.data.map((integration) => (
            <IntegrationCard key={integration.code} integration={integration} />
          ))}
        </div>
      )}
    </>
  );
}
