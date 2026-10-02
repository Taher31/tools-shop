import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DomainEventMap } from '../../infrastructure/outbox/domain-events';
import { AI_JOBS, AiStaffService } from './ai-staff.service';

@Injectable()
export class AiTasksListener {
  constructor(private readonly staff: AiStaffService) {}

  @OnEvent('question.created', { suppressErrors: false })
  async onQuestion(payload: DomainEventMap['question.created']): Promise<void> {
    await this.staff.enqueue(AI_JOBS.QA_SUGGEST, payload.questionId);
  }

  @OnEvent('review.created', { suppressErrors: false })
  async onReview(payload: DomainEventMap['review.created']): Promise<void> {
    await this.staff.enqueue(AI_JOBS.REVIEW_MODERATE, payload.reviewId);
  }

  @OnEvent('ticket.created', { suppressErrors: false })
  async onTicket(payload: DomainEventMap['ticket.created']): Promise<void> {
    await this.staff.enqueue(AI_JOBS.TICKET_TRIAGE, payload.ticketId);
  }
}
