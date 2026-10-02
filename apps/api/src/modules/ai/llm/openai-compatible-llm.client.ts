import type Anthropic from '@anthropic-ai/sdk';
import type { CompatStructuredMode } from '@toolshop/shared';
import type { LlmClient, LlmRequest } from './llm-client';

type Block = Anthropic.Beta.BetaContentBlock;
type Message = Anthropic.Beta.BetaMessageParam;

export class LlmHttpError extends Error {
  constructor(
    readonly status: number | null,
    message: string,
  ) {
    super(message);
  }
}

export interface OpenAiCompatOptions {
  baseUrl: string;
  apiKey?: string | null;
  structuredMode: CompatStructuredMode;
  timeoutMs?: number;
  /** Sent as HTTP-Referer / X-Title (OpenRouter uses them for attribution). */
  referer?: string;
  title?: string;
}

interface ChatChunk {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: {
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string | null;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  } | null;
  error?: { message?: string };
}

type OpenAiMessage =
  | { role: 'system' | 'user'; content: string }
  | {
      role: 'assistant';
      content: string | null;
      tool_calls?: {
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }[];
    }
  | { role: 'tool'; tool_call_id: string; content: string };

const textOf = (system: LlmRequest['system']): string =>
  !system
    ? ''
    : typeof system === 'string'
      ? system
      : system.map((block) => block.text).join('\n\n');

function toolResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content))
    return content
      .map((part) => (part && typeof part === 'object' && 'text' in part ? String(part.text) : ''))
      .join('');
  return '';
}

/** Anthropic-style history (text, tool_use, tool_result blocks) → Chat Completions messages. */
export function toOpenAiMessages(system: string, messages: Message[]): OpenAiMessage[] {
  const out: OpenAiMessage[] = [];
  if (system) out.push({ role: 'system', content: system });
  for (const message of messages) {
    if (typeof message.content === 'string') {
      out.push({ role: message.role, content: message.content } as OpenAiMessage);
      continue;
    }
    if (message.role === 'user') {
      // Tool results must directly follow the assistant message that asked for them.
      for (const block of message.content) {
        if (block.type === 'tool_result') {
          out.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: toolResultText(block.content),
          });
        }
      }
      const text = message.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('\n')
        .trim();
      if (text) out.push({ role: 'user', content: text });
      continue;
    }
    const text = message.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();
    const calls = message.content.flatMap((block) =>
      block.type === 'tool_use'
        ? [
            {
              id: block.id,
              type: 'function' as const,
              function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
            },
          ]
        : [],
    );
    // Thinking blocks are Anthropic-specific and are not replayed to other servers.
    if (!text && calls.length === 0) continue;
    out.push({
      role: 'assistant',
      content: text || null,
      ...(calls.length > 0 ? { tool_calls: calls } : {}),
    });
  }
  return out;
}

function finishToStop(
  reason: string | null | undefined,
  hasTools: boolean,
): Anthropic.Beta.BetaMessage['stop_reason'] {
  if (hasTools || reason === 'tool_calls' || reason === 'function_call') return 'tool_use';
  if (reason === 'length') return 'max_tokens';
  if (reason === 'content_filter') return 'refusal';
  return 'end_turn';
}

/** Parses JSON that models sometimes wrap in code fences or surround with prose. */
export function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced?.[1] ?? text).trim();
  if (body.startsWith('{') || body.startsWith('[')) return body;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

/**
 * Any server that speaks the OpenAI Chat Completions protocol (OpenRouter, OpenAI, Groq,
 * DeepSeek, Together, Ollama, vLLM, LM Studio…). The agent works with Anthropic-shaped
 * requests and messages; this client translates both ways, so nothing else changes.
 */
export class OpenAiCompatibleLlmClient implements LlmClient {
  readonly provider = 'openai_compatible' as const;

  constructor(private readonly options: OpenAiCompatOptions) {}

  async stream(
    request: LlmRequest,
    onText?: (delta: string) => void,
  ): Promise<Anthropic.Beta.BetaMessage> {
    const structured = request.output_config?.format as
      { schema?: Record<string, unknown> } | undefined;
    let system = textOf(request.system);
    if (structured?.schema && this.options.structuredMode !== 'json_schema') {
      system += `\n\nReply with a single JSON object (no prose, no code fences) that matches this JSON Schema:\n${JSON.stringify(structured.schema)}`;
    }
    const tools = (request.tools ?? []).flatMap((tool) =>
      'name' in tool && 'input_schema' in tool
        ? [
            {
              type: 'function' as const,
              function: {
                name: tool.name,
                description: 'description' in tool ? tool.description : undefined,
                parameters: tool.input_schema,
              },
            },
          ]
        : [],
    );

    const body: Record<string, unknown> = {
      model: request.model,
      messages: toOpenAiMessages(system, request.messages),
      max_tokens: Math.min(request.max_tokens, 8_192),
      stream: true,
      stream_options: { include_usage: true },
      ...(tools.length > 0
        ? { tools, tool_choice: request.tool_choice?.type === 'none' ? 'none' : 'auto' }
        : {}),
    };
    if (structured?.schema) {
      if (this.options.structuredMode === 'json_schema') {
        body['response_format'] = {
          type: 'json_schema',
          json_schema: { name: 'result', strict: true, schema: structured.schema },
        };
      } else if (this.options.structuredMode === 'json_object') {
        body['response_format'] = { type: 'json_object' };
      }
    }

    const response = await this.post('/chat/completions', body);
    if (!response.body) throw new LlmHttpError(response.status, 'empty response');

    let text = '';
    let finish: string | null | undefined;
    let usage: ChatChunk['usage'] = null;
    const calls = new Map<number, { id: string; name: string; args: string }>();
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let parsed: ChatChunk;
        try {
          parsed = JSON.parse(data) as ChatChunk;
        } catch {
          continue;
        }
        if (parsed.error)
          throw new LlmHttpError(null, parsed.error.message?.slice(0, 200) ?? 'provider error');
        if (parsed.usage) usage = parsed.usage;
        const choice = parsed.choices?.[0];
        if (!choice) continue;
        if (choice.finish_reason) finish = choice.finish_reason;
        const delta = choice.delta;
        if (delta?.content) {
          text += delta.content;
          onText?.(delta.content);
        }
        for (const call of delta?.tool_calls ?? []) {
          const index = call.index ?? 0;
          const entry = calls.get(index) ?? { id: '', name: '', args: '' };
          if (call.id) entry.id = call.id;
          if (call.function?.name) entry.name += call.function.name;
          if (call.function?.arguments) entry.args += call.function.arguments;
          calls.set(index, entry);
        }
      }
    }

    const blocks: Block[] = [];
    if (text.trim()) blocks.push({ type: 'text', text, citations: null } as Block);
    for (const [index, call] of [...calls.entries()].sort((a, b) => a[0] - b[0])) {
      if (!call.name) continue;
      let input: unknown = {};
      try {
        input = call.args ? JSON.parse(call.args) : {};
      } catch {
        // Invalid JSON is reported to the model as a tool error by the agent's validation.
        input = { __invalid_json: true };
      }
      blocks.push({
        type: 'tool_use',
        id: call.id || `call_${index}_${Math.random().toString(36).slice(2, 8)}`,
        name: call.name,
        input,
      } as Block);
    }
    const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
    return {
      id: `msg_compat_${Date.now().toString(36)}`,
      type: 'message',
      role: 'assistant',
      model: request.model,
      content: blocks,
      stop_reason: finishToStop(
        finish,
        blocks.some((b) => b.type === 'tool_use'),
      ),
      stop_sequence: null,
      usage: {
        input_tokens: Math.max(0, (usage?.prompt_tokens ?? 0) - cached),
        output_tokens: usage?.completion_tokens ?? 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: cached,
      },
    } as unknown as Anthropic.Beta.BetaMessage;
  }

  private async post(path: string, body: unknown): Promise<Response> {
    const base = this.options.baseUrl.replace(/\/+$/, '');
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'text/event-stream',
          ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
          ...(this.options.referer ? { 'http-referer': this.options.referer } : {}),
          'x-title': this.options.title ?? 'Toolshop',
        },
        body: JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 120_000),
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network';
      throw new LlmHttpError(null, `connection failed (${reason})`);
    }
    if (!response.ok) {
      // Only a short, secret-free excerpt of the provider's error is kept.
      const json = (await response.json().catch(() => null)) as {
        error?: { message?: string } | string;
      } | null;
      const detail = typeof json?.error === 'string' ? json.error : (json?.error?.message ?? '');
      throw new LlmHttpError(
        response.status,
        `HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      );
    }
    return response;
  }
}
