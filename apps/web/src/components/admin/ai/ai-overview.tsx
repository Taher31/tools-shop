'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AI_FEATURE_LABELS,
  AI_MODEL_LABELS,
  type AiSettingsView,
  type AiUsageSummary,
} from '@toolshop/shared';
import { Alert, Card, CardContent, CardHeader, CardTitle, cn, Skeleton } from '@toolshop/ui';
import { useState } from 'react';
import { api } from '@/lib/api/client';
import { date, faNumber } from '@/lib/format';

const usd = (value: number) =>
  `${new Intl.NumberFormat('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} دلار`;

const compactTokens = (value: number) =>
  value >= 1_000_000
    ? `${faNumber(Math.round(value / 100_000) / 10)} میلیون`
    : value >= 1_000
      ? `${faNumber(Math.round(value / 100) / 10)} هزار`
      : faNumber(value);

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-5">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-2xl font-black">{value}</p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

/** Month-to-date spend against the hard budget; features pause at 100%. */
function BudgetMeter({ usage }: { usage: AiUsageSummary }) {
  const ratio = usage.budgetUsd > 0 ? usage.costUsd / usage.budgetUsd : 0;
  const percent = Math.min(100, Math.round(ratio * 100));
  const tone = ratio >= 1 ? 'bg-destructive' : ratio >= 0.8 ? 'bg-warning' : 'bg-violet-600';
  return (
    <Card>
      <CardHeader>
        <CardTitle>بودجه ماه جاری</CardTitle>
        <p className="text-muted-foreground text-xs">از {date(usage.monthStart)} (ماه شمسی)</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-3xl font-black">{usd(usage.costUsd)}</span>
          <span className="text-muted-foreground text-sm">از سقف {usd(usage.budgetUsd)}</span>
        </div>
        <div
          className="bg-muted h-3 overflow-hidden rounded-full"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="درصد مصرف بودجه"
        >
          <div
            className={cn('h-full rounded-full transition-all', tone)}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {faNumber(percent)}٪ مصرف شده. با رسیدن به سقف، قابلیت‌های هوش مصنوعی تا ماه بعد متوقف
          می‌شوند (هزینه‌ها تخمینی و بر اساس توکن مصرفی است).
        </p>
      </CardContent>
    </Card>
  );
}

/** Daily cost columns for the month; hover/focus a column for exact values. */
function DailyChart({ daily }: { daily: AiUsageSummary['daily'] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...daily.map((d) => d.costUsd), 0.01);
  const shown = active !== null ? daily[active] : daily.at(-1);
  return (
    <Card>
      <CardHeader>
        <CardTitle>هزینه روزانه</CardTitle>
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {shown
            ? `${date(shown.date)}: ${usd(shown.costUsd)} · ${faNumber(shown.requests)} درخواست`
            : 'هنوز مصرفی ثبت نشده است.'}
        </p>
      </CardHeader>
      <CardContent>
        {daily.length === 0 ? (
          <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
            داده‌ای برای نمایش نیست
          </div>
        ) : (
          <div className="border-border flex h-36 items-end gap-1 border-b" role="list">
            {daily.map((day, index) => (
              <button
                key={day.date}
                type="button"
                role="listitem"
                aria-label={`${date(day.date)}: ${usd(day.costUsd)}، ${faNumber(day.requests)} درخواست`}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onBlur={() => setActive(null)}
                className="group flex h-full min-w-1 flex-1 items-end"
              >
                <span
                  className={cn(
                    'w-full rounded-t-[4px] bg-violet-500 transition-colors group-hover:bg-violet-700 group-focus:bg-violet-700',
                    active === index && 'bg-violet-700',
                  )}
                  style={{ height: `${Math.max(3, (day.costUsd / max) * 100)}%` }}
                />
              </button>
            ))}
            {/* Keep a month-wide scale so a few days of data don't become giant columns. */}
            {Array.from({ length: Math.max(0, 31 - daily.length) }, (_, i) => (
              <span key={`pad-${i}`} aria-hidden className="min-w-1 flex-1" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AiOverview({ view }: { view: AiSettingsView }) {
  const usage = useQuery({
    queryKey: ['admin', 'ai', 'usage'],
    queryFn: () => api.get<AiUsageSummary>('/admin/ai/usage'),
  });
  const { settings } = view;
  if (!usage.data) return <Skeleton className="h-96" />;
  const u = usage.data;
  const cacheRate =
    u.inputTokens + u.cacheReadTokens > 0
      ? Math.round((u.cacheReadTokens / (u.inputTokens + u.cacheReadTokens)) * 100)
      : 0;
  const maxFeature = Math.max(...u.byFeature.map((f) => f.costUsd), 0.0001);

  return (
    <div className="space-y-5">
      {!settings.enabled ? (
        <Alert variant="warning">هوش مصنوعی خاموش است. از زبانه «تنظیمات» آن را فعال کنید.</Alert>
      ) : settings.provider === 'mock' ? (
        <Alert variant="info">
          حالت آزمایشی فعال است: پاسخ‌ها بدون اتصال به اینترنت و به‌صورت نمونه تولید می‌شوند. برای
          پاسخ واقعی، کلید API را ثبت و ارائه‌دهنده را روی Anthropic بگذارید.
        </Alert>
      ) : !view.ready ? (
        <Alert variant="destructive">کلید API ثبت نشده است؛ قابلیت‌ها در دسترس نیستند.</Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="مدل"
          value={settings.model === 'claude-opus-5-5' ? 'Opus 5.5' : 'Sonnet 5.5'}
          hint={AI_MODEL_LABELS[settings.model]}
        />
        <Stat
          label="درخواست‌های این ماه"
          value={faNumber(u.requests)}
          hint={`${faNumber(u.refusals)} مورد رد شده توسط مدل`}
        />
        <Stat
          label="توکن ورودی / خروجی"
          value={`${compactTokens(u.inputTokens)} / ${compactTokens(u.outputTokens)}`}
        />
        <Stat
          label="نرخ استفاده از کش"
          value={`${faNumber(cacheRate)}٪`}
          hint="بخش ثابت دستورها کش می‌شود تا هزینه کمتر شود."
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <BudgetMeter usage={u} />
        <DailyChart daily={u.daily} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>مصرف به تفکیک قابلیت</CardTitle>
        </CardHeader>
        <CardContent>
          {u.byFeature.length === 0 ? (
            <p className="text-muted-foreground text-sm">هنوز مصرفی ثبت نشده است.</p>
          ) : (
            <ul className="space-y-3">
              {u.byFeature.map((f) => (
                <li
                  key={f.feature}
                  className="grid grid-cols-[9rem_minmax(0,1fr)_auto] items-center gap-3 text-sm sm:grid-cols-[14rem_minmax(0,1fr)_auto]"
                >
                  <span className="truncate">{AI_FEATURE_LABELS[f.feature]}</span>
                  <span className="bg-muted h-2.5 overflow-hidden rounded-full">
                    <span
                      className="block h-full rounded-full bg-violet-500"
                      style={{ width: `${Math.max(2, (f.costUsd / maxFeature) * 100)}%` }}
                    />
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap text-xs">
                    {usd(f.costUsd)} · {faNumber(f.requests)} درخواست
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
