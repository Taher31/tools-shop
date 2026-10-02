import type Anthropic from '@anthropic-ai/sdk';

export type LlmRequest = Anthropic.Beta.MessageCreateParamsNonStreaming;

/**
 * The single seam between the store and a language model. Requests and responses use
 * the Anthropic SDK types, so the agent code is written once; the mock implementation
 * returns the same shapes for development and tests.
 */
export interface LlmClient {
  readonly provider: 'anthropic' | 'openai_compatible' | 'mock';
  /** Streams a response, reporting text deltas, and resolves with the final message. */
  stream(
    request: LlmRequest,
    onText?: (delta: string) => void,
  ): Promise<Anthropic.Beta.BetaMessage>;
}
