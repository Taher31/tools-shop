import { Controller, Get, Post, Put } from '@nestjs/common';
import {
  type AdminQuestionView,
  type AdminReviewView,
  listQuerySchema,
  type Paginated,
  type PaginationQuery,
  paginationQuerySchema,
  type QuestionAnswerInput,
  questionAnswerSchema,
  type QuestionCreateInput,
  questionCreateSchema,
  QUESTION_STATUSES,
  type QuestionView,
  type ReviewCreateInput,
  reviewCreateSchema,
  reviewModerationSchema,
  REVIEW_STATUSES,
  type ReviewView,
} from '@toolshop/shared';
import { z } from 'zod';
import { UuidParam, ZBody, ZQuery } from '../../common/decorators/validated.decorator';
import type { AuthContext } from '../auth/auth-context';
import { AdminController, CurrentUser, Public, RequirePermissions } from '../auth/decorators';
import { ReviewsService } from './reviews.service';

const reviewListSchema = listQuerySchema.extend({ status: z.enum(REVIEW_STATUSES).optional() });
const questionListSchema = listQuerySchema.extend({ status: z.enum(QUESTION_STATUSES).optional() });

@Controller('products/:productId')
export class ProductFeedbackController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('reviews')
  listReviews(
    @UuidParam('productId') productId: string,
    @ZQuery(paginationQuerySchema) query: PaginationQuery,
  ): Promise<Paginated<ReviewView>> {
    return this.reviews.publicReviews(productId, query);
  }

  @Public()
  @Get('questions')
  listQuestions(
    @UuidParam('productId') productId: string,
    @ZQuery(paginationQuerySchema) query: PaginationQuery,
  ): Promise<Paginated<QuestionView>> {
    return this.reviews.publicQuestions(productId, query);
  }

  @Post('reviews')
  createReview(
    @UuidParam('productId') productId: string,
    @ZBody(reviewCreateSchema) input: ReviewCreateInput,
    @CurrentUser() user: AuthContext,
  ) {
    return this.reviews.createReview(productId, user.userId, input);
  }

  @Post('questions')
  createQuestion(
    @UuidParam('productId') productId: string,
    @ZBody(questionCreateSchema) input: QuestionCreateInput,
    @CurrentUser() user: AuthContext,
  ) {
    return this.reviews.createQuestion(productId, user.userId, input);
  }
}

@AdminController('reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @RequirePermissions('review.moderate')
  list(
    @ZQuery(reviewListSchema) query: z.infer<typeof reviewListSchema>,
  ): Promise<Paginated<AdminReviewView>> {
    return this.reviews.adminReviews(query);
  }

  @Put(':id/status')
  @RequirePermissions('review.moderate')
  async moderate(
    @UuidParam() id: string,
    @ZBody(reviewModerationSchema) input: z.infer<typeof reviewModerationSchema>,
  ): Promise<{ ok: true }> {
    await this.reviews.moderateReview(id, input.status);
    return { ok: true };
  }
}

@AdminController('questions')
export class AdminQuestionsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @RequirePermissions('question.answer')
  list(
    @ZQuery(questionListSchema) query: z.infer<typeof questionListSchema>,
  ): Promise<Paginated<AdminQuestionView>> {
    return this.reviews.adminQuestions(query);
  }

  @Put(':id/answer')
  @RequirePermissions('question.answer')
  async answer(
    @UuidParam() id: string,
    @ZBody(questionAnswerSchema) input: QuestionAnswerInput,
    @CurrentUser() user: AuthContext,
  ): Promise<{ ok: true }> {
    await this.reviews.answerQuestion(id, input, user.userId);
    return { ok: true };
  }
}
