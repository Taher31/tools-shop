import { Injectable } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import type {
  AdminQuestionView,
  AdminReviewView,
  AdminQuestionListQuery,
  AdminReviewListQuery,
  Paginated,
  PaginationQuery,
  QuestionAnswerInput,
  QuestionCreateInput,
  QuestionStatus,
  QuestionView,
  ReviewCreateInput,
  ReviewStatus,
  ReviewView,
} from '@toolshop/shared';
import { dayRange } from '../../common/utils/filters';
import { AppException } from '../../common/errors/app-exception';
import { paginate, paginationArgs } from '../../common/utils/pagination';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const authorName = (user: { firstName: string; lastName: string }) =>
  `${user.firstName} ${user.lastName.charAt(0)}.`.trim();

const REVIEW_INCLUDE = {
  user: { select: { firstName: true, lastName: true } },
  product: { select: { id: true, title: true, slug: true } },
} satisfies Prisma.ReviewInclude;

const QUESTION_INCLUDE = {
  user: { select: { firstName: true, lastName: true } },
  answeredBy: { select: { firstName: true, lastName: true } },
  product: { select: { id: true, title: true, slug: true } },
} satisfies Prisma.ProductQuestionInclude;

type ReviewRecord = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;
type QuestionRecord = Prisma.ProductQuestionGetPayload<{ include: typeof QUESTION_INCLUDE }>;

function toReview(review: ReviewRecord): ReviewView {
  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    authorName: authorName(review.user),
    isVerifiedBuyer: review.isVerifiedBuyer,
    createdAt: review.createdAt.toISOString(),
  };
}

function toQuestion(question: QuestionRecord): QuestionView {
  return {
    id: question.id,
    body: question.body,
    authorName: authorName(question.user),
    answer: question.answer,
    answeredBy: question.answer ? (question.answeredBy ? 'کارشناس فروشگاه' : 'فروشگاه') : null,
    answeredAt: question.answeredAt?.toISOString() ?? null,
    createdAt: question.createdAt.toISOString(),
  };
}

/**
 * Product reviews and questions. Both are moderated: nothing a customer writes is
 * published before staff approval. AI-suggested answers (Phase 3) are stored on the
 * question and still require approval below a configurable confidence.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async publicReviews(productId: string, query: PaginationQuery): Promise<Paginated<ReviewView>> {
    const where: Prisma.ReviewWhereInput = { productId, status: 'approved' };
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(query),
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginate(reviews.map(toReview), total, query);
  }

  async publicQuestions(
    productId: string,
    query: PaginationQuery,
  ): Promise<Paginated<QuestionView>> {
    const where: Prisma.ProductQuestionWhereInput = { productId, status: 'answered' };
    const [questions, total] = await Promise.all([
      this.prisma.productQuestion.findMany({
        where,
        include: QUESTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(query),
      }),
      this.prisma.productQuestion.count({ where }),
    ]);
    return paginate(questions.map(toQuestion), total, query);
  }

  async createReview(
    productId: string,
    userId: string,
    input: ReviewCreateInput,
  ): Promise<{ status: ReviewStatus }> {
    await this.assertProduct(productId);
    if (
      await this.prisma.review.findUnique({ where: { productId_userId: { productId, userId } } })
    ) {
      throw AppException.conflict('شما قبلاً برای این محصول نظر ثبت کرده‌اید.');
    }
    const purchased = await this.prisma.orderItem.count({
      where: {
        productId,
        order: { userId, status: { in: ['paid', 'processing', 'packed', 'shipped', 'delivered'] } },
      },
    });
    await this.prisma.review.create({
      data: { ...input, productId, userId, isVerifiedBuyer: purchased > 0, status: 'pending' },
    });
    return { status: 'pending' };
  }

  async createQuestion(
    productId: string,
    userId: string,
    input: QuestionCreateInput,
  ): Promise<{ status: QuestionStatus }> {
    await this.assertProduct(productId);
    const recent = await this.prisma.productQuestion.count({
      where: { userId, createdAt: { gt: new Date(Date.now() - 3_600_000) } },
    });
    if (recent >= 10)
      throw new AppException('RATE_LIMITED', 'تعداد پرسش‌های شما در یک ساعت گذشته زیاد است.');
    await this.prisma.$transaction(async (tx) => {
      const question = await tx.productQuestion.create({
        data: { productId, userId, body: input.body, status: 'pending' },
      });
      // Lets the AI center prepare a suggested answer for staff review.
      await this.outbox.record(tx, [
        {
          type: 'question.created',
          aggregateType: 'question',
          aggregateId: question.id,
          payload: { questionId: question.id },
        },
      ]);
    });
    this.outbox.flush();
    return { status: 'pending' };
  }

  async adminReviews(query: AdminReviewListQuery): Promise<Paginated<AdminReviewView>> {
    const q = query.q?.trim();
    const where: Prisma.ReviewWhereInput = {
      status: query.status,
      rating: query.rating,
      productId: query.productId,
      createdAt: dayRange(query),
      ...(q
        ? {
            OR: [
              { body: { contains: q, mode: 'insensitive' } },
              { title: { contains: q, mode: 'insensitive' } },
              { product: { title: { contains: q, mode: 'insensitive' } } },
              { user: { lastName: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(query),
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginate(
      reviews.map((review) => ({
        ...toReview(review),
        status: review.status,
        product: review.product,
      })),
      total,
      query,
    );
  }

  async moderateReview(id: string, status: ReviewStatus): Promise<void> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw AppException.notFound('نظر یافت نشد.');
    await this.prisma.$transaction(async (tx) => {
      await tx.review.update({ where: { id }, data: { status } });
      await this.refreshRating(tx, review.productId);
      await this.audit.record(
        {
          action: 'review.moderate',
          entityType: 'review',
          entityId: id,
          before: { status: review.status },
          after: { status },
        },
        tx,
      );
      await this.outbox.record(tx, [
        {
          type: 'product.changed',
          aggregateType: 'product',
          aggregateId: review.productId,
          payload: { productIds: [review.productId] },
        },
      ]);
    });
    this.outbox.flush();
  }

  async adminQuestions(query: AdminQuestionListQuery): Promise<Paginated<AdminQuestionView>> {
    const q = query.q?.trim();
    const where: Prisma.ProductQuestionWhereInput = {
      status: query.status,
      productId: query.productId,
      createdAt: dayRange(query),
      ...(query.answeredBy === 'none'
        ? { answer: null }
        : query.answeredBy === 'ai'
          ? { answer: { not: null }, answeredById: null }
          : query.answeredBy === 'staff'
            ? { answeredById: { not: null } }
            : {}),
      ...(q
        ? {
            OR: [
              { body: { contains: q, mode: 'insensitive' } },
              { answer: { contains: q, mode: 'insensitive' } },
              { product: { title: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [questions, total] = await Promise.all([
      this.prisma.productQuestion.findMany({
        where,
        include: QUESTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(query),
      }),
      this.prisma.productQuestion.count({ where }),
    ]);
    return paginate(
      questions.map((question) => ({
        ...toQuestion(question),
        status: question.status,
        product: question.product,
        aiSuggestion:
          question.status === 'pending' && question.aiSuggestedAnswer
            ? { answer: question.aiSuggestedAnswer, confidence: question.aiConfidence ?? 0 }
            : null,
      })),
      total,
      query,
    );
  }

  async answerQuestion(id: string, input: QuestionAnswerInput, actorId: string): Promise<void> {
    const question = await this.prisma.productQuestion.findUnique({ where: { id } });
    if (!question) throw AppException.notFound('پرسش یافت نشد.');
    await this.prisma.productQuestion.update({
      where: { id },
      data:
        input.status === 'rejected'
          ? { status: 'rejected' }
          : {
              status: 'answered',
              answer: input.answer,
              answeredById: actorId,
              answeredAt: new Date(),
            },
    });
    await this.audit.record({
      action: 'question.answer',
      entityType: 'question',
      entityId: id,
      before: { status: question.status, answer: question.answer },
      after: {
        status: input.status,
        answer: input.status === 'rejected' ? question.answer : input.answer,
      },
    });
  }

  private async refreshRating(tx: Tx, productId: string): Promise<void> {
    const aggregate = await tx.review.aggregate({
      where: { productId, status: 'approved' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: { ratingAverage: aggregate._avg.rating ?? null, ratingCount: aggregate._count._all },
    });
  }

  private async assertProduct(productId: string): Promise<void> {
    const exists = await this.prisma.product.count({
      where: { id: productId, status: 'active', deletedAt: null },
    });
    if (!exists) throw AppException.notFound('محصول یافت نشد.');
  }
}
