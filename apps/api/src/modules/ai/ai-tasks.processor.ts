import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AppException } from '../../common/errors/app-exception';
import { DeadLetterService } from '../../infrastructure/queue/dead-letter.service';
import { QUEUES } from '../../infrastructure/queue/queue.constants';
import { AiUnavailableError } from './ai-errors';
import { AI_JOBS, AiStaffService } from './ai-staff.service';

@Processor(QUEUES.AI_TASKS, { concurrency: 2 })
export class AiTasksProcessor extends WorkerHost {
  private readonly logger = new Logger(AiTasksProcessor.name);

  constructor(
    private readonly staff: AiStaffService,
    private readonly deadLetters: DeadLetterService,
  ) {
    super();
  }

  async process(job: Job<{ id: string }>): Promise<unknown> {
    try {
      if (job.name === AI_JOBS.QA_SUGGEST)
        return await this.staff.suggestQuestionAnswer(job.data.id);
      if (job.name === AI_JOBS.TICKET_TRIAGE) return await this.staff.triageTicket(job.data.id);
      return null;
    } catch (error) {
      // Model/network failures are retried by the queue; configuration states and
      // business errors (feature off, budget reached, record gone) are not.
      if (error instanceof AiUnavailableError && error.reason === 'provider') throw error;
      if (error instanceof AppException) return null;
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, error: Error): Promise<void> {
    this.logger.warn({ jobId: job?.id, name: job?.name, err: error }, 'AI task failed');
    await this.deadLetters.captureIfExhausted(job, error);
  }
}
