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

/** `mock` answers deterministically without any external call (development, tests, demos). */
export const AI_PROVIDERS = ['anthropic', 'mock'] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

export const aiSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(AI_PROVIDERS).default('mock'),
  model: z.enum(AI_MODELS).default('claude-opus-5-5'),
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

export const aiSecretsUpdateSchema = z.object({
  /** Empty string removes the stored key (the ANTHROPIC_API_KEY environment variable still applies). */
  anthropicApiKey: z.string().trim().max(400),
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
