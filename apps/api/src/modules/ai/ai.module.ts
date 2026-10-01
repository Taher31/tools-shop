import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES, workerProviders } from '../../infrastructure/queue/queue.constants';
import { CatalogModule } from '../catalog/catalog.module';
import { ContentModule } from '../content/content.module';
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
import { StructuredAiService } from './structured.service';
import { AssistantToolsService } from './tools/assistant-tools.service';

@Module({
  imports: [
    CatalogModule,
    SearchModule,
    ContentModule,
    ShippingModule,
    BullModule.registerQueue({ name: QUEUES.AI_TASKS }),
  ],
  controllers: [AssistantController, AdminAiController],
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
    ...workerProviders(AiTasksProcessor),
  ],
  exports: [AiSettingsService, AiUsageService, AgentService, StructuredAiService],
})
export class AiModule {}
