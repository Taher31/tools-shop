import { Module } from '@nestjs/common';
import { AdminQuestionsController, AdminReviewsController, ProductFeedbackController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [ProductFeedbackController, AdminReviewsController, AdminQuestionsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
