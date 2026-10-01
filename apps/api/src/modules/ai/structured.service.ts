import { Injectable, Logger } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import type { AiFeature } from '@toolshop/shared';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app-exception';
import { AiUnavailableError } from './ai-errors';
import { AiSettingsService } from './ai-settings.service';
import { AiUsageService } from './ai-usage.service';

export interface StructuredRequest<T> {
  feature: Exclude<AiFeature, 'assistant' | 'messenger'>;
  system: string;
  prompt: string;
  /** JSON schema the response must follow (structured outputs). */
  jsonSchema: Record<string, unknown>;
  /** Same shape as zod, used to validate before anything is shown or stored. */
  schema: z.ZodType<T>;
  effort?: 'low' | 'medium' | 'high';
}

/**
 * One-shot generation with structured output for staff tools (answer drafts, ticket
 * triage, product copy). Results are suggestions: callers store them as drafts and a
 * human decides, except where an admin explicitly enabled auto-publishing.
 */
@Injectable()
export class StructuredAiService {
  private readonly logger = new Logger(StructuredAiService.name);

  constructor(
    private readonly aiSettings: AiSettingsService,
    private readonly usage: AiUsageService,
  ) {}

  async generate<T>(request: StructuredRequest<T>): Promise<T> {
    const { llm, settings, model } = await this.aiSettings.clientFor(request.feature);
    await this.usage.assertWithinBudget(settings);
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await llm.stream({
        model,
        max_tokens: 16_000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: request.system,
        output_config: {
          effort: request.effort ?? 'medium',
          format: { type: 'json_schema', schema: request.jsonSchema },
        },
        messages: [{ role: 'user', content: request.prompt }],
      });
    } catch (error) {
      this.logger.error({ err: error, feature: request.feature }, 'Structured AI request failed');
      throw new AiUnavailableError(
        'provider',
        'سرویس هوش مصنوعی در دسترس نیست؛ کمی بعد دوباره تلاش کنید.',
      );
    }
    await this.usage.record(request.feature, model, message);
    if (message.stop_reason === 'refusal') {
      throw new AppException('BAD_REQUEST', 'هوش مصنوعی برای این درخواست پاسخی تولید نکرد.');
    }
    if (message.stop_reason === 'max_tokens') {
      throw new AiUnavailableError('provider', 'پاسخ هوش مصنوعی ناقص ماند؛ دوباره تلاش کنید.');
    }
    const text = message.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AiUnavailableError('provider', 'پاسخ هوش مصنوعی قابل پردازش نبود.');
    }
    const parsed = request.schema.safeParse(raw);
    if (!parsed.success)
      throw new AiUnavailableError('provider', 'پاسخ هوش مصنوعی قابل پردازش نبود.');
    return parsed.data;
  }
}
