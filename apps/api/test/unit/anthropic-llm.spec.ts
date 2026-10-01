import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AnthropicLlmClient } from '../../src/modules/ai/llm/anthropic-llm.client';
import { costMicros, tokenUsage } from '../../src/modules/ai/pricing';

/** Minimal stand-in for POST /v1/messages that streams a canned SSE response. */
const EVENTS = [
  {
    type: 'message_start',
    message: {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5-5',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 1200,
        output_tokens: 1,
        cache_read_input_tokens: 1000,
        cache_creation_input_tokens: 0,
      },
    },
  },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'بگذارید ' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'جست‌وجو کنم.' } },
  { type: 'content_block_stop', index: 0 },
  {
    type: 'content_block_start',
    index: 1,
    content_block: { type: 'tool_use', id: 'toolu_1', name: 'search_products', input: {} },
  },
  {
    type: 'content_block_delta',
    index: 1,
    delta: { type: 'input_json_delta', partial_json: '{"query":"دریل' },
  },
  {
    type: 'content_block_delta',
    index: 1,
    delta: { type: 'input_json_delta', partial_json: ' شارژی"}' },
  },
  { type: 'content_block_stop', index: 1 },
  {
    type: 'message_delta',
    delta: { stop_reason: 'tool_use', stop_sequence: null },
    usage: { output_tokens: 42 },
  },
  { type: 'message_stop' },
];

let server: Server;
let baseURL: string;
let captured: { headers: IncomingMessage['headers']; body: Record<string, unknown> } | null = null;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      captured = { headers: req.headers, body: JSON.parse(raw) as Record<string, unknown> };
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const event of EVENTS)
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('AnthropicLlmClient', () => {
  it('streams text, parses tool calls and sends the expected request', async () => {
    const client = new AnthropicLlmClient('sk-ant-test', { baseURL });
    const deltas: string[] = [];
    const message = await client.stream(
      {
        model: 'claude-opus-5-5',
        max_tokens: 16_000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [{ type: 'text', text: 'system', cache_control: { type: 'ephemeral' } }],
        cache_control: { type: 'ephemeral' },
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: 'دریل شارژی می‌خواهم' }],
      },
      (delta) => deltas.push(delta),
    );

    expect(deltas.join('')).toBe('بگذارید جست‌وجو کنم.');
    expect(message.stop_reason).toBe('tool_use');
    const toolUse = message.content.find((b) => b.type === 'tool_use');
    expect(toolUse).toMatchObject({ name: 'search_products', input: { query: 'دریل شارژی' } });

    expect(captured?.headers['x-api-key']).toBe('sk-ant-test');
    expect(String(captured?.headers['anthropic-beta'])).toContain(
      'server-side-fallback-2026-07-01',
    );
    expect(captured?.body).toMatchObject({
      model: 'claude-opus-5-5',
      stream: true,
      fallbacks: 'default',
      output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' },
    });

    const usage = tokenUsage(message.usage);
    expect(usage).toEqual({
      inputTokens: 1200,
      outputTokens: 42,
      cacheReadTokens: 1000,
      cacheWriteTokens: 0,
    });
    // 1200 × $4 + 42 × $20 + 1000 × $0.20 per million tokens
    expect(costMicros('claude-opus-5-5', usage)).toBe(Math.ceil(1200 * 4 + 42 * 20 + 1000 * 0.2));
  });
});
