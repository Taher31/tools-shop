import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import {
  type AiFeature,
  type AiSecretsUpdateInput,
  type AiSettings,
  aiSettingsSchema,
  type AiSettingsView,
} from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { decryptSecret, encryptSecret } from '../../common/utils/crypto';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CacheService } from '../../infrastructure/redis/cache.service';
import { AuditService } from '../audit/audit.service';
import { AnthropicLlmClient } from './llm/anthropic-llm.client';
import type { LlmClient } from './llm/llm-client';
import { MockLlmClient } from './llm/mock-llm.client';

const SETTINGS_KEY = 'ai';
const SECRETS_KEY = 'ai_secrets';
const CACHE_KEY = 'ai:settings';

/**
 * AI configuration. Non-secret settings live in the `ai` setting; the API key is stored
 * AES-256-GCM encrypted in a separate row that is never returned or audited in clear.
 * The ANTHROPIC_API_KEY environment variable is honoured when no key is stored.
 */
@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);
  private client: { key: string; llm: LlmClient } | null = null;
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
    const [settings, key] = await Promise.all([this.get(), this.storedKey()]);
    const envKey = process.env['ANTHROPIC_API_KEY'];
    const source = key ? 'settings' : envKey ? 'environment' : 'none';
    const active = key ?? envKey ?? null;
    return {
      settings,
      key: { source, preview: active ? `••••${active.slice(-4)}` : null },
      ready: settings.provider === 'mock' || source !== 'none',
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
    const value = input.anthropicApiKey
      ? { anthropicApiKey: encryptSecret(input.anthropicApiKey, this.config.encryptionKey) }
      : {};
    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: SECRETS_KEY },
        update: { value },
        create: { key: SECRETS_KEY, value },
      });
      // Only the fact that the key changed is audited, never the key.
      await this.audit.record(
        {
          action: 'ai.key.update',
          entityType: 'setting',
          entityId: SECRETS_KEY,
          summary: input.anthropicApiKey
            ? 'کلید API هوش مصنوعی ثبت شد'
            : 'کلید API هوش مصنوعی حذف شد',
        },
        tx,
      );
    });
    this.client = null;
    return this.view();
  }

  /**
   * The model client for a feature, or an AppException explaining why AI is off.
   * Features stay unavailable (never silently mocked) when the real provider has no key.
   */
  async clientFor(
    feature: AiFeature,
  ): Promise<{ llm: LlmClient; settings: AiSettings; model: string }> {
    const settings = await this.get();
    if (!settings.enabled || !settings.features[feature]) {
      throw new AppException('SERVICE_UNAVAILABLE', 'این قابلیت هوش مصنوعی فعال نیست.');
    }
    if (settings.provider === 'mock') return { llm: this.mock, settings, model: settings.model };
    const key = (await this.storedKey()) ?? process.env['ANTHROPIC_API_KEY'];
    if (!key) throw new AppException('SERVICE_UNAVAILABLE', 'کلید API هوش مصنوعی تنظیم نشده است.');
    if (!this.client || this.client.key !== key) {
      this.client = {
        key,
        llm: new AnthropicLlmClient(key, {
          baseURL: process.env['ANTHROPIC_BASE_URL'] || undefined,
        }),
      };
    }
    return { llm: this.client.llm, settings, model: settings.model };
  }

  private async storedKey(): Promise<string | null> {
    const row = await this.prisma.setting.findUnique({ where: { key: SECRETS_KEY } });
    const encrypted = (row?.value as { anthropicApiKey?: string } | null)?.anthropicApiKey;
    if (!encrypted) return null;
    try {
      return decryptSecret(encrypted, this.config.encryptionKey);
    } catch (error) {
      this.logger.error(
        { err: error },
        'Could not decrypt the AI API key (APP_ENCRYPTION_KEY changed?)',
      );
      return null;
    }
  }
}
