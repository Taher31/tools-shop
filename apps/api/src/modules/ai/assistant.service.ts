import { Inject, Injectable } from '@nestjs/common';
import type { AiConversation } from '@toolshop/database';
import type {
  AssistantConversationView,
  AssistantProduct,
  AssistantPublicConfig,
  AssistantStreamEvent,
} from '@toolshop/shared';
import type { Redis } from 'ioredis';
import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { REDIS } from '../../infrastructure/redis/redis.constants';
import { ProductQueryService } from '../catalog/products/product-query.service';
import { AgentService } from './agent.service';
import { AiSettingsService } from './ai-settings.service';
import { ConversationStore, MAX_USER_TURNS } from './conversation-store.service';
import type { ToolContext } from './tools/assistant-tools.service';

export interface AssistantIdentity {
  userId: string | null;
  visitorKey: string;
  ip: string;
}

/** Conversation persistence, ownership and limits around the agent (website widget). */
@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agent: AgentService,
    private readonly store: ConversationStore,
    private readonly aiSettings: AiSettingsService,
    private readonly products: ProductQueryService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async publicConfig(): Promise<AssistantPublicConfig> {
    const view = await this.aiSettings.view();
    const { settings } = view;
    return {
      enabled: settings.enabled && settings.features.assistant && view.ready,
      name: settings.assistantName,
      greeting: settings.assistantGreeting,
      suggestions: [
        'دریل شارژی برای کار خانگی پیشنهاد بده',
        'فرق بتن‌کن و دریل چکشی چیست؟',
        'سفارشم کجاست؟',
        'شرایط مرجوعی کالا',
      ],
    };
  }

  /** Checks limits before the response starts streaming (so errors are plain HTTP errors). */
  async preflight(
    identity: AssistantIdentity,
    conversationId: string | null,
  ): Promise<AiConversation | null> {
    const settings = await this.aiSettings.get();
    if (!settings.enabled || !settings.features.assistant) {
      throw new AppException('SERVICE_UNAVAILABLE', 'دستیار هوشمند در حال حاضر فعال نیست.');
    }
    await this.rateLimit(
      `ai:rl:${identity.userId ?? identity.visitorKey}`,
      settings.assistantHourlyLimit,
    );
    // A shared IP (office, mobile carrier NAT) gets a higher ceiling than one visitor.
    await this.rateLimit(`ai:rl:ip:${identity.ip}`, settings.assistantHourlyLimit * 5);
    if (!conversationId) return null;
    const conversation = await this.owned(conversationId, identity);
    const turns = await this.store.userTurns(conversationId);
    if (turns >= MAX_USER_TURNS) {
      throw AppException.conflict('این گفت‌وگو طولانی شده است؛ لطفاً گفت‌وگوی جدیدی شروع کنید.');
    }
    return conversation;
  }

  async handle(
    identity: AssistantIdentity,
    text: string,
    existing: AiConversation | null,
    emit: (event: AssistantStreamEvent) => void,
  ): Promise<void> {
    const conversation =
      existing ??
      (await this.prisma.aiConversation.create({
        data: {
          channel: 'web',
          userId: identity.userId,
          visitorKey: identity.visitorKey,
          title: text.slice(0, 80),
        },
      }));
    emit({ type: 'conversation', conversationId: conversation.id });

    const history = await this.store.history(conversation.id);
    const { message: userMessage, startedAt } = await this.store.appendUser(conversation.id, text);

    const context: ToolContext = { userId: identity.userId, channel: 'web' };
    const turn = await this.agent.run(
      'assistant',
      [...history, userMessage],
      context,
      conversation.id,
      {
        onText: (delta) => emit({ type: 'text', delta }),
        onTool: (name, label) => emit({ type: 'tool', name, label }),
        onProducts: (products) => emit({ type: 'products', products }),
      },
    );
    const lastId = await this.store.appendTurn(
      conversation.id,
      turn,
      startedAt,
      identity.userId && !conversation.userId ? { user: { connect: { id: identity.userId } } } : {},
    );
    emit({ type: 'done', messageId: lastId });
  }

  async conversation(
    id: string,
    identity: Omit<AssistantIdentity, 'ip'>,
  ): Promise<AssistantConversationView> {
    await this.owned(id, identity);
    const rows = await this.prisma.aiMessage.findMany({
      where: { conversationId: id, text: { not: '' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const productIds = [...new Set(rows.flatMap((r) => r.productIds))];
    const cards = new Map((await this.products.cardsByIds(productIds)).map((c) => [c.id, c]));
    return {
      id,
      messages: rows.map((row) => ({
        id: row.id,
        role: row.role === 'user' ? 'user' : 'assistant',
        text: row.text,
        products: row.productIds.flatMap((pid): AssistantProduct[] => {
          const card = cards.get(pid);
          return card
            ? [
                {
                  id: card.id,
                  slug: card.slug,
                  title: card.title,
                  imageUrl: card.imageUrl,
                  price: card.price,
                  compareAtPrice: card.compareAtPrice,
                  inStock: card.inStock,
                  brand: card.brand,
                  defaultVariantId: card.defaultVariantId,
                },
              ]
            : [];
        }),
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private async owned(
    id: string,
    identity: Omit<AssistantIdentity, 'ip'>,
  ): Promise<AiConversation> {
    const conversation = await this.prisma.aiConversation.findUnique({ where: { id } });
    const mine =
      conversation &&
      conversation.channel === 'web' &&
      ((identity.userId !== null && conversation.userId === identity.userId) ||
        (conversation.visitorKey === identity.visitorKey &&
          (!conversation.userId || conversation.userId === identity.userId)));
    if (!conversation || !mine) throw AppException.notFound('گفت‌وگو یافت نشد.');
    return conversation;
  }

  private async rateLimit(key: string, limit: number): Promise<void> {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 3600);
    if (count > limit) {
      throw new AppException(
        'RATE_LIMITED',
        'تعداد پیام‌های شما زیاد شده است؛ کمی بعد دوباره امتحان کنید.',
      );
    }
  }
}
