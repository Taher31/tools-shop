import type Anthropic from '@anthropic-ai/sdk';

/** USD per million tokens (list prices; used only to estimate spend against the budget). */
const PRICES: Record<
  string,
  { input: number; output: number; cacheRead: number; cacheWrite: number }
> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  mock: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};
const FALLBACK_PRICE = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 };

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function tokenUsage(usage: Anthropic.Beta.BetaUsage): TokenUsage {
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

/** Estimated cost in micro-dollars (1e-6 USD), rounded up so budgets are never under-counted. */
export interface PriceOverride {
  /** USD per million tokens, as entered by the administrator. */
  inputUsd: number;
  outputUsd: number;
}

export function costMicros(
  model: string,
  usage: TokenUsage,
  override?: PriceOverride | null,
): number {
  const price = override
    ? {
        input: override.inputUsd,
        output: override.outputUsd,
        cacheRead: override.inputUsd * 0.5,
        cacheWrite: override.inputUsd,
      }
    : (PRICES[model] ?? FALLBACK_PRICE);
  const usd =
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.cacheRead +
      usage.cacheWriteTokens * price.cacheWrite) /
    1_000_000;
  return Math.ceil(usd * 1_000_000);
}
