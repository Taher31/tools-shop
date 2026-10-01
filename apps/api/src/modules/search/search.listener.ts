import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DomainEventMap } from '../../infrastructure/outbox/domain-events';
import { ProductQueryService } from '../catalog/products/product-query.service';
import { SearchIndexService } from './search-index.service';

/** Outbox listeners keeping the search index (and listing caches) in sync. */
@Injectable()
export class SearchSyncListener {
  constructor(
    private readonly index: SearchIndexService,
    private readonly products: ProductQueryService,
  ) {}

  @OnEvent('product.changed', { suppressErrors: false })
  @OnEvent('product.deleted', { suppressErrors: false })
  async onProductChanged(payload: DomainEventMap['product.changed']): Promise<void> {
    await this.index.enqueueProducts(payload.productIds);
    await this.products.invalidateHome();
  }

  @OnEvent('inventory.changed', { suppressErrors: false })
  async onInventoryChanged(payload: DomainEventMap['inventory.changed']): Promise<void> {
    await this.index.enqueueProducts(payload.productIds);
    await this.products.invalidateHome();
  }

  @OnEvent('catalog.taxonomy_changed', { suppressErrors: false })
  async onTaxonomyChanged(payload: DomainEventMap['catalog.taxonomy_changed']): Promise<void> {
    await this.index.enqueueProducts(await this.index.productIdsForTaxonomy(payload));
    await this.products.invalidateHome();
  }
}
