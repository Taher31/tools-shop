import Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, LlmRequest } from './llm-client';

/** Claude through the official SDK (retries, typed errors and streaming handled there). */
export class AnthropicLlmClient implements LlmClient {
  readonly provider = 'anthropic' as const;
  private readonly client: Anthropic;

  constructor(apiKey: string | undefined, options: { baseURL?: string; timeoutMs?: number } = {}) {
    this.client = new Anthropic({
      ...(apiKey ? { apiKey } : {}),
      ...(options.baseURL ? { baseURL: options.baseURL } : {}),
      timeout: options.timeoutMs ?? 120_000,
      maxRetries: 2,
    });
  }

  async stream(
    request: LlmRequest,
    onText?: (delta: string) => void,
  ): Promise<Anthropic.Beta.BetaMessage> {
    const stream = this.client.beta.messages.stream(request);
    if (onText) stream.on('text', onText);
    return stream.finalMessage();
  }
}
