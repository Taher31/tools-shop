import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { MessengerChannel } from '@toolshop/shared';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { QUEUES } from '../../../infrastructure/queue/queue.constants';
import { REDIS } from '../../../infrastructure/redis/redis.constants';
import { AgentService } from '../agent.service';
import { AiUnavailableError } from '../ai-errors';
import { AiSettingsService } from '../ai-settings.service';
import { AiUsageService } from '../ai-usage.service';
import { ConversationStore, MAX_USER_TURNS } from '../conversation-store.service';
import { BotApiError, type BotApiClient } from './bot-api.client';
import { MessengerConfigService } from './messenger-config.service';

/** The subset of a Bot API update the bot uses; everything else is ignored. */
const updateSchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      message_id: z.number().int(),
      text: z.string().optional(),
      chat: z.object({ id: z.union([z.number(), z.string()]), type: z.string() }),
      from: z.object({ is_bot: z.boolean().optional() }).optional(),
    })
    .optional(),
});

export interface MessengerJob {
  channel: MessengerChannel;
  chatId: string;
  messageId: number;
  /** Null for non-text messages (stickers, photos, voice). */
  text: string | null;
}

const TEXT = {
  help: 'برای شروع، نیازتان را بنویسید؛ مثلاً «دریل شارژی برای کار خانگی» یا «وضعیت سفارش ۱۰۰۰۱۲». برای شروع گفت‌وگوی تازه /new را بفرستید.',
  reset: 'گفت‌وگوی تازه شروع شد. چطور می‌توانم کمکتان کنم؟',
  unsupported: 'فعلاً فقط پیام متنی را می‌توانم بخوانم. لطفاً سؤالتان را بنویسید.',
  unavailable:
    'پاسخ‌گویی خودکار در حال حاضر در دسترس نیست. لطفاً کمی بعد دوباره پیام دهید یا از بخش پشتیبانی سایت درخواست ثبت کنید.',
  limited: 'تعداد پیام‌های شما در این ساعت زیاد شده است؛ لطفاً کمی بعد دوباره امتحان کنید.',
};

/**
 * Store assistant on Telegram-compatible messengers. Webhook deliveries are accepted
 * quickly and processed from a queue (one job per update id, so platform retries are
 * de-duplicated). Bot users are anonymous: order lookups ask them to sign in on the site.
 */
@Injectable()
export class MessengerService {
  private readonly logger = new Logger(MessengerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configs: MessengerConfigService,
    private readonly agent: AgentService,
    private readonly store: ConversationStore,
    private readonly aiSettings: AiSettingsService,
    private readonly usage: AiUsageService,
    @Inject(REDIS) private readonly redis: Redis,
    @InjectQueue(QUEUES.MESSENGER) private readonly queue: Queue<MessengerJob>,
  ) {}

  /** Parses a webhook delivery and queues it. Returns false for ignored updates. */
  async accept(channel: MessengerChannel, body: unknown): Promise<boolean> {
    const parsed = updateSchema.safeParse(body);
    const message = parsed.success ? parsed.data.message : undefined;
    // Private chats only: the bot does not answer in groups or channels.
    if (!parsed.success || !message || message.chat.type !== 'private' || message.from?.is_bot) {
      return false;
    }
    const text = message.text?.trim().slice(0, 1000) || null;
    await this.queue.add(
      'message',
      { channel, chatId: String(message.chat.id), messageId: message.message_id, text },
      { jobId: `${channel}-${parsed.data.update_id}`, attempts: 2 },
    );
    return true;
  }

  async handle(job: MessengerJob): Promise<void> {
    const active = await this.configs.active(job.channel);
    if (!active?.enabled) return;
    const reply = (text: string) => this.send(job, active.client, text);
    const settings = await this.aiSettings.get();

    if (!job.text) return reply(TEXT.unsupported);
    if (job.text.startsWith('/start')) {
      return reply(`${settings.assistantGreeting}\n\n${TEXT.help}`);
    }
    if (job.text === '/new' || job.text === '/reset') {
      await this.detach(job);
      return reply(TEXT.reset);
    }

    try {
      // Same checks the agent makes, done before anything is stored.
      await this.aiSettings.clientFor('messenger');
      await this.usage.assertWithinBudget(settings);
    } catch (error) {
      if (error instanceof AiUnavailableError) return reply(TEXT.unavailable);
      throw error;
    }
    const key = `ai:rl:${job.channel}:${job.chatId}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 3600);
    if (count > settings.assistantHourlyLimit) {
      // Tell them once; stay quiet for further messages in the same hour.
      if (count === settings.assistantHourlyLimit + 1) await reply(TEXT.limited);
      return;
    }

    let conversation = await this.prisma.aiConversation.findUnique({
      where: { channel_externalChatId: { channel: job.channel, externalChatId: job.chatId } },
    });
    if (conversation && (await this.store.userTurns(conversation.id)) >= MAX_USER_TURNS) {
      await this.detach(job);
      conversation = null;
    }
    conversation ??= await this.prisma.aiConversation.create({
      data: {
        channel: job.channel,
        externalChatId: job.chatId,
        visitorKey: `${job.channel}:${job.chatId}`,
        title: job.text.slice(0, 80),
      },
    });

    await active.client.typing(job.chatId);
    const history = await this.store.history(conversation.id);
    const { message, startedAt } = await this.store.appendUser(conversation.id, job.text);
    const turn = await this.agent.run(
      'messenger',
      [...history, message],
      { userId: null, channel: job.channel },
      conversation.id,
    );
    await this.store.appendTurn(conversation.id, turn, startedAt);
    await reply(turn.text.trim() || TEXT.unavailable);
  }

  /** Keeps the old conversation for the AI Center but stops continuing it. */
  private async detach(job: MessengerJob): Promise<void> {
    await this.prisma.aiConversation.updateMany({
      where: { channel: job.channel, externalChatId: job.chatId },
      data: { externalChatId: null },
    });
  }

  private async send(job: MessengerJob, client: BotApiClient, text: string): Promise<void> {
    try {
      await client.sendText(job.chatId, text, job.messageId);
      await this.configs.recordActivity(job.channel);
    } catch (error) {
      // Not rethrown: retrying would run the model again for the same message.
      const message = error instanceof BotApiError ? error.message : 'unknown error';
      this.logger.warn({ channel: job.channel, err: message }, 'Messenger reply failed');
      await this.configs.recordError(job.channel, `sendMessage: ${message}`);
    }
  }
}
