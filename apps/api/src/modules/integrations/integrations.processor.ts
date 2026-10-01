import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DeadLetterService } from '../../infrastructure/queue/dead-letter.service';
import { QUEUES } from '../../infrastructure/queue/queue.constants';
import { IntegrationsService, MARKETPLACE_JOBS, type SyncJob } from './integrations.service';

@Processor(QUEUES.MARKETPLACE_SYNC, { concurrency: 1 })
export class IntegrationsProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationsProcessor.name);

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly deadLetters: DeadLetterService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name !== MARKETPLACE_JOBS.SYNC) {
      this.logger.warn(`Unknown marketplace job ${job.name}`);
      return null;
    }
    const data = job.data as SyncJob;
    return this.integrations.syncProducts(data.code, data.productIds);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, error: Error): Promise<void> {
    this.logger.warn({ jobId: job?.id, err: error }, 'Marketplace sync job failed');
    await this.deadLetters.captureIfExhausted(job, error);
  }
}
