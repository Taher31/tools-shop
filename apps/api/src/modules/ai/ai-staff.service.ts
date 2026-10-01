import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
  type AiDraft,
  type ProductContentDraft,
  type ProductContentRequest,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type TicketPriority,
  type TicketTriage,
} from '@toolshop/shared';
import type { Queue } from 'bullmq';
import { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { sanitizeRichText, stripHtml } from '../../common/utils/html';
import { toRial } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QUEUES } from '../../infrastructure/queue/queue.constants';
import { AuditService } from '../audit/audit.service';
import { ProductQueryService } from '../catalog/products/product-query.service';
import { TaxonomyService } from '../catalog/taxonomy.service';
import { ContentService } from '../content/content.service';
import { AiSettingsService } from './ai-settings.service';
import { StructuredAiService } from './structured.service';

export const AI_JOBS = { QA_SUGGEST: 'qa-suggest', TICKET_TRIAGE: 'ticket-triage' } as const;

const draftSchema = z.object({
  answer: z.string().min(1).max(3000),
  confidence: z.number().min(0).max(1),
  needs_human: z.boolean(),
  notes: z.string().max(500),
});
const replySchema = z.object({
  reply: z.string().min(1).max(5000),
  confidence: z.number().min(0).max(1),
  notes: z.string().max(500),
});
const triageSchema = z.object({
  summary: z.string().min(1).max(300),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'angry']),
  priority: z.enum(TICKET_PRIORITIES),
  category: z.enum(TICKET_CATEGORIES),
});
const contentSchema = z.object({
  short_description: z.string().min(1).max(600),
  description: z.string().min(1).max(20_000),
  seo_title: z.string().min(1).max(200),
  seo_description: z.string().min(1).max(400),
  tags: z.array(z.string().min(1).max(40)).max(12),
});

const objectSchema = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const STAFF_STYLE =
  'Write in fluent, polite Persian (Farsi) with Persian digits. Never invent facts: use only the data provided. If the data does not answer the question, say so honestly.';

/**
 * AI helpers for staff. Everything here produces drafts that a person reviews; the only
 * automatic actions are (a) storing suggestions and triage notes, (b) raising – never
 * lowering – a ticket's priority, and (c) publishing a product answer when an admin
 * explicitly enabled auto-publishing above a confidence threshold.
 */
@Injectable()
export class AiStaffService {
  private readonly logger = new Logger(AiStaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly structured: StructuredAiService,
    private readonly aiSettings: AiSettingsService,
    private readonly products: ProductQueryService,
    private readonly taxonomy: TaxonomyService,
    private readonly content: ContentService,
    private readonly audit: AuditService,
    @InjectQueue(QUEUES.AI_TASKS) private readonly queue: Queue,
  ) {}

  /** Queued from outbox events; skipped silently when the feature is off. */
  async enqueue(job: (typeof AI_JOBS)[keyof typeof AI_JOBS], id: string): Promise<void> {
    const settings = await this.aiSettings.get();
    const feature = job === AI_JOBS.QA_SUGGEST ? 'qa' : 'support';
    if (!settings.enabled || !settings.features[feature]) return;
    await this.queue.add(job, { id }, { jobId: `${job}-${id}` });
  }

  /* --------------------------------------------------------- product Q&A */

  async suggestQuestionAnswer(questionId: string): Promise<AiDraft> {
    const question = await this.prisma.productQuestion.findUnique({
      where: { id: questionId },
      include: { product: { select: { id: true, slug: true } } },
    });
    if (!question) throw AppException.notFound('پرسش یافت نشد.');
    const detail = await this.products.getDetail(question.product.slug).catch(() => null);
    if (!detail) throw AppException.conflict('محصول این پرسش در دسترس نیست.');
    const answered = await this.prisma.productQuestion.findMany({
      where: { productId: question.productId, status: 'answered', id: { not: questionId } },
      select: { body: true, answer: true },
      orderBy: { answeredAt: 'desc' },
      take: 8,
    });

    const result = await this.structured.generate({
      feature: 'qa',
      effort: 'medium',
      system: `You draft answers to customer questions on a product page of an Iranian tools shop. ${STAFF_STYLE} Keep answers short (1-4 sentences). Set confidence to how fully the provided product data supports the answer, and needs_human to true for questions about stock dates, discounts, compatibility not stated in the data, safety-critical use or anything uncertain.`,
      prompt: JSON.stringify({
        product: {
          title: detail.title,
          brand: detail.brand?.name ?? null,
          model: detail.model,
          warranty: detail.warranty,
          country_of_origin: detail.countryOfOrigin,
          short_description: detail.shortDescription,
          description: detail.description ? stripHtml(detail.description).slice(0, 2500) : null,
          specs: detail.specs.map((s) => `${s.name}: ${s.value}`),
          variants: detail.variants.map((v) => ({ title: v.title, availability: v.availability })),
        },
        previous_answers: answered,
        customer_question: question.body,
      }),
      jsonSchema: objectSchema({
        answer: { type: 'string' },
        confidence: { type: 'number' },
        needs_human: { type: 'boolean' },
        notes: {
          type: 'string',
          description: 'Short note for staff (what to verify), in Persian.',
        },
      }),
      schema: draftSchema,
    });

    const settings = await this.aiSettings.get();
    const autoPublish =
      settings.qaAutoPublish &&
      !result.needs_human &&
      result.confidence >= settings.qaAutoPublishMinConfidence &&
      question.status === 'pending';
    await this.prisma.productQuestion.update({
      where: { id: questionId },
      data: {
        aiSuggestedAnswer: result.answer,
        aiConfidence: result.confidence,
        ...(autoPublish
          ? {
              status: 'answered',
              answer: result.answer,
              answeredAt: new Date(),
              answeredById: null,
            }
          : {}),
      },
    });
    if (autoPublish) {
      this.logger.log({ questionId, confidence: result.confidence }, 'AI answer auto-published');
      await this.audit.record({
        action: 'question.ai_publish',
        entityType: 'question',
        entityId: questionId,
        summary: `پاسخ خودکار هوش مصنوعی (اطمینان ${Math.round(result.confidence * 100)}٪)`,
        actorType: 'ai',
        actorId: null,
        after: { answer: result.answer },
      });
    }
    return { text: result.answer, confidence: result.confidence, notes: result.notes || null };
  }

  /* ------------------------------------------------------------- support */

  async draftTicketReply(ticketId: string): Promise<AiDraft> {
    const context = await this.ticketContext(ticketId);
    const [returns, warranty, shipping] = await Promise.all(
      ['returns', 'warranty', 'shipping'].map((slug) =>
        this.content
          .page(slug)
          .then((page) => stripHtml(page.body).slice(0, 1500))
          .catch(() => null),
      ),
    );
    const result = await this.structured.generate({
      feature: 'support',
      effort: 'medium',
      system: `You draft replies for the support team of an Iranian tools shop. ${STAFF_STYLE} Address the customer politely, answer their latest message using the order data and store policies, and say clearly what the next step is. Do not promise refunds, discounts or dates that the data does not support – in that case write that the team will check and follow up. Internal notes are for context only and must not be quoted to the customer.`,
      prompt: JSON.stringify({ ...context, policies: { returns, warranty, shipping } }),
      jsonSchema: objectSchema({
        reply: { type: 'string' },
        confidence: { type: 'number' },
        notes: {
          type: 'string',
          description: 'What the agent should verify before sending, in Persian.',
        },
      }),
      schema: replySchema,
    });
    return { text: result.reply, confidence: result.confidence, notes: result.notes || null };
  }

  async triageTicket(ticketId: string): Promise<TicketTriage> {
    const context = await this.ticketContext(ticketId);
    const result = await this.structured.generate({
      feature: 'support',
      effort: 'low',
      system:
        'You triage support tickets of an Iranian tools shop. Summarize the request in one Persian sentence, detect the customer sentiment, and suggest priority (urgent: money taken without an order, safety issue, very angry customer; high: payment or delivery problems; normal: most questions; low: general info) and category.',
      prompt: JSON.stringify(context),
      jsonSchema: objectSchema({
        summary: { type: 'string' },
        sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative', 'angry'] },
        priority: { type: 'string', enum: [...TICKET_PRIORITIES] },
        category: { type: 'string', enum: [...TICKET_CATEGORIES] },
      }),
      schema: triageSchema,
    });
    const ticket = await this.prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    const raise =
      TICKET_PRIORITIES.indexOf(result.priority) > TICKET_PRIORITIES.indexOf(ticket.priority);
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        aiSummary: result.summary,
        aiSentiment: result.sentiment,
        ...(raise ? { priority: result.priority } : {}),
        ...(ticket.category === 'other' && result.category !== 'other'
          ? { category: result.category }
          : {}),
      },
    });
    if (raise) {
      await this.audit.record({
        action: 'ticket.ai_triage',
        entityType: 'ticket',
        entityId: ticketId,
        summary: `اولویت تیکت ${ticket.ticketNumber} توسط هوش مصنوعی افزایش یافت`,
        actorType: 'ai',
        actorId: null,
        before: { priority: ticket.priority },
        after: { priority: result.priority },
      });
    }
    return {
      summary: result.summary,
      sentiment: result.sentiment,
      suggestedPriority: result.priority as TicketPriority,
      suggestedCategory: result.category,
    };
  }

  /* ------------------------------------------------------------- content */

  async productContent(input: ProductContentRequest): Promise<ProductContentDraft> {
    const taxonomy = await this.taxonomy.get();
    const category = taxonomy.categoriesById.get(input.categoryId);
    if (!category)
      throw AppException.validation([{ path: 'categoryId', message: 'دسته‌بندی یافت نشد.' }]);
    const brand = input.brandId ? taxonomy.brandsById.get(input.brandId) : undefined;
    const specs = input.attributes.flatMap((value) => {
      const attribute = taxonomy.attributesById.get(value.attributeId);
      if (
        !attribute ||
        value.value === '' ||
        (Array.isArray(value.value) && value.value.length === 0)
      )
        return [];
      const raw = Array.isArray(value.value)
        ? value.value.map((v) => taxonomy.optionLabel(attribute, v)).join('، ')
        : typeof value.value === 'boolean'
          ? value.value
            ? 'دارد'
            : 'ندارد'
          : attribute.type === 'select'
            ? taxonomy.optionLabel(attribute, String(value.value))
            : String(value.value);
      return [`${attribute.name}: ${raw}${attribute.unit ? ` ${attribute.unit}` : ''}`];
    });
    const result = await this.structured.generate({
      feature: 'content',
      effort: 'medium',
      system: `You write product copy for an Iranian online tools shop. ${STAFF_STYLE} Base every claim on the given specifications; do not invent certifications, warranty terms or performance numbers. The description is HTML using only <p>, <ul>, <li>, <strong>, <h3>: an intro paragraph, a "ویژگی‌های کلیدی" list, and a short "کاربردها" section. seo_title at most 60 characters, seo_description at most 155 characters, 3-8 short tags.`,
      prompt: JSON.stringify({
        title: input.title,
        model: input.model,
        brand: brand ? `${brand.name}${brand.englishName ? ` (${brand.englishName})` : ''}` : null,
        category_path: taxonomy.ancestors(category.id).map((c) => c.name),
        specifications: specs,
        staff_instructions: input.instructions,
      }),
      jsonSchema: objectSchema({
        short_description: { type: 'string' },
        description: { type: 'string' },
        seo_title: { type: 'string' },
        seo_description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      }),
      schema: contentSchema,
    });
    return {
      shortDescription: result.short_description,
      description: sanitizeRichText(result.description) ?? '',
      seoTitle: result.seo_title.slice(0, 70),
      seoDescription: result.seo_description.slice(0, 170),
      tags: [...new Set(result.tags)].slice(0, 8),
    };
  }

  private async ticketContext(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, where: { authorType: { not: 'system' } } },
        user: { select: { id: true, firstName: true } },
      },
    });
    if (!ticket) throw AppException.notFound('تیکت یافت نشد.');
    const orders = await this.prisma.order.findMany({
      where: { userId: ticket.userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: {
        items: { select: { title: true, quantity: true } },
        payments: { select: { status: true } },
      },
    });
    return {
      ticket: {
        subject: ticket.subject,
        category: ticket.category,
        customer_first_name: ticket.user.firstName,
        conversation: ticket.messages.map((m) => ({
          from: m.authorType,
          internal_note: m.isInternal,
          text: m.body.slice(0, 2000),
        })),
      },
      related_order_id: ticket.orderId,
      recent_orders: orders.map((o) => ({
        id: o.id,
        number: o.orderNumber,
        status: o.status,
        created_at: o.createdAt.toISOString(),
        total_toman: Math.round(toRial(o.total) / 10),
        tracking_code: o.trackingCode,
        shipping_method: o.shippingMethodName,
        payment_statuses: o.payments.map((p) => p.status),
        items: o.items,
      })),
    };
  }
}
