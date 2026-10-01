import { Injectable } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import type { Prisma } from '@toolshop/database';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AgentTurn } from './agent.service';

/** Conversations stay short and append-only; a new one starts after this many turns. */
export const MAX_USER_TURNS = 20;

/**
 * Append-only persistence of assistant conversations, shared by the website widget and
 * the messenger bots. Content blocks are stored exactly as the API returned them and
 * replayed in the same order (explicit createdAt offsets keep the order stable).
 */
@Injectable()
export class ConversationStore {
  constructor(private readonly prisma: PrismaService) {}

  async history(conversationId: string): Promise<Anthropic.Beta.BetaMessageParam[]> {
    const rows = await this.prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { role: true, content: true },
    });
    return rows.map((row) => ({
      role: row.role === 'assistant' ? 'assistant' : 'user',
      content: row.content as unknown as Anthropic.Beta.BetaMessageParam['content'],
    }));
  }

  userTurns(conversationId: string): Promise<number> {
    return this.prisma.aiMessage.count({
      where: { conversationId, role: 'user', text: { not: '' } },
    });
  }

  /** Stores the customer's message and returns it in API form with the turn's start time. */
  async appendUser(
    conversationId: string,
    text: string,
  ): Promise<{ message: Anthropic.Beta.BetaMessageParam; startedAt: number }> {
    const message: Anthropic.Beta.BetaMessageParam = {
      role: 'user',
      content: [{ type: 'text', text }],
    };
    const startedAt = Date.now();
    await this.prisma.aiMessage.create({
      data: {
        conversationId,
        role: 'user',
        text,
        content: message.content as Prisma.InputJsonValue,
        createdAt: new Date(startedAt),
      },
    });
    return { message, startedAt };
  }

  /** Stores what the agent produced; returns the id of the visible (final) message. */
  async appendTurn(
    conversationId: string,
    turn: AgentTurn,
    startedAt: number,
    update: Prisma.AiConversationUpdateInput = {},
  ): Promise<string> {
    const lastAssistant = turn.appended.map((m) => m.role).lastIndexOf('assistant');
    let lastId = '';
    for (const [index, message] of turn.appended.entries()) {
      const isFinal = index === lastAssistant;
      const row = await this.prisma.aiMessage.create({
        data: {
          conversationId,
          role: message.role,
          text: isFinal ? turn.text.trim() : '',
          content: message.content as Prisma.InputJsonValue,
          productIds: isFinal ? turn.products.map((p) => p.id) : [],
          tools:
            isFinal && turn.tools.length > 0 ? (turn.tools as Prisma.InputJsonValue) : undefined,
          createdAt: new Date(startedAt + index + 1),
        },
      });
      if (isFinal) lastId = row.id;
    }
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        messageCount: { increment: 1 + turn.appended.length },
        lastMessageAt: new Date(),
        ...update,
      },
    });
    return lastId;
  }
}
