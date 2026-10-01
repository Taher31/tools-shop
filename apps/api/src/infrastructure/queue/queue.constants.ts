import type { DefaultJobOptions } from 'bullmq';

/** Queue names. Phase 2/3 add marketplace sync, e-mail/SMS, invoice and AI queues. */
export const QUEUES = {
  SEARCH_INDEXING: 'search-indexing',
  ORDERS: 'orders',
  DEAD_LETTER: 'dead-letter',
} as const;

export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: { count: 1_000, age: 24 * 3600 },
  removeOnFail: { age: 14 * 24 * 3600 },
};

/**
 * Workers can be disabled per process (QUEUE_WORKERS_ENABLED=false) so the API can be
 * scaled separately from background processing.
 */
export function workerProviders<T>(...providers: T[]): T[] {
  return process.env['QUEUE_WORKERS_ENABLED'] === 'false' ? [] : providers;
}
