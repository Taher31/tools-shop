'use client';

import {
  AI_FEATURE_LABELS,
  AI_FEATURES,
  AI_MODEL_LABELS,
  AI_MODELS,
  type AiSettings,
  type AiSettingsView,
} from '@toolshop/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  NativeSelect,
  Spinner,
  Switch,
  Textarea,
} from '@toolshop/ui';
import { KeyRound, Save } from 'lucide-react';
import { useState } from 'react';
import { useAdminMutation } from '@/components/admin/query';
import { api } from '@/lib/api/client';

const KEY_SOURCE = {
  settings: 'ثبت‌شده در پنل (رمزنگاری‌شده)',
  environment: 'متغیر محیطی ANTHROPIC_API_KEY',
  none: 'ثبت نشده',
} as const;

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="border-border flex items-start justify-between gap-4 rounded-md border p-3">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? (
          <span className="text-muted-foreground block text-xs leading-6">{hint}</span>
        ) : null}
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

function ApiKeyCard({ view, canManage }: { view: AiSettingsView; canManage: boolean }) {
  const [key, setKey] = useState('');
  const save = useAdminMutation(
    (anthropicApiKey: string) => api.put<AiSettingsView>('/admin/ai/secrets', { anthropicApiKey }),
    {
      success: 'کلید API به‌روز شد.',
      invalidate: [['admin', 'ai']],
      onSuccess: () => setKey(''),
    },
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> کلید API (Anthropic)
        </CardTitle>
        <p className="text-muted-foreground text-xs leading-6">
          کلید فقط در سرور و به‌صورت رمزنگاری‌شده (AES-256-GCM) نگهداری می‌شود و هرگز به مرورگر
          ارسال نمی‌شود.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={view.key.source === 'none' ? 'secondary' : 'success'}>
            {KEY_SOURCE[view.key.source]}
          </Badge>
          {view.key.preview ? (
            <span className="ltr text-muted-foreground font-mono text-xs">{view.key.preview}</span>
          ) : null}
        </div>
        {canManage ? (
          // Not a <form>: this card sits inside the settings form.
          <div className="flex flex-wrap gap-2">
            <Input
              type="password"
              autoComplete="off"
              dir="ltr"
              className="min-w-0 flex-1 text-left"
              placeholder="sk-ant-…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (key.trim()) save.mutate(key.trim());
              }}
              aria-label="کلید API جدید"
            />
            <Button
              type="button"
              disabled={!key.trim() || save.isPending}
              onClick={() => save.mutate(key.trim())}
            >
              {save.isPending ? <Spinner /> : null}
              ثبت کلید
            </Button>
            {view.key.source === 'settings' ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={save.isPending}
                onClick={() => save.mutate('')}
              >
                حذف کلید
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AiSettingsForm({ view, canManage }: { view: AiSettingsView; canManage: boolean }) {
  const [form, setForm] = useState<AiSettings>(view.settings);
  const set = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = useAdminMutation(
    (input: AiSettings) => api.put<AiSettingsView>('/admin/ai/settings', input),
    {
      success: 'تنظیمات هوش مصنوعی ذخیره شد.',
      invalidate: [['admin', 'ai']],
      onSuccess: (saved) => setForm(saved.settings),
    },
  );
  const disabled = !canManage || save.isPending;

  return (
    <form
      className="grid items-start gap-5 xl:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(form);
      }}
    >
      <div className="space-y-5 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>موتور هوش مصنوعی</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ToggleRow
                label="فعال بودن هوش مصنوعی"
                hint="کلید اصلی؛ در حالت خاموش هیچ درخواستی به مدل ارسال نمی‌شود."
                checked={form.enabled}
                disabled={disabled}
                onChange={(v) => set('enabled', v)}
              />
            </div>
            <Field label="ارائه‌دهنده" htmlFor="ai-provider">
              <NativeSelect
                id="ai-provider"
                value={form.provider}
                disabled={disabled}
                onChange={(e) => set('provider', e.target.value as AiSettings['provider'])}
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="mock">آزمایشی (بدون اتصال، برای توسعه و دمو)</option>
              </NativeSelect>
            </Field>
            <Field label="مدل" htmlFor="ai-model">
              <NativeSelect
                id="ai-model"
                value={form.model}
                disabled={disabled}
                onChange={(e) => set('model', e.target.value as AiSettings['model'])}
              >
                {AI_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {AI_MODEL_LABELS[m]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="سقف هزینه ماهانه (دلار)"
              htmlFor="ai-budget"
              hint="با رسیدن به سقف، قابلیت‌ها تا ماه بعد متوقف می‌شوند."
            >
              <Input
                id="ai-budget"
                type="number"
                min={1}
                dir="ltr"
                className="text-left"
                value={form.monthlyBudgetUsd}
                disabled={disabled}
                onChange={(e) => set('monthlyBudgetUsd', Number(e.target.value))}
              />
            </Field>
            <Field
              label="سقف پیام هر بازدیدکننده در ساعت"
              htmlFor="ai-limit"
              hint="برای دستیار سایت و ربات‌ها؛ جلوی سوءاستفاده و هزینه ناخواسته را می‌گیرد."
            >
              <Input
                id="ai-limit"
                type="number"
                min={5}
                max={500}
                dir="ltr"
                className="text-left"
                value={form.assistantHourlyLimit}
                disabled={disabled}
                onChange={(e) => set('assistantHourlyLimit', Number(e.target.value))}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>شخصیت دستیار</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="نام دستیار" htmlFor="ai-name">
              <Input
                id="ai-name"
                maxLength={40}
                value={form.assistantName}
                disabled={disabled}
                onChange={(e) => set('assistantName', e.target.value)}
              />
            </Field>
            <Field label="پیام خوش‌آمد" htmlFor="ai-greeting">
              <Textarea
                id="ai-greeting"
                rows={2}
                maxLength={300}
                value={form.assistantGreeting}
                disabled={disabled}
                onChange={(e) => set('assistantGreeting', e.target.value)}
              />
            </Field>
            <Field
              label="لحن و سیاست‌های فروشگاه"
              htmlFor="ai-voice"
              hint="مثلاً «همیشه ارسال رایگان بالای ۲ میلیون تومان را یادآوری کن». قوانین ایمنی دستیار قابل تغییر نیستند."
            >
              <Textarea
                id="ai-voice"
                rows={4}
                maxLength={1500}
                value={form.storeVoice ?? ''}
                disabled={disabled}
                onChange={(e) => set('storeVoice', e.target.value || null)}
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>قابلیت‌ها</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {AI_FEATURES.map((feature) => (
              <ToggleRow
                key={feature}
                label={AI_FEATURE_LABELS[feature]}
                checked={form.features[feature]}
                disabled={disabled}
                onChange={(v) => set('features', { ...form.features, [feature]: v })}
              />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>انتشار خودکار پاسخ پرسش‌ها</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="انتشار بدون بازبینی"
              hint="فقط وقتی مدل مطمئن است و پرسش نیاز به بررسی انسانی ندارد. همه موارد در گزارش فعالیت ثبت می‌شوند."
              checked={form.qaAutoPublish}
              disabled={disabled}
              onChange={(v) => set('qaAutoPublish', v)}
            />
            <Field label="حداقل اطمینان (۰٫۶ تا ۱)" htmlFor="ai-conf">
              <Input
                id="ai-conf"
                type="number"
                step={0.05}
                min={0.6}
                max={1}
                dir="ltr"
                className="text-left"
                value={form.qaAutoPublishMinConfidence}
                disabled={disabled || !form.qaAutoPublish}
                onChange={(e) => set('qaAutoPublishMinConfidence', Number(e.target.value))}
              />
            </Field>
          </CardContent>
        </Card>
        <ApiKeyCard view={view} canManage={canManage} />
        {canManage ? (
          <Button type="submit" size="lg" className="w-full" disabled={save.isPending}>
            {save.isPending ? <Spinner /> : <Save />}
            ذخیره تنظیمات
          </Button>
        ) : (
          <Alert variant="info">برای تغییر تنظیمات به دسترسی «ai.manage» نیاز دارید.</Alert>
        )}
      </div>
    </form>
  );
}
