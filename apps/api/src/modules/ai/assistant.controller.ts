import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import {
  type AssistantConversationView,
  type AssistantMessageInput,
  assistantMessageSchema,
  type AssistantPublicConfig,
  type AssistantStreamEvent,
} from '@toolshop/shared';
import type { Request, Response } from 'express';
import { UuidParam, ZBody } from '../../common/decorators/validated.decorator';
import { AppException } from '../../common/errors/app-exception';
import { randomToken } from '../../common/utils/crypto';
import { AppConfig } from '../../config/app-config';
import type { AuthContext } from '../auth/auth-context';
import { AI_VISITOR_COOKIE, setAiVisitorCookie } from '../auth/auth-cookies';
import { OptionalUser, Public } from '../auth/decorators';
import { AssistantService } from './assistant.service';

/** Website assistant. Answers stream as server-sent events over a POST response. */
@Public()
@Controller('ai/assistant')
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly config: AppConfig,
  ) {}

  @Get('config')
  config_(): Promise<AssistantPublicConfig> {
    return this.assistant.publicConfig();
  }

  @Get('conversations/:id')
  conversation(
    @UuidParam() id: string,
    @Req() request: Request,
    @OptionalUser() user: AuthContext | undefined,
  ): Promise<AssistantConversationView> {
    return this.assistant.conversation(id, {
      userId: user?.userId ?? null,
      visitorKey: this.visitor(request) ?? '',
    });
  }

  @Post('messages')
  async message(
    @ZBody(assistantMessageSchema) input: AssistantMessageInput,
    @Req() request: Request,
    @Res() response: Response,
    @OptionalUser() user: AuthContext | undefined,
  ): Promise<void> {
    let visitorKey = this.visitor(request);
    if (!visitorKey) {
      visitorKey = randomToken(24);
      setAiVisitorCookie(response, this.config, visitorKey);
    }
    const identity = { userId: user?.userId ?? null, visitorKey, ip: request.ip ?? 'unknown' };
    // Limits and ownership are checked before streaming so failures are normal JSON errors.
    const conversation = await this.assistant.preflight(identity, input.conversationId);

    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    let open = true;
    response.on('close', () => (open = false));
    const emit = (event: AssistantStreamEvent) => {
      if (open) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };
    try {
      // Processing continues if the visitor closes the tab, so the history stays complete.
      await this.assistant.handle(identity, input.message, conversation, emit);
    } catch (error) {
      emit({
        type: 'error',
        message:
          error instanceof AppException
            ? error.body.message
            : 'خطایی رخ داد؛ لطفاً دوباره تلاش کنید.',
      });
    } finally {
      if (open) response.end();
    }
  }

  private visitor(request: Request): string | undefined {
    const value = (request.cookies as Record<string, string> | undefined)?.[AI_VISITOR_COOKIE];
    return typeof value === 'string' && /^[\w-]{20,64}$/.test(value) ? value : undefined;
  }
}
