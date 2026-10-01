import { Injectable } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import type {
  AiConversationDetail,
  AiConversationSummary,
  ListQuery,
  Paginated,
} from '@toolshop/shared';
import { AppException } from '../../common/errors/app-exception';
import { paginate, paginationArgs } from '../../common/utils/pagination';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.AiConversationInclude;
type Row = Prisma.AiConversationGetPayload<{ include: typeof INCLUDE }>;

function toSummary(row: Row): AiConversationSummary {
  return {
    id: row.id,
    channel: row.channel,
    customer: row.user
      ? { id: row.user.id, fullName: `${row.user.firstName} ${row.user.lastName}`.trim() }
      : null,
    title: row.title,
    messageCount: row.messageCount,
    lastMessageAt: row.lastMessageAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Conversation review for the AI Center (quality control and abuse handling). */
@Injectable()
export class AiAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async conversations(
    query: ListQuery & { channel?: string },
  ): Promise<Paginated<AiConversationSummary>> {
    const where: Prisma.AiConversationWhereInput = {
      ...(query.channel ? { channel: query.channel as Row['channel'] } : {}),
      ...(query.q
        ? { messages: { some: { text: { contains: query.q, mode: 'insensitive' } } } }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.aiConversation.findMany({
        where,
        include: INCLUDE,
        orderBy: { lastMessageAt: 'desc' },
        ...paginationArgs(query),
      }),
      this.prisma.aiConversation.count({ where }),
    ]);
    return paginate(rows.map(toSummary), total, query);
  }

  async conversation(id: string): Promise<AiConversationDetail> {
    const row = await this.prisma.aiConversation.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw AppException.notFound('گفت‌وگو یافت نشد.');
    const messages = await this.prisma.aiMessage.findMany({
      where: { conversationId: id, text: { not: '' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return {
      ...toSummary(row),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role === 'user' ? 'user' : 'assistant',
        text: m.text,
        products: [],
        tools: (m.tools as { name: string; input: unknown }[] | null) ?? [],
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }
}
