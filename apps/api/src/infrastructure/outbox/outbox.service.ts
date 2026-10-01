import { Injectable } from '@nestjs/common';
import type { Prisma } from '@toolshop/database';
import type { Tx } from '../prisma/prisma.service';
import type { DomainEvent, DomainEventType } from './domain-events';
import { OutboxRelay } from './outbox.relay';

@Injectable()
export class OutboxService {
  constructor(private readonly relay: OutboxRelay) {}

  /** Records events inside the caller's transaction; they are relayed after commit. */
  async record(tx: Tx, events: DomainEvent<DomainEventType>[]): Promise<void> {
    if (events.length === 0) return;
    await tx.outboxEvent.createMany({
      data: events.map((event) => ({
        type: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload as unknown as Prisma.InputJsonValue,
      })),
    });
  }

  /** Call after the transaction commits to dispatch without waiting for the next poll. */
  flush(): void {
    this.relay.trigger();
  }
}
