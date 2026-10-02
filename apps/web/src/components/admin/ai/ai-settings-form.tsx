'use client';

import {
  AI_FEATURE_LABELS,
  AI_FEATURES,
  AI_MODEL_LABELS,
  AI_MODELS,
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  type AiConnectionTest,
  type AiKeyInfo,
  COMPAT_PRESETS,
  COMPAT_STRUCTURED_LABELS,
  COMPAT_STRUCTURED_MODES,
  type CompatStructuredMode,
  validateCompatBaseUrl,
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
import { KeyRound, PlugZap, Save } from 'lucide-react';
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

function ApiKeyCard({
  title,
  field,
  info,
  placeholder,
  note,
  canManage,
}: {
  title: string;
  field: 'anthropicApiKey' | 'compatApiKey';
  info: AiKeyInfo;
  placeholder: string;
  note: string;
  canManage: boolean;
}) {
  const [key, setKey] = useState('');
  const save = useAdminMutation(
    (value: string) => api.put<AiSettingsView>('/admin/ai/secrets', { [field]: value }),
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
          <KeyRound className="size-4" /> {title}
        </CardTitle>
        <p className="text-muted-foreground text-xs leading-6">{note}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={info.source === 'none' ? 'secondary' : 'success'}>
            {KEY_SOURCE[info.source]}
          </Badge>
          {info.preview ? (
            <span className="ltr text-muted-foreground font-mono text-xs">{info.preview}</span>
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
              placeholder={placeholder}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (key.trim()) save.mutate(key.trim());
              }}
              aria-label={`${title} جدید`}
            />
            <Button
              type="button"
              disabled={!key.trim() || save.isPending}
              onClick={() => save.mutate(key.trim())}
            >
              {save.isPending ? <Spinner /> : null}
              ثبت کلید
            </Button>
            {info.source === 'settings' ? (
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

/** Sends one tiny request with the SAVED settings, so save first, then test. */
function ConnectionTest({ canManage, dirty }: { canManage: boolean; dirty: boolean }) {
  const [result, setResult] = useState<AiConnectionTest | null>(null);
  const test = useAdminMutation(() => api.post<AiConnectionTest>('/admin/ai/test'), {
    invalidate: [],
    onSuccess: setResult,
  });
  if (!canManage) return null;
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={test.isPending}
        onClick={() => test.mutate()}
      >
        {test.isPending ? <Spinner /> : <PlugZap />}
        تست اتصال با تنظیمات ذخیره‌شده
      </Button>
      {dirty ? (
        <p className="text-warning text-xs">
          تغییرات ذخیره‌نشده در تست اعمال نمی‌شود؛ ابتدا ذخیره کنید.
        </p>
      ) : null}
      {result ? (
        <Alert variant={result.ok ? 'success' : 'destructive'}>
          <span className="ltr block text-start text-xs">
            {result.model} · {result.latencyMs}ms
          </span>
          {result.ok
            ? `اتصال برقرار است؛ پاسخ مدل: «${result.message}»`
            : `ناموفق: ${result.message}`}
        </Alert>
      ) : null}
    </div>
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
                {AI_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {AI_PROVIDER_LABELS[p]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {form.provider === 'anthropic' ? (
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
            ) : null}
            {form.provider === 'openai_compatible' ? (
              <div className="bg-muted/40 grid gap-4 rounded-lg p-4 md:col-span-2 md:grid-cols-2">
                <p className="text-muted-foreground text-xs leading-6 md:col-span-2">
                  هر سرویسی که پروتکل OpenAI (Chat Completions) را بفهمد کار می‌کند: OpenRouter،
                  OpenAI، Groq، DeepSeek، Together، Ollama یا سرور شخصی. نشانی و نام مدل را همان‌طور
                  که سرویس می‌خواهد وارد کنید. قابلیت فراخوانی ابزار (tool calling) برای دستیار فروش
                  لازم است؛ بیشتر مدل‌های جدید آن را دارند.
                </p>
                <Field label="الگوی سرویس" htmlFor="ai-preset">
                  <NativeSelect
                    id="ai-preset"
                    disabled={disabled}
                    value={
                      COMPAT_PRESETS.find((p) => p.baseUrl && p.baseUrl === form.compatBaseUrl)
                        ?.id ?? 'custom'
                    }
                    onChange={(e) => {
                      const preset = COMPAT_PRESETS.find((p) => p.id === e.target.value);
                      if (!preset) return;
                      setForm((current) => ({
                        ...current,
                        compatBaseUrl: preset.baseUrl || current.compatBaseUrl,
                        compatStructuredMode: preset.structured as CompatStructuredMode,
                      }));
                    }}
                  >
                    {COMPAT_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field
                  label="نشانی سرور (Base URL)"
                  htmlFor="ai-base-url"
                  error={validateCompatBaseUrl(form.compatBaseUrl) ?? undefined}
                  hint="تا …/v1؛ فقط https (http فقط برای localhost)"
                >
                  <Input
                    id="ai-base-url"
                    dir="ltr"
                    className="text-left"
                    placeholder="https://openrouter.ai/api/v1"
                    value={form.compatBaseUrl}
                    disabled={disabled}
                    onChange={(e) => set('compatBaseUrl', e.target.value.trim())}
                  />
                </Field>
                <Field
                  label="نام مدل"
                  htmlFor="ai-compat-model"
                  hint={
                    (COMPAT_PRESETS.find((p) => p.baseUrl === form.compatBaseUrl)?.modelHint ?? '')
                      ? `مثلاً ${COMPAT_PRESETS.find((p) => p.baseUrl === form.compatBaseUrl)?.modelHint}`
                      : 'دقیقاً مطابق نام در سرویس'
                  }
                >
                  <Input
                    id="ai-compat-model"
                    dir="ltr"
                    className="text-left"
                    placeholder="provider/model-name"
                    value={form.compatModel}
                    disabled={disabled}
                    onChange={(e) => set('compatModel', e.target.value)}
                  />
                </Field>
                <Field
                  label="روش خروجی ساخت‌یافته"
                  htmlFor="ai-structured"
                  hint="برای پیش‌نویس تیکت، تولید محتوا و …"
                >
                  <NativeSelect
                    id="ai-structured"
                    value={form.compatStructuredMode}
                    disabled={disabled}
                    onChange={(e) =>
                      set('compatStructuredMode', e.target.value as CompatStructuredMode)
                    }
                  >
                    {COMPAT_STRUCTURED_MODES.map((m) => (
                      <option key={m} value={m}>
                        {COMPAT_STRUCTURED_LABELS[m]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field
                  label="قیمت ورودی (دلار برای هر میلیون توکن)"
                  htmlFor="ai-price-in"
                  hint="برای محاسبه هزینه و بودجه؛ ۰ = نامشخص"
                >
                  <Input
                    id="ai-price-in"
                    type="number"
                    min={0}
                    step="any"
                    dir="ltr"
                    className="text-left"
                    value={form.compatInputPriceUsd}
                    disabled={disabled}
                    onChange={(e) => set('compatInputPriceUsd', Number(e.target.value))}
                  />
                </Field>
                <Field label="قیمت خروجی (دلار برای هر میلیون توکن)" htmlFor="ai-price-out">
                  <Input
                    id="ai-price-out"
                    type="number"
                    min={0}
                    step="any"
                    dir="ltr"
                    className="text-left"
                    value={form.compatOutputPriceUsd}
                    disabled={disabled}
                    onChange={(e) => set('compatOutputPriceUsd', Number(e.target.value))}
                  />
                </Field>
              </div>
            ) : null}
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
            <CardTitle>نظرات و پرسش‌ها (هوش مصنوعی اول)</CardTitle>
            <p className="text-muted-foreground text-xs leading-6">
              بدون انتظار برای کارشناس؛ کارشناس همیشه می‌تواند نتیجه را ویرایش یا لغو کند و همه
              اقدام‌های خودکار در گزارش رویدادها ثبت می‌شوند.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="تأیید خودکار نظرات"
              hint="نظر صادقانه (حتی منفی) بلافاصله منتشر می‌شود؛ توهین، تبلیغ و لینک رد یا به کارشناس ارجاع می‌شود."
              checked={form.reviewAutoModeration}
              disabled={disabled}
              onChange={(v) => set('reviewAutoModeration', v)}
            />
            <ToggleRow
              label="پاسخ خودکار به پرسش‌ها"
              hint="هر جا مشخصات کالا اجازه پاسخ مفید بدهد، دستیار مستقیم پاسخ می‌دهد (با برچسب «دستیار هوشمند»)."
              checked={form.qaAutoPublish}
              disabled={disabled}
              onChange={(v) => set('qaAutoPublish', v)}
            />
            <Field
              label="حداقل اطمینان برای پاسخ (۰٫۲ تا ۱)"
              htmlFor="ai-conf"
              hint="عدد کمتر = پاسخ بیشتر توسط AI، با احتمال خطای بیشتر. پیشنهاد: ۰٫۵"
            >
              <Input
                id="ai-conf"
                type="number"
                step={0.05}
                min={0.2}
                max={1}
                dir="ltr"
                className="text-left"
                value={form.qaAutoPublishMinConfidence}
                disabled={disabled || !form.qaAutoPublish}
                onChange={(e) => set('qaAutoPublishMinConfidence', Number(e.target.value))}
              />
            </Field>
            <ToggleRow
              label="پیام «کارشناس پاسخ می‌دهد»"
              hint="اگر AI نتوانست پاسخ دهد، زیر پرسش نوشته می‌شود که کارشناس چند ساعت دیگر پاسخ می‌دهد."
              checked={form.qaHoldingNotice}
              disabled={disabled}
              onChange={(v) => set('qaHoldingNotice', v)}
            />
            <Field label="مهلت اعلام‌شده به مشتری (ساعت)" htmlFor="ai-hours">
              <Input
                id="ai-hours"
                type="number"
                min={1}
                max={72}
                dir="ltr"
                className="text-left"
                value={form.qaExpertHours}
                disabled={disabled || !form.qaHoldingNotice}
                onChange={(e) => set('qaExpertHours', Number(e.target.value))}
              />
            </Field>
          </CardContent>
        </Card>
        {form.provider === 'anthropic' ? (
          <ApiKeyCard
            title="کلید API (Anthropic)"
            field="anthropicApiKey"
            info={view.key}
            placeholder="sk-ant-…"
            note="کلید فقط در سرور و به‌صورت رمزنگاری‌شده (AES-256-GCM) نگهداری می‌شود و هرگز به مرورگر ارسال نمی‌شود."
            canManage={canManage}
          />
        ) : null}
        {form.provider === 'openai_compatible' ? (
          <ApiKeyCard
            title="کلید API سرویس"
            field="compatApiKey"
            info={view.compatKey}
            placeholder="sk-or-… / sk-…"
            note="برای سرورهای محلی (Ollama) لازم نیست. کلید رمزنگاری‌شده در سرور نگهداری می‌شود و به مرورگر نمی‌رسد."
            canManage={canManage}
          />
        ) : null}
        {form.provider !== 'mock' ? (
          <Card>
            <CardContent className="pt-5">
              <ConnectionTest
                canManage={canManage}
                dirty={JSON.stringify(form) !== JSON.stringify(view.settings)}
              />
            </CardContent>
          </Card>
        ) : null}
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
