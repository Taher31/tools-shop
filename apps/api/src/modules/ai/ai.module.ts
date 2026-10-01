import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ContentModule } from '../content/content.module';
import { SearchModule } from '../search/search.module';
import { ShippingModule } from '../shipping/shipping.module';
import { AgentService } from './agent.service';
import { AiSettingsService } from './ai-settings.service';
import { AiUsageService } from './ai-usage.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { StructuredAiService } from './structured.service';
import { AssistantToolsService } from './tools/assistant-tools.service';

@Module({
  imports: [CatalogModule, SearchModule, ContentModule, ShippingModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AiSettingsService,
    AiUsageService,
    AssistantToolsService,
    AgentService,
    StructuredAiService,
  ],
  exports: [AiSettingsService, AiUsageService, AgentService, StructuredAiService],
})
export class AiModule {}
