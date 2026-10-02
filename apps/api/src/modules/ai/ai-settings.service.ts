import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import {
  type AiConnectionTest,
  type AiFeature,
  type AiKeyInfo,
  type AiSecretsUpdateInput,
  type AiSettings,
  aiSettingsSchema,
  type AiSettingsView,
} from '@toolshop/shared';
import { decryptSecret, encryptSecret } from '../../common/utils/crypto';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CacheService } from '../../infrastructure/redis/cache.service';
import { AuditService } from '../audit/audit.service';
import { AiUnavailableError } from './ai-errors';
import { AnthropicLlmClient } from './llm/anthropic-llm.client';
import type { LlmClient } from './llm/llm-client';
import { MockLlmClient } from './llm/mock-llm.client';
import { OpenAiCompatibleLlmClient } from './llm/openai-compatible-llm.client';
import type { PriceOverride } from './pricing';

const SETTINGS_KEY = 'ai';
const SECRETS_KEY = 'ai_secrets';
const CACHE_KEY = 'ai:settings';
type SecretName = 'anthropicApiKey' | 'compatApiKey';

/**
 * AI configuration. Non-secret settings live in the `ai` setting; the API key is stored
 * AES-256-GCM encrypted in a separate row that is never returned or audited in clear.
 * The ANTHROPIC_API_KEY environment variable is honoured when no key is stored.
 */
@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);
  private client: { key: string; llm: LlmClient } | null = null;
  private compat: { key: string; llm: LlmClient } | null = null;
  private readonly mock = new MockLlmClient();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  async get(): Promise<AiSettings> {
    return this.cache.wrap(CACHE_KEY, 120, async () => {
      const row = await this.prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
      const parsed = aiSettingsSchema.safeParse(row?.value ?? {});
      return parsed.success ? parsed.data : aiSettingsSchema.parse({});
    });
  }

  async view(): Promise<AiSettingsView> {
    const [settings, anthropic, compat] = await Promise.all([
      this.get(),
      this.keyInfo('anthropicApiKey', process.env['ANTHROPIC_API_KEY']),
      this.keyInfo('compatApiKey', process.env['AI_COMPAT_API_KEY']),
    ]);
    const ready =
      settings.provider === 'mock' ||
      (settings.provider === 'anthropic' && anthropic.source !== 'none') ||
      // Local servers (Ollama…) need no key; the address and model are what matter.
      (settings.provider === 'openai_compatible' &&
        Boolean(settings.compatBaseUrl && settings.compatModel));
    return { settings, key: anthropic, compatKey: compat, ready };
  }

  private async keyInfo(name: SecretName, envValue: string | undefined): Promise<AiKeyInfo> {
    const stored = await this.storedSecret(name);
    const active = stored ?? envValue ?? null;
    return {
      source: stored ? 'settings' : envValue ? 'environment' : 'none',
      preview: active ? `••••${active.slice(-4)}` : null,
    };
  }

  async update(input: AiSettings): Promise<AiSettingsView> {
    const before = await this.get();
    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: SETTINGS_KEY },
        update: { value: input as unknown as Prisma.InputJsonValue },
        create: { key: SETTINGS_KEY, value: input as unknown as Prisma.InputJsonValue },
      });
      await this.audit.record(
        {
          action: 'ai.settings.update',
          entityType: 'setting',
          entityId: SETTINGS_KEY,
          before: before as unknown as Record<string, unknown>,
          after: input as unknown as Record<string, unknown>,
        },
        tx,
      );
    });
    await this.cache.del(CACHE_KEY);
    return this.view();
  }

  async updateSecrets(input: AiSecretsUpdateInput): Promise<AiSettingsView> {
    const row = await this.prisma.setting.findUnique({ where: { key: SECRETS_KEY } });
    const value: Record<string, string> = { ...(row?.value as Record<string, string> | null) };
    const changed: string[] = [];
    for (const [name, label] of [
      ['anthropicApiKey', 'Anthropic'],
      ['compatApiKey', 'سرور سازگار با OpenAI'],
    ] as const) {
      const next = input[name];
      if (next === undefined) continue;
      if (next) value[name] = encryptSecret(next, this.config.encryptionKey);
      else delete value[name];
      changed.push(`${next ? 'ثبت' : 'حذف'} کلید ${label}`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: SECRETS_KEY },
        update: { value },
        create: { key: SECRETS_KEY, value },
      });
      // Only the fact that a key changed is audited, never the key.
      await this.audit.record(
        {
          action: 'ai.key.update',
          entityType: 'setting',
          entityId: SECRETS_KEY,
          summary: changed.join('، '),
        },
        tx,
      );
    });
    this.client = null;
    this.compat = null;
    return this.view();
  }

  /**
   * The model client for a feature, or an AppException explaining why AI is off.
   * Features stay unavailable (never silently mocked) when the real provider has no key.
   */
  async clientFor(feature: AiFeature): Promise<{
    llm: LlmClient;
    settings: AiSettings;
    model: string;
    /** Administrator-entered prices (compatible servers); null = built-in price list. */
    pricing: PriceOverride | null;
  }> {
    const settings = await this.get();
    if (!settings.enabled || !settings.features[feature]) {
      throw new AiUnavailableError('disabled', 'این قابلیت هوش مصنوعی فعال نیست.');
    }
    return this.build(settings);
  }

  /** Builds the client for the saved settings (no enabled/feature checks). */
  private async build(settings: AiSettings) {
    if (settings.provider === 'mock') {
      return { llm: this.mock, settings, model: settings.model, pricing: null };
    }
    if (settings.provider === 'openai_compatible') {
      if (!settings.compatBaseUrl || !settings.compatModel) {
        throw new AiUnavailableError(
          'no_key',
          'نشانی سرور و نام مدل در تنظیمات هوش مصنوعی ثبت نشده است.',
        );
      }
      const key =
        (await this.storedSecret('compatApiKey')) ?? process.env['AI_COMPAT_API_KEY'] ?? null;
      const signature = `${settings.compatBaseUrl}|${settings.compatStructuredMode}|${key ?? ''}`;
      if (!this.compat || this.compat.key !== signature) {
        this.compat = {
          key: signature,
          llm: new OpenAiCompatibleLlmClient({
            baseUrl: settings.compatBaseUrl,
            apiKey: key,
            structuredMode: settings.compatStructuredMode,
            referer: this.config.publicUrl,
          }),
        };
      }
      return {
        llm: this.compat.llm,
        settings,
        model: settings.compatModel,
        pricing: {
          inputUsd: settings.compatInputPriceUsd,
          outputUsd: settings.compatOutputPriceUsd,
        },
      };
    }
    const key = (await this.storedSecret('anthropicApiKey')) ?? process.env['ANTHROPIC_API_KEY'];
    if (!key) throw new AiUnavailableError('no_key', 'کلید API هوش مصنوعی تنظیم نشده است.');
    if (!this.client || this.client.key !== key) {
      this.client = {
        key,
        llm: new AnthropicLlmClient(key, {
          baseURL: process.env['ANTHROPIC_BASE_URL'] || undefined,
        }),
      };
    }
    return { llm: this.client.llm, settings, model: settings.model, pricing: null };
  }

  /** One tiny request with the saved settings, to check address, key and model. */
  async testConnection(): Promise<AiConnectionTest> {
    const settings = await this.get();
    const started = Date.now();
    try {
      const { llm, model } = await this.build(settings);
      const message = await llm.stream({
        model,
        max_tokens: 40,
        messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
      });
      const reply = message.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('')
        .trim();
      return {
        ok: true,
        provider: settings.provider,
        model,
        latencyMs: Date.now() - started,
        message: reply.slice(0, 80) || '(پاسخ خالی)',
      };
    } catch (error) {
      // The reason may name the provider's HTTP status but never carries credentials.
      const reason =
        error instanceof AiUnavailableError
          ? error.message
          : error instanceof Error
            ? error.message.slice(0, 240)
            : 'unknown error';
      this.logger.warn({ provider: settings.provider, reason }, 'AI connection test failed');
      return {
        ok: false,
        provider: settings.provider,
        model: settings.provider === 'openai_compatible' ? settings.compatModel : settings.model,
        latencyMs: Date.now() - started,
        message: reason.replace(/(sk|key|Bearer)[-_ ]?[A-Za-z0-9._-]{12,}/g, '$1••••'),
      };
    }
  }

  private async storedSecret(name: SecretName): Promise<string | null> {
    const row = await this.prisma.setting.findUnique({ where: { key: SECRETS_KEY } });
    const encrypted = (row?.value as Record<string, string> | null)?.[name];
    if (!encrypted) return null;
    try {
      return decryptSecret(encrypted, this.config.encryptionKey);
    } catch (error) {
      this.logger.error(
        { err: error },
        'Could not decrypt an AI API key (APP_ENCRYPTION_KEY changed?)',
      );
      return null;
    }
  }
}
