import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DeadLetterService } from '../../infrastructure/queue/dead-letter.service';
import { QUEUES } from '../../infrastructure/queue/queue.constants';
import { type IndexProductsJob, SEARCH_JOBS, SearchIndexService } from './search-index.service';

@Processor(QUEUES.SEARCH_INDEXING, { concurrency: 2 })
export class SearchIndexProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchIndexProcessor.name);

  constructor(
    private readonly index: SearchIndexService,
    private readonly deadLetters: DeadLetterService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case SEARCH_JOBS.INDEX_PRODUCTS:
        return this.index.indexProducts((job.data as IndexProductsJob).productIds);
      case SEARCH_JOBS.REINDEX_ALL:
        return { indexed: await this.index.reindexAll() };
      default:
        this.logger.warn(`Unknown search job ${job.name}`);
        return null;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, error: Error): Promise<void> {
    this.logger.warn({ jobId: job?.id, name: job?.name, err: error }, 'Search indexing job failed');
    await this.deadLetters.captureIfExhausted(job, error);
  }
}
