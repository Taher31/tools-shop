import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DeadLetterService } from '../../../infrastructure/queue/dead-letter.service';
import { QUEUES } from '../../../infrastructure/queue/queue.constants';
import { type MessengerJob, MessengerService } from './messenger.service';

@Processor(QUEUES.MESSENGER, { concurrency: 4 })
export class MessengerProcessor extends WorkerHost {
  private readonly logger = new Logger(MessengerProcessor.name);

  constructor(
    private readonly messenger: MessengerService,
    private readonly deadLetters: DeadLetterService,
  ) {
    super();
  }

  async process(job: Job<MessengerJob>): Promise<void> {
    await this.messenger.handle(job.data);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, error: Error): Promise<void> {
    this.logger.warn({ jobId: job?.id, err: error }, 'Messenger job failed');
    await this.deadLetters.captureIfExhausted(job, error);
  }
}
