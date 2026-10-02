import { BullModule } from '@nestjs/bullmq';
import { Module, type Provider } from '@nestjs/common';
import { QUEUES, workerProviders } from '../../infrastructure/queue/queue.constants';
import { CatalogModule } from '../catalog/catalog.module';
import { ContentModule } from '../content/content.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { SearchModule } from '../search/search.module';
import { ShippingModule } from '../shipping/shipping.module';
import { AgentService } from './agent.service';
import { AdminAiController } from './ai-admin.controller';
import { AiAdminService } from './ai-admin.service';
import { AiStaffService } from './ai-staff.service';
import { AiTasksListener } from './ai-tasks.listener';
import { AiTasksProcessor } from './ai-tasks.processor';
import { AiSettingsService } from './ai-settings.service';
import { AiUsageService } from './ai-usage.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { ConversationStore } from './conversation-store.service';
import { MessengerConfigService } from './messengers/messenger-config.service';
import { MessengerWebhookController } from './messengers/messenger-webhook.controller';
import { MessengerProcessor } from './messengers/messenger.processor';
import { MessengerService } from './messengers/messenger.service';
import { StructuredAiService } from './structured.service';
import { AssistantToolsService } from './tools/assistant-tools.service';

@Module({
  imports: [
    CatalogModule,
    SearchModule,
    ContentModule,
    ReviewsModule,
    ShippingModule,
    BullModule.registerQueue({ name: QUEUES.AI_TASKS }, { name: QUEUES.MESSENGER }),
  ],
  controllers: [AssistantController, AdminAiController, MessengerWebhookController],
  providers: [
    AssistantService,
    AiSettingsService,
    AiUsageService,
    AssistantToolsService,
    AgentService,
    StructuredAiService,
    AiStaffService,
    AiAdminService,
    AiTasksListener,
    ConversationStore,
    MessengerConfigService,
    MessengerService,
    ...workerProviders<Provider>(AiTasksProcessor, MessengerProcessor),
  ],
  exports: [AiSettingsService, AiUsageService, AgentService, StructuredAiService],
})
export class AiModule {}
