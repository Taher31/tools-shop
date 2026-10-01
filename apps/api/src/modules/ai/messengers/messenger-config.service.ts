import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import {
  MESSENGER_CHANNELS,
  MESSENGER_LABELS,
  type MessengerChannel,
  type MessengerChannelView,
  type MessengerUpdateInput,
} from '@toolshop/shared';
import type { Redis } from 'ioredis';
import { AppException } from '../../../common/errors/app-exception';
import { decryptSecret, encryptSecret, randomToken, safeEqual } from '../../../common/utils/crypto';
import { AppConfig } from '../../../config/app-config';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { REDIS } from '../../../infrastructure/redis/redis.constants';
import { AuditService } from '../../audit/audit.service';
import { BotApiClient, BotApiError, MESSENGER_PLATFORMS } from './bot-api.client';

/** Stored per channel in the `messenger:<channel>` setting; secrets are AES-GCM encrypted. */
interface StoredChannel {
  enabled: boolean;
  token?: string;
  tokenPreview?: string;
  /** Random path secret that authenticates webhook deliveries. */
  secret?: string;
  botUsername?: string | null;
  webhookAt?: string | null;
}

export interface ActiveChannel {
  channel: MessengerChannel;
  enabled: boolean;
  client: BotApiClient;
}

const settingKey = (channel: MessengerChannel) => `messenger:${channel}`;
const statusKey = (channel: MessengerChannel) => `ai:messenger:status:${channel}`;

/**
 * Messenger bot configuration. Tokens and webhook secrets never leave the server: views
 * show a masked preview only, and operational status (last activity/error) lives in
 * Redis so busy bots never write over an administrator's edits.
 */
@Injectable()
export class MessengerConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async views(): Promise<MessengerChannelView[]> {
    return Promise.all(MESSENGER_CHANNELS.map((channel) => this.view(channel)));
  }

  async view(channel: MessengerChannel): Promise<MessengerChannelView> {
    const stored = await this.stored(channel);
    const platform = MESSENGER_PLATFORMS[channel];
    const status = await this.redis.hgetall(statusKey(channel));
    return {
      channel,
      label: MESSENGER_LABELS[channel],
      available: platform.available,
      note: platform.note,
      enabled: platform.available && stored.enabled,
      token: { configured: Boolean(stored.token), preview: stored.tokenPreview ?? null },
      botUsername: stored.botUsername ?? null,
      webhookUrl: stored.webhookAt ? this.webhookUrl(channel, '••••••') : null,
      webhookAt: stored.webhookAt ?? null,
      lastActivityAt: status['activityAt'] ?? null,
      lastError: status['error'] ?? null,
    };
  }

  /**
   * Saves the channel. A new token is verified with getMe first and rotates the webhook
   * secret, so deliveries addressed to an old bot or old URL are rejected.
   */
  async update(
    channel: MessengerChannel,
    input: MessengerUpdateInput,
  ): Promise<MessengerChannelView> {
    const platform = MESSENGER_PLATFORMS[channel];
    if (!platform.available && input.enabled) {
      throw AppException.conflict('اتصال به این پیام‌رسان هنوز پشتیبانی نمی‌شود.');
    }
    const before = await this.stored(channel);
    const next: StoredChannel = { ...before, enabled: input.enabled };
    if (input.botToken === '') {
      delete next.token;
      delete next.tokenPreview;
      delete next.secret;
      next.botUsername = null;
      next.webhookAt = null;
    } else if (input.botToken) {
      const me = await this.verify(channel, input.botToken);
      next.token = encryptSecret(input.botToken, this.config.encryptionKey);
      next.tokenPreview = `••••${input.botToken.slice(-4)}`;
      next.secret = encryptSecret(randomToken(24), this.config.encryptionKey);
      next.botUsername = me.username ?? me.first_name ?? null;
      next.webhookAt = null;
    }
    if (next.enabled && !next.token) {
      throw AppException.validation([
        { path: 'botToken', message: 'برای فعال‌سازی، توکن ربات را وارد کنید.' },
      ]);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: settingKey(channel) },
        update: { value: next as unknown as Prisma.InputJsonValue },
        create: { key: settingKey(channel), value: next as unknown as Prisma.InputJsonValue },
      });
      await this.audit.record(
        {
          action: 'ai.messenger.update',
          entityType: 'setting',
          entityId: settingKey(channel),
          summary: `تنظیمات ربات ${MESSENGER_LABELS[channel]}${input.botToken ? ' (توکن جدید)' : ''}`,
          before: { enabled: before.enabled, botUsername: before.botUsername ?? null },
          after: { enabled: next.enabled, botUsername: next.botUsername ?? null },
        },
        tx,
      );
    });
    await this.redis.hdel(statusKey(channel), 'error');
    return this.view(channel);
  }

  /** Registers the webhook with the platform (needs a publicly reachable HTTPS URL). */
  async registerWebhook(channel: MessengerChannel): Promise<MessengerChannelView> {
    const stored = await this.stored(channel);
    const active = await this.active(channel);
    if (!active || !stored.secret) {
      throw AppException.conflict('ابتدا توکن ربات را ثبت کنید.');
    }
    const secret = decryptSecret(stored.secret, this.config.encryptionKey);
    try {
      await active.client.setWebhook(
        this.webhookUrl(channel, secret),
        MESSENGER_PLATFORMS[channel].secretHeader ? secret : null,
      );
    } catch (error) {
      const message = error instanceof BotApiError ? error.message : 'unknown error';
      await this.recordError(channel, `setWebhook: ${message}`);
      throw new AppException(
        'SERVICE_UNAVAILABLE',
        `ثبت وب‌هوک ناموفق بود: ${message}. نشانی سایت (APP_PUBLIC_URL) باید HTTPS و از اینترنت در دسترس باشد.`,
      );
    }
    await this.save(channel, { ...stored, webhookAt: new Date().toISOString() });
    await this.redis.hdel(statusKey(channel), 'error');
    return this.view(channel);
  }

  /** Constant-time check of a webhook delivery's path secret (and header, when sent). */
  async authenticate(
    channel: MessengerChannel,
    pathSecret: string,
    headerSecret: string | undefined,
  ): Promise<boolean> {
    const stored = await this.stored(channel);
    if (!MESSENGER_PLATFORMS[channel].available || !stored.enabled || !stored.secret) return false;
    let secret: string;
    try {
      secret = decryptSecret(stored.secret, this.config.encryptionKey);
    } catch {
      return false;
    }
    if (!safeEqual(pathSecret, secret)) return false;
    return headerSecret === undefined || safeEqual(headerSecret, secret);
  }

  async active(channel: MessengerChannel): Promise<ActiveChannel | null> {
    const stored = await this.stored(channel);
    const base = MESSENGER_PLATFORMS[channel].apiBase();
    if (!stored.token || !base) return null;
    try {
      const token = decryptSecret(stored.token, this.config.encryptionKey);
      return { channel, enabled: stored.enabled, client: new BotApiClient(base, token) };
    } catch {
      return null;
    }
  }

  async recordActivity(channel: MessengerChannel): Promise<void> {
    await this.redis.hset(statusKey(channel), 'activityAt', new Date().toISOString());
  }

  async recordError(channel: MessengerChannel, message: string): Promise<void> {
    await this.redis.hset(
      statusKey(channel),
      'error',
      `${new Date().toISOString()} · ${message.slice(0, 300)}`,
    );
  }

  private async verify(channel: MessengerChannel, token: string) {
    const base = MESSENGER_PLATFORMS[channel].apiBase();
    if (!base) throw AppException.conflict('اتصال به این پیام‌رسان هنوز پشتیبانی نمی‌شود.');
    try {
      return await new BotApiClient(base, token).getMe();
    } catch (error) {
      const reason =
        // The Bot API answers 401 (or 404 for a malformed token); anything else is a
        // connectivity problem (blocked host, proxy, outage), not a bad token.
        error instanceof BotApiError && (error.status === 401 || error.status === 404)
          ? 'توکن معتبر نیست.'
          : `اتصال به سرور ${MESSENGER_LABELS[channel]} برقرار نشد.`;
      throw AppException.validation([{ path: 'botToken', message: reason }]);
    }
  }

  private webhookUrl(channel: MessengerChannel, secret: string): string {
    return `${this.config.publicUrl}/api/v1/webhooks/messenger/${channel}/${secret}`;
  }

  private async stored(channel: MessengerChannel): Promise<StoredChannel> {
    const row = await this.prisma.setting.findUnique({ where: { key: settingKey(channel) } });
    const value = row?.value as Partial<StoredChannel> | null | undefined;
    return { ...value, enabled: value?.enabled === true };
  }

  private async save(channel: MessengerChannel, value: StoredChannel): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key: settingKey(channel) },
      update: { value: value as unknown as Prisma.InputJsonValue },
      create: { key: settingKey(channel), value: value as unknown as Prisma.InputJsonValue },
    });
  }
}
