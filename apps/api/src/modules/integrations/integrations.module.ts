import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES, workerProviders } from '../../infrastructure/queue/queue.constants';
import { CatalogModule } from '../catalog/catalog.module';
import { DigikalaAdapter } from './adapters/digikala.adapter';
import { MARKETPLACE_ADAPTERS, type MarketplaceAdapter } from './adapters/marketplace-adapter';
import { MockMarketplaceAdapter } from './adapters/mock-marketplace.adapter';
import { TorobAdapter } from './adapters/torob.adapter';
import { AdminIntegrationsController, FeedsController } from './integrations.controller';
import { IntegrationsListener } from './integrations.listener';
import { IntegrationsProcessor } from './integrations.processor';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [CatalogModule, BullModule.registerQueue({ name: QUEUES.MARKETPLACE_SYNC })],
  controllers: [AdminIntegrationsController, FeedsController],
  providers: [
    MockMarketplaceAdapter,
    DigikalaAdapter,
    TorobAdapter,
    {
      provide: MARKETPLACE_ADAPTERS,
      inject: [TorobAdapter, DigikalaAdapter, MockMarketplaceAdapter],
      useFactory: (...adapters: MarketplaceAdapter[]) => adapters,
    },
    IntegrationsService,
    IntegrationsListener,
    ...workerProviders(IntegrationsProcessor),
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
