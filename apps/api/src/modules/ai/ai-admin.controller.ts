import { Get, HttpCode, HttpStatus, Param, ParseEnumPipe, Post, Put } from '@nestjs/common';
import {
  type AiConversationDetail,
  type AiConversationSummary,
  type AiDraft,
  type AiSecretsUpdateInput,
  aiSecretsUpdateSchema,
  type AiSettings,
  aiSettingsSchema,
  type AiSettingsView,
  type AiUsageSummary,
  adminListQuerySchema,
  MESSENGER_CHANNELS,
  type MessengerChannel,
  type MessengerChannelView,
  type MessengerUpdateInput,
  messengerUpdateSchema,
  type Paginated,
  type ProductContentDraft,
  type ProductContentRequest,
  productContentRequestSchema,
  type TicketTriage,
} from '@toolshop/shared';
import { z } from 'zod';
import { UuidParam, ZBody, ZQuery } from '../../common/decorators/validated.decorator';
import { AdminController, RequirePermissions } from '../auth/decorators';
import { AiAdminService } from './ai-admin.service';
import { AiSettingsService } from './ai-settings.service';
import { AiStaffService } from './ai-staff.service';
import { AiUsageService } from './ai-usage.service';
import { MessengerConfigService } from './messengers/messenger-config.service';

const channelPipe = new ParseEnumPipe(Object.fromEntries(MESSENGER_CHANNELS.map((c) => [c, c])));

const conversationListSchema = adminListQuerySchema.extend({
  channel: z.enum(['web', 'telegram', 'bale', 'eitaa']).optional(),
});

@AdminController('ai')
export class AdminAiController {
  constructor(
    private readonly settings: AiSettingsService,
    private readonly usage: AiUsageService,
    private readonly admin: AiAdminService,
    private readonly staff: AiStaffService,
    private readonly messengers: MessengerConfigService,
  ) {}

  @Get('messengers')
  @RequirePermissions('ai.read')
  listMessengers(): Promise<MessengerChannelView[]> {
    return this.messengers.views();
  }

  @Put('messengers/:channel')
  @RequirePermissions('ai.manage')
  updateMessenger(
    @Param('channel', channelPipe) channel: MessengerChannel,
    @ZBody(messengerUpdateSchema) input: MessengerUpdateInput,
  ): Promise<MessengerChannelView> {
    return this.messengers.update(channel, input);
  }

  @Post('messengers/:channel/webhook')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('ai.manage')
  registerWebhook(
    @Param('channel', channelPipe) channel: MessengerChannel,
  ): Promise<MessengerChannelView> {
    return this.messengers.registerWebhook(channel);
  }

  @Get('settings')
  @RequirePermissions('ai.read')
  getSettings(): Promise<AiSettingsView> {
    return this.settings.view();
  }

  @Put('settings')
  @RequirePermissions('ai.manage')
  updateSettings(@ZBody(aiSettingsSchema) input: AiSettings): Promise<AiSettingsView> {
    return this.settings.update(input);
  }

  @Put('secrets')
  @RequirePermissions('ai.manage')
  updateSecrets(
    @ZBody(aiSecretsUpdateSchema) input: AiSecretsUpdateInput,
  ): Promise<AiSettingsView> {
    return this.settings.updateSecrets(input);
  }

  @Get('usage')
  @RequirePermissions('ai.read')
  async getUsage(): Promise<AiUsageSummary> {
    return this.usage.summary((await this.settings.get()).monthlyBudgetUsd);
  }

  @Get('conversations')
  @RequirePermissions('ai.read')
  conversations(
    @ZQuery(conversationListSchema) query: z.infer<typeof conversationListSchema>,
  ): Promise<Paginated<AiConversationSummary>> {
    return this.admin.conversations(query);
  }

  @Get('conversations/:id')
  @RequirePermissions('ai.read')
  conversation(@UuidParam() id: string): Promise<AiConversationDetail> {
    return this.admin.conversation(id);
  }

  @Post('questions/:id/suggest')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('question.answer', 'ai.use')
  suggestAnswer(@UuidParam() id: string): Promise<AiDraft> {
    return this.staff.suggestQuestionAnswer(id);
  }

  @Post('tickets/:id/draft')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('ticket.reply', 'ai.use')
  draftReply(@UuidParam() id: string): Promise<AiDraft> {
    return this.staff.draftTicketReply(id);
  }

  @Post('tickets/:id/triage')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('ticket.manage', 'ai.use')
  triage(@UuidParam() id: string): Promise<TicketTriage> {
    return this.staff.triageTicket(id);
  }

  @Post('product-content')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product.update', 'ai.use')
  productContent(
    @ZBody(productContentRequestSchema) input: ProductContentRequest,
  ): Promise<ProductContentDraft> {
    return this.staff.productContent(input);
  }
}
