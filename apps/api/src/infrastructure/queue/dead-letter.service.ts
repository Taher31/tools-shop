import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { QUEUES } from './queue.constants';

export interface DeadLetterPayload {
  queue: string;
  jobName: string;
  jobId: string | undefined;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  failedAt: string;
}

/** Collects jobs that exhausted their retries so they can be inspected and replayed. */
@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);

  constructor(@InjectQueue(QUEUES.DEAD_LETTER) private readonly queue: Queue<DeadLetterPayload>) {}

  async captureIfExhausted(job: Job | undefined, error: Error): Promise<void> {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return;
    this.logger.error(
      { queue: job.queueName, jobName: job.name, jobId: job.id, err: error },
      'Job moved to dead-letter queue',
    );
    await this.queue
      .add(
        `${job.queueName}:${job.name}`,
        {
          queue: job.queueName,
          jobName: job.name,
          jobId: job.id,
          data: job.data,
          failedReason: error.message,
          attemptsMade: job.attemptsMade,
          failedAt: new Date().toISOString(),
        },
        { removeOnComplete: false, removeOnFail: false, attempts: 1 },
      )
      .catch((dlqError: unknown) => this.logger.error({ err: dlqError }, 'Failed to write dead-letter job'));
  }
}
