import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { DeadLetterService } from '../../infrastructure/queue/dead-letter.service';
import { QUEUES } from '../../infrastructure/queue/queue.constants';
import { ORDER_JOBS, OrdersService } from './orders.service';

@Processor(QUEUES.ORDERS, { concurrency: 4 })
export class OrdersProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(OrdersProcessor.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly deadLetters: DeadLetterService,
    @InjectQueue(QUEUES.ORDERS) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue
      .upsertJobScheduler(ORDER_JOBS.SWEEP, { every: 5 * 60_000 }, { name: ORDER_JOBS.SWEEP })
      .catch((error: unknown) =>
        this.logger.warn({ err: error }, 'Could not register order sweeper'),
      );
  }

  async process(job: Job<{ orderId?: string }>): Promise<unknown> {
    switch (job.name) {
      case ORDER_JOBS.EXPIRE:
        return job.data.orderId ? this.orders.expire(job.data.orderId) : null;
      case ORDER_JOBS.SWEEP:
        return { expired: await this.orders.sweepExpired() };
      default:
        return null;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, error: Error): Promise<void> {
    this.logger.warn({ jobId: job?.id, name: job?.name, err: error }, 'Order job failed');
    await this.deadLetters.captureIfExhausted(job, error);
  }
}
