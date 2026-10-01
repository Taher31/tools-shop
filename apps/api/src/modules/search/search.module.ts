import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { QUEUES, workerProviders } from '../../infrastructure/queue/queue.constants';
import { CatalogModule } from '../catalog/catalog.module';
import { createMeiliClient, MEILI_CLIENT } from './meili.client';
import { AdminSearchController, SearchController } from './search.controller';
import { SearchIndexService } from './search-index.service';
import { SearchSyncListener } from './search.listener';
import { SearchIndexProcessor } from './search.processor';
import { SearchService } from './search.service';

@Module({
  imports: [CatalogModule, BullModule.registerQueue({ name: QUEUES.SEARCH_INDEXING })],
  controllers: [SearchController, AdminSearchController],
  providers: [
    { provide: MEILI_CLIENT, inject: [AppConfig], useFactory: createMeiliClient },
    SearchIndexService,
    SearchService,
    SearchSyncListener,
    ...workerProviders(SearchIndexProcessor),
  ],
  exports: [SearchIndexService, SearchService],
})
export class SearchModule {}
