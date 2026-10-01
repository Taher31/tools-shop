import { Controller, Headers, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { MESSENGER_CHANNELS, type MessengerChannel } from '@toolshop/shared';
import type { Request } from 'express';
import { AppException } from '../../../common/errors/app-exception';
import { Public } from '../../auth/decorators';
import { MessengerConfigService } from './messenger-config.service';
import { MessengerService } from './messenger.service';

/**
 * Webhook endpoint for messenger bots. Authenticated by the random secret in the path
 * (and Telegram's secret-token header). Unknown channels and wrong secrets get the same
 * 404, so the endpoint reveals nothing about configuration.
 */
@Public()
@Controller('webhooks/messenger')
export class MessengerWebhookController {
  constructor(
    private readonly configs: MessengerConfigService,
    private readonly messenger: MessengerService,
  ) {}

  @Post(':channel/:secret')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Param('channel') channel: string,
    @Param('secret') secret: string,
    @Headers('x-telegram-bot-api-secret-token') headerSecret: string | undefined,
    @Req() request: Request,
  ): Promise<{ ok: true }> {
    const known = (MESSENGER_CHANNELS as readonly string[]).includes(channel);
    if (
      !known ||
      secret.length > 100 ||
      !(await this.configs.authenticate(channel as MessengerChannel, secret, headerSecret))
    ) {
      throw AppException.notFound();
    }
    await this.messenger.accept(channel as MessengerChannel, request.body);
    return { ok: true };
  }
}
