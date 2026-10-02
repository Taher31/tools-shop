import { z } from 'zod';
import { idSchema, optionalTextSchema, textSchema } from './common';

/** Models offered in the AI Center. Claude Opus 5.5 is the default (highest quality). */
export const AI_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5'] as const;
export type AiModel = (typeof AI_MODELS)[number];
export const AI_MODEL_LABELS: Record<AiModel, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5 – بیشترین کیفیت (پیش‌فرض)',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5 – سریع‌تر و کم‌هزینه‌تر',
};

export const AI_FEATURES = ['assistant', 'messenger', 'qa', 'support', 'content'] as const;
export type AiFeature = (typeof AI_FEATURES)[number];
export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  assistant: 'دستیار هوشمند فروشگاه',
  messenger: 'ربات پیام‌رسان‌ها',
  qa: 'پیشنهاد پاسخ پرسش محصولات',
  support: 'پیش‌نویس و دسته‌بندی تیکت‌ها',
  content: 'تولید محتوا و سئو محصول',
};

/**
 * - `anthropic`: Claude through the official API (best tool use, prompt caching).
 * - `openai_compatible`: any server speaking the OpenAI Chat Completions protocol –
 *   OpenRouter, OpenAI, Groq, DeepSeek, Together, a local Ollama/vLLM/LM Studio, …
 * - `mock`: deterministic answers without any external call (development, tests, demos).
 */
export const AI_PROVIDERS = ['anthropic', 'openai_compatible', 'mock'] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];
export const AI_PROVIDER_LABELS: Record<AiProviderName, string> = {
  anthropic: 'Anthropic (Claude)',
  openai_compatible: 'سازگار با OpenAI (OpenRouter، OpenAI، Groq، DeepSeek، Ollama و …)',
  mock: 'آزمایشی (بدون اتصال، برای توسعه و دمو)',
};

/**
 * How structured JSON answers (ticket triage, product copy…) are requested from an
 * OpenAI-compatible server: strict JSON Schema, plain JSON mode, or just by prompt.
 */
export const COMPAT_STRUCTURED_MODES = ['json_schema', 'json_object', 'prompt'] as const;
export type CompatStructuredMode = (typeof COMPAT_STRUCTURED_MODES)[number];
export const COMPAT_STRUCTURED_LABELS: Record<CompatStructuredMode, string> = {
  json_schema: 'JSON Schema سخت‌گیرانه (OpenAI، OpenRouter، بیشتر مدل‌های جدید)',
  json_object: 'حالت JSON ساده (DeepSeek، برخی مدل‌های متن‌باز)',
  prompt: 'فقط با دستور متنی (سازگارترین؛ برای سرورهای محلی)',
};

/** Starting points for the OpenAI-compatible provider; only the address is filled in. */
export const COMPAT_PRESETS = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelHint: 'anthropic/claude-sonnet-4.5',
    structured: 'json_schema',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelHint: 'gpt-4o',
    structured: 'json_schema',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelHint: 'llama-3.3-70b-versatile',
    structured: 'json_object',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    modelHint: 'deepseek-chat',
    structured: 'json_object',
  },
  {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    modelHint: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    structured: 'json_object',
  },
  {
    id: 'ollama',
    label: 'Ollama (روی همین سرور)',
    baseUrl: 'http://localhost:11434/v1',
    modelHint: 'qwen2.5:14b',
    structured: 'prompt',
  },
  { id: 'custom', label: 'سرور دلخواه', baseUrl: '', modelHint: '', structured: 'prompt' },
] as const satisfies readonly {
  id: string;
  label: string;
  baseUrl: string;
  modelHint: string;
  structured: CompatStructuredMode;
}[];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'host.docker.internal']);

/**
 * Server-side requests go to this address, so it is restricted: HTTPS except for the
 * local machine, no credentials in the URL, and never a cloud-metadata endpoint.
 */
export function validateCompatBaseUrl(value: string): string | null {
  if (!value) return null;
  if (/@/.test(value.replace(/^https?:\/\//i, '').split('/')[0] ?? '')) {
    return 'نام کاربری و رمز را در نشانی نگذارید.';
  }
  const match = /^(https?):\/\/(\[[0-9a-f:]+\]|[a-z0-9.-]+)(?::\d{1,5})?(?:\/[^\s?#]*)?$/i.exec(
    value,
  );
  if (!match) return 'نشانی معتبر نیست؛ مثل https://openrouter.ai/api/v1';
  const protocol = (match[1] as string).toLowerCase();
  const host = (match[2] as string).toLowerCase();
  if (protocol === 'http' && !LOCAL_HOSTS.has(host)) {
    return 'برای سرورهای غیرمحلی فقط https مجاز است.';
  }
  if ((/^169\.254\./.test(host) || host.endsWith('.internal')) && host !== 'host.docker.internal') {
    return 'این نشانی مجاز نیست.';
  }
  return null;
}

export const aiSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(AI_PROVIDERS).default('mock'),
  model: z.enum(AI_MODELS).default('claude-opus-5-5'),
  /** Model for the OpenAI-compatible provider (free text, as the server names it). */
  compatModel: z.string().trim().max(160).default(''),
  /** Base URL of the OpenAI-compatible server (…/v1). */
  compatBaseUrl: z
    .string()
    .trim()
    .max(300)
    .default('')
    .refine((value) => validateCompatBaseUrl(value) === null, {
      message: 'نشانی سرور معتبر یا مجاز نیست (https لازم است؛ http فقط برای localhost).',
    }),
  compatStructuredMode: z.enum(COMPAT_STRUCTURED_MODES).default('json_schema'),
  /** Used to estimate spend against the budget; 0 = unknown (spend shows as zero). */
  compatInputPriceUsd: z.coerce.number().min(0).max(1000).default(0),
  compatOutputPriceUsd: z.coerce.number().min(0).max(1000).default(0),
  /** Hard monthly cap (USD, estimated from token usage). Features pause when reached. */
  monthlyBudgetUsd: z.coerce.number().min(1).max(100_000).default(50),
  features: z
    .object({
      assistant: z.boolean().default(true),
      messenger: z.boolean().default(false),
      qa: z.boolean().default(true),
      support: z.boolean().default(true),
      content: z.boolean().default(true),
    })
    .default({ assistant: true, messenger: false, qa: true, support: true, content: true }),
  assistantName: textSchema({ max: 40 }).default('دستیار هوشمند'),
  assistantGreeting: textSchema({ max: 300 }).default(
    'سلام! برای انتخاب ابزار مناسب، مقایسه مدل‌ها یا پیگیری سفارش کمکتان می‌کنم.',
  ),
  /** Extra guidance about the store's voice and policies, appended to the assistant prompt. */
  storeVoice: optionalTextSchema(1500),
  /** Publish AI answers to product questions without review when confidence is high. Off by default. */
  qaAutoPublish: z.boolean().default(false),
  qaAutoPublishMinConfidence: z.coerce.number().min(0.6).max(1).default(0.9),
  /** Assistant messages allowed per visitor per hour. */
  assistantHourlyLimit: z.coerce.number().int().min(5).max(500).default(30),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const aiSecretsUpdateSchema = z
  .object({
    /** Omitted: unchanged. Empty string: remove (ANTHROPIC_API_KEY from the environment still applies). */
    anthropicApiKey: z.string().trim().max(400).optional(),
    /** Omitted: unchanged. Empty string: remove (AI_COMPAT_API_KEY from the environment still applies). */
    compatApiKey: z.string().trim().max(400).optional(),
  })
  .refine((value) => value.anthropicApiKey !== undefined || value.compatApiKey !== undefined, {
    message: 'هیچ کلیدی ارسال نشده است.',
  });
export type AiSecretsUpdateInput = z.infer<typeof aiSecretsUpdateSchema>;

export const assistantMessageSchema = z.object({
  message: textSchema({ min: 1, max: 1000 }),
  conversationId: idSchema.nullish().transform((value) => value ?? null),
});
export type AssistantMessageInput = z.infer<typeof assistantMessageSchema>;

export const productContentRequestSchema = z.object({
  productId: idSchema.nullish().transform((value) => value ?? null),
  title: textSchema({ max: 200 }),
  categoryId: idSchema,
  brandId: idSchema.nullish().transform((value) => value ?? null),
  model: optionalTextSchema(120),
  attributes: z
    .array(
      z.object({
        attributeId: idSchema,
        value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
      }),
    )
    .max(100)
    .default([]),
  /** Optional instruction, e.g. "focus on professional users". */
  instructions: optionalTextSchema(500),
});
export type ProductContentRequest = z.infer<typeof productContentRequestSchema>;

/* ------------------------------------------------------------- messengers */

export const MESSENGER_CHANNELS = ['telegram', 'bale', 'eitaa'] as const;
export type MessengerChannel = (typeof MESSENGER_CHANNELS)[number];
export const MESSENGER_LABELS: Record<MessengerChannel, string> = {
  telegram: 'تلگرام',
  bale: 'بله',
  eitaa: 'ایتا',
};

export const messengerUpdateSchema = z.object({
  enabled: z.boolean(),
  /** Omitted: keep the stored token. Empty string: remove it. */
  botToken: z.string().trim().max(200).optional(),
});
export type MessengerUpdateInput = z.infer<typeof messengerUpdateSchema>;
