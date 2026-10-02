import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
  AiConnectionTest,
  AiSettingsView,
  TicketDetail,
  TicketTriage,
} from '@toolshop/shared';
import { aiSettingsSchema } from '@toolshop/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { CacheService } from '../../src/infrastructure/redis/cache.service';
import { ADMIN, type Agent, agentFor, API, createTestApp, login, newCustomer } from './support/app';
import { ok } from './support/commerce';
import { sse } from './support/sse';

const stream = (content: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n` +
  `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n` +
  `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 1000, completion_tokens: 200 } })}\n\ndata: [DONE]\n\n`;

describe('OpenAI-compatible provider (OpenRouter, OpenAI, Ollama…)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let server: Server;
  let baseUrl: string;
  const seen: { auth: string | undefined; model: string; tools: boolean }[] = [];

  const configure = async (overrides: Record<string, unknown> = {}) => {
    const value = aiSettingsSchema.parse({
      enabled: true,
      provider: 'openai_compatible',
      compatBaseUrl: baseUrl,
      compatModel: 'vendor/model-x',
      compatInputPriceUsd: 2,
      compatOutputPriceUsd: 10,
      compatStructuredMode: 'prompt',
      ...overrides,
    });
    await prisma.setting.upsert({
      where: { key: 'ai' },
      update: { value },
      create: { key: 'ai', value },
    });
    await app.get(CacheService).del('ai:settings');
  };

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c: Buffer) => (raw += c.toString()));
      req.on('end', () => {
        const body = JSON.parse(raw) as {
          model: string;
          tools?: unknown[];
          messages: { content?: string }[];
        };
        seen.push({
          auth: req.headers.authorization,
          model: body.model,
          tools: Boolean(body.tools),
        });
        const wantsJson = JSON.stringify(body.messages).includes('JSON Schema');
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.end(
          stream(
            wantsJson
              ? '```json\n{"summary":"مشتری ناراضی است","sentiment":"negative","priority":"high","category":"payment"}\n```'
              : 'سلام! من از طریق سرور سازگار پاسخ می‌دهم.',
          ),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await login(app, ADMIN.identifier, ADMIN.password);
  });

  afterAll(async () => {
    await app?.close();
    server?.close();
  });

  it('validates the server address and stores each key separately and encrypted', async () => {
    const view = ok<AiSettingsView>(await admin.get(`${API}/admin/ai/settings`));
    const bad = await admin.put(`${API}/admin/ai/settings`).send({
      ...view.settings,
      provider: 'openai_compatible',
      compatBaseUrl: 'http://example.com/v1',
      compatModel: 'm',
    });
    expect(bad.status).toBe(400);
    const metadata = await admin
      .put(`${API}/admin/ai/settings`)
      .send({ ...view.settings, compatBaseUrl: 'http://169.254.169.254/latest', compatModel: 'm' });
    expect(metadata.status).toBe(400);

    const saved = ok<AiSettingsView>(
      await admin.put(`${API}/admin/ai/settings`).send({
        ...view.settings,
        enabled: true,
        provider: 'openai_compatible',
        compatBaseUrl: baseUrl,
        compatModel: 'vendor/model-x',
        compatInputPriceUsd: 2,
        compatOutputPriceUsd: 10,
        compatStructuredMode: 'prompt',
      }),
    );
    expect(saved.ready).toBe(true);
    expect(saved.settings.provider).toBe('openai_compatible');

    const key = 'or-live-ABCDEFGHIJKLMNOP1234';
    const afterKey = ok<AiSettingsView>(
      await admin.put(`${API}/admin/ai/secrets`).send({ compatApiKey: key }),
    );
    expect(afterKey.compatKey).toEqual({ source: 'settings', preview: '••••1234' });
    expect(afterKey.key.source).not.toBe('settings');
    expect(JSON.stringify(afterKey)).not.toContain(key);
    const row = await prisma.setting.findUniqueOrThrow({ where: { key: 'ai_secrets' } });
    expect(JSON.stringify(row.value)).not.toContain(key);
    expect(
      JSON.stringify(await prisma.auditLog.findMany({ where: { action: 'ai.key.update' } })),
    ).not.toContain(key);
    expect((await admin.put(`${API}/admin/ai/secrets`).send({})).status).toBe(400);
  });

  it('tests the connection and reports problems without secrets', async () => {
    const result = ok<AiConnectionTest>(await admin.post(`${API}/admin/ai/test`));
    expect(result).toMatchObject({
      ok: true,
      provider: 'openai_compatible',
      model: 'vendor/model-x',
    });
    expect(seen.at(-1)).toMatchObject({
      auth: 'Bearer or-live-ABCDEFGHIJKLMNOP1234',
      model: 'vendor/model-x',
    });

    await configure({ compatBaseUrl: 'http://127.0.0.1:1/v1' });
    const failed = ok<AiConnectionTest>(await admin.post(`${API}/admin/ai/test`));
    expect(failed.ok).toBe(false);
    expect(failed.message).not.toContain('or-live');
    await configure();
  });

  it('serves the website assistant through the compatible server and prices usage from the configured rates', async () => {
    const guest = agentFor(app);
    const response = await sse(
      guest.post(`${API}/ai/assistant/messages`).send({ message: 'سلام' }),
    );
    expect(response.status).toBe(200);
    const text = response.events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join('');
    expect(text).toContain('سرور سازگار');
    expect(seen.at(-1)?.tools).toBe(true);
    const usage = await prisma.aiUsage.findFirstOrThrow({
      where: { model: 'vendor/model-x', feature: 'assistant' },
      orderBy: { createdAt: 'desc' },
    });
    // 1000 in × $2/M + 200 out × $10/M = $0.004
    expect(Number(usage.costMicros)).toBe(4000);
  });

  it('parses fenced JSON for structured staff tools', async () => {
    const customer = await newCustomer(app);
    const ticket = ok<TicketDetail>(
      await customer.agent
        .post(`${API}/account/tickets`)
        .send({ subject: 'مشکل پرداخت', category: 'other', body: 'مبلغ کسر شد' }),
    );
    const triage = ok<TicketTriage>(
      await admin.post(`${API}/admin/ai/tickets/${ticket.id}/triage`),
    );
    expect(triage).toMatchObject({ sentiment: 'negative', suggestedPriority: 'high' });
  });

  it('is not ready until an address and model are set', async () => {
    await configure({ compatBaseUrl: '', compatModel: '' });
    expect(ok<AiSettingsView>(await admin.get(`${API}/admin/ai/settings`)).ready).toBe(false);
    await configure();
  });
});
