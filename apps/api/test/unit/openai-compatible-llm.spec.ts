import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { validateCompatBaseUrl } from '@toolshop/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  extractJson,
  LlmHttpError,
  OpenAiCompatibleLlmClient,
  toOpenAiMessages,
} from '../../src/modules/ai/llm/openai-compatible-llm.client';
import { costMicros } from '../../src/modules/ai/pricing';

const sse = (chunks: unknown[]) =>
  `${chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('')}data: [DONE]\n\n`;

const CHUNKS = [
  { choices: [{ delta: { role: 'assistant', content: 'بگذارید ' } }] },
  { choices: [{ delta: { content: 'جست‌وجو کنم.' } }] },
  {
    choices: [
      {
        delta: {
          tool_calls: [
            {
              index: 0,
              id: 'call_1',
              function: { name: 'search_products', arguments: '{"query":"دریل' },
            },
          ],
        },
      },
    ],
  },
  { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ' شارژی"}' } }] } }] },
  { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
  {
    choices: [],
    usage: {
      prompt_tokens: 1200,
      completion_tokens: 42,
      prompt_tokens_details: { cached_tokens: 1000 },
    },
  },
];

let server: Server;
let baseUrl: string;
let captured: {
  headers: IncomingMessage['headers'];
  body: Record<string, unknown>;
  url: string;
} | null = null;
let mode: 'ok' | 'unauthorized' = 'ok';

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c: Buffer) => (raw += c.toString()));
    req.on('end', () => {
      captured = {
        headers: req.headers,
        body: JSON.parse(raw) as Record<string, unknown>,
        url: req.url ?? '',
      };
      if (mode === 'unauthorized') {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            error: { message: 'Incorrect API key provided: sk-live-SECRETSECRETSECRET' },
          }),
        );
        return;
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(sse(CHUNKS));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => {
  server.close();
});

const client = (structuredMode: 'json_schema' | 'json_object' | 'prompt' = 'json_schema') =>
  new OpenAiCompatibleLlmClient({
    baseUrl,
    apiKey: 'sk-test-123',
    structuredMode,
    referer: 'https://shop.example',
  });

describe('OpenAI-compatible client', () => {
  it('translates a tool-using conversation and streams the answer back as Anthropic blocks', async () => {
    mode = 'ok';
    const deltas: string[] = [];
    const message = await client().stream(
      {
        model: 'anthropic/claude-sonnet-4.5',
        max_tokens: 16_000,
        system: [
          { type: 'text', text: 'You are a shop assistant.', cache_control: { type: 'ephemeral' } },
        ],
        tools: [
          {
            name: 'search_products',
            description: 'Search',
            input_schema: {
              type: 'object',
              properties: { query: { type: 'string' } },
              required: ['query'],
            },
          },
        ],
        tool_choice: { type: 'none' },
        betas: ['server-side-fallback-2026-07-01'],
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'دریل' }] },
          {
            role: 'assistant',
            content: [
              { type: 'thinking', thinking: 'hmm', signature: 'sig' },
              { type: 'text', text: 'جست‌وجو می‌کنم' },
              {
                type: 'tool_use',
                id: 'toolu_1',
                name: 'search_products',
                input: { query: 'دریل' },
              },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '{"products":[]}' }],
          },
        ],
      } as never,
      (d) => deltas.push(d),
    );

    expect(captured?.url).toBe('/v1/chat/completions');
    expect(captured?.headers['authorization']).toBe('Bearer sk-test-123');
    expect(captured?.headers['http-referer']).toBe('https://shop.example');
    const body = captured?.body as {
      model: string;
      stream: boolean;
      max_tokens: number;
      tool_choice: string;
      tools: { function: { name: string; parameters: unknown } }[];
      messages: {
        role: string;
        content: string | null;
        tool_calls?: unknown[];
        tool_call_id?: string;
      }[];
    };
    expect(body.model).toBe('anthropic/claude-sonnet-4.5');
    expect(body.stream).toBe(true);
    expect(body.max_tokens).toBeLessThanOrEqual(8192);
    expect(body.tool_choice).toBe('none');
    expect(body.tools[0]?.function.name).toBe('search_products');
    expect(JSON.stringify(body)).not.toContain('thinking');
    expect(JSON.stringify(body)).not.toContain('server-side-fallback');
    expect(body.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'tool']);
    expect(body.messages[2]?.tool_calls).toHaveLength(1);
    expect(body.messages[3]).toMatchObject({ role: 'tool', tool_call_id: 'toolu_1' });

    expect(deltas.join('')).toBe('بگذارید جست‌وجو کنم.');
    expect(message.stop_reason).toBe('tool_use');
    expect(message.content.map((b) => b.type)).toEqual(['text', 'tool_use']);
    const tool = message.content[1];
    expect(tool).toMatchObject({
      type: 'tool_use',
      id: 'call_1',
      name: 'search_products',
      input: { query: 'دریل شارژی' },
    });
    expect(message.usage).toMatchObject({
      input_tokens: 200,
      output_tokens: 42,
      cache_read_input_tokens: 1000,
    });
  });

  it('requests structured output according to the configured mode', async () => {
    mode = 'ok';
    const base = {
      model: 'm',
      max_tokens: 100,
      system: 'sys',
      messages: [{ role: 'user', content: 'x' }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: { type: 'object', properties: { a: { type: 'string' } } },
        },
      },
    } as never;
    await client('json_schema').stream(base);
    expect((captured?.body['response_format'] as { type: string }).type).toBe('json_schema');
    await client('json_object').stream(base);
    expect((captured?.body['response_format'] as { type: string }).type).toBe('json_object');
    expect(JSON.stringify(captured?.body['messages'])).toContain('JSON Schema');
    await client('prompt').stream(base);
    expect(captured?.body['response_format']).toBeUndefined();
    expect(JSON.stringify(captured?.body['messages'])).toContain('JSON Schema');
  });

  it('reports provider errors without leaking secrets from the response body', async () => {
    mode = 'unauthorized';
    const error = await client()
      .stream({ model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] } as never)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmHttpError);
    expect((error as LlmHttpError).status).toBe(401);
    mode = 'ok';
  });

  it('prices usage from administrator-entered rates', () => {
    const cost = costMicros(
      'any/model',
      { inputTokens: 1_000_000, outputTokens: 500_000, cacheReadTokens: 0, cacheWriteTokens: 0 },
      { inputUsd: 3, outputUsd: 15 },
    );
    expect(cost).toBe(10_500_000);
  });

  it('handles history helpers and lenient JSON', () => {
    expect(toOpenAiMessages('', [{ role: 'user', content: 'سلام' }])).toEqual([
      { role: 'user', content: 'سلام' },
    ]);
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJson('Sure! Here it is: {"a":1} hope it helps')).toBe('{"a":1}');
  });

  it('only accepts safe server addresses', () => {
    expect(validateCompatBaseUrl('https://openrouter.ai/api/v1')).toBeNull();
    expect(validateCompatBaseUrl('http://localhost:11434/v1')).toBeNull();
    expect(validateCompatBaseUrl('')).toBeNull();
    expect(validateCompatBaseUrl('http://example.com/v1')).not.toBeNull();
    expect(validateCompatBaseUrl('https://user:pass@example.com/v1')).not.toBeNull();
    expect(validateCompatBaseUrl('http://169.254.169.254/latest')).not.toBeNull();
    expect(validateCompatBaseUrl('https://metadata.google.internal/')).not.toBeNull();
    expect(validateCompatBaseUrl('ftp://example.com')).not.toBeNull();
    expect(validateCompatBaseUrl('not a url')).not.toBeNull();
  });
});
