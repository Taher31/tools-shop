import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

interface OutboxRow {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
}

const POLL_INTERVAL_MS = 2_000;
const BATCH_SIZE = 50;
const MAX_BACKOFF_MS = 10 * 60_000;
const LISTENER_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Listener timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * Relays committed outbox events to in-process listeners (which enqueue BullMQ jobs).
 * Safe to run on several API instances: rows are claimed with FOR UPDATE SKIP LOCKED.
 * Failed dispatches are retried with exponential backoff; the original request never
 * fails because a downstream system (Redis, Meilisearch, marketplaces) is down.
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private rerun = false;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env['QUEUE_WORKERS_ENABLED'] === 'false') return;
    this.schedule(POLL_INTERVAL_MS);
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  trigger(): void {
    if (this.stopped || process.env['QUEUE_WORKERS_ENABLED'] === 'false') return;
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.schedule(0);
  }

  /** Processes one batch; returns the number of events handled. Exposed for tests. */
  async processBatch(): Promise<number> {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<OutboxRow[]>`
        SELECT "id", "type", "payload", "attempts"
        FROM "OutboxEvent"
        WHERE "publishedAt" IS NULL AND "availableAt" <= now()
        ORDER BY "createdAt"
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED`;

        for (const row of rows) {
          try {
            await withTimeout(this.events.emitAsync(row.type, row.payload), LISTENER_TIMEOUT_MS);
            await tx.outboxEvent.update({
              where: { id: row.id },
              data: { publishedAt: new Date(), lastError: null },
            });
          } catch (error) {
            const attempts = row.attempts + 1;
            const delay = Math.min(MAX_BACKOFF_MS, 2 ** attempts * 1_000);
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(
              { eventId: row.id, type: row.type, attempts, err: error },
              'Outbox dispatch failed',
            );
            await tx.outboxEvent.update({
              where: { id: row.id },
              data: {
                attempts,
                lastError: message.slice(0, 1000),
                availableAt: new Date(Date.now() + delay),
              },
            });
          }
        }
        return rows.length;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  }

  private schedule(delay: number): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), delay);
  }

  private async run(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    let processed = 0;
    try {
      processed = await this.processBatch();
    } catch (error) {
      this.logger.warn({ err: error }, 'Outbox relay iteration failed');
    } finally {
      this.running = false;
    }
    const again = this.rerun || processed === BATCH_SIZE;
    this.rerun = false;
    this.schedule(again ? 0 : POLL_INTERVAL_MS);
  }
}
