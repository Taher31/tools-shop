import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DomainEventMap } from '../../infrastructure/outbox/domain-events';
import { IntegrationsService } from './integrations.service';

/** Product, price and stock changes are pushed to every enabled marketplace. */
@Injectable()
export class IntegrationsListener {
  constructor(private readonly integrations: IntegrationsService) {}

  @OnEvent('product.changed', { suppressErrors: false })
  @OnEvent('product.deleted', { suppressErrors: false })
  async onProductChanged(payload: DomainEventMap['product.changed']): Promise<void> {
    await this.integrations.enqueueChangedProducts(payload.productIds);
  }

  @OnEvent('inventory.changed', { suppressErrors: false })
  async onInventoryChanged(payload: DomainEventMap['inventory.changed']): Promise<void> {
    await this.integrations.enqueueChangedProducts(payload.productIds);
  }
}
