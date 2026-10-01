import type { NestExpressApplication } from '@nestjs/platform-express';
import type {
  ApiErrorBody,
  AssistantConversationView,
  AssistantPublicConfig,
} from '@toolshop/shared';
import { aiSettingsSchema } from '@toolshop/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { CacheService } from '../../src/infrastructure/redis/cache.service';
import {
  type Agent,
  agentFor,
  API,
  createTestApp,
  CUSTOMER,
  login,
  newCustomer,
} from './support/app';
import { ok } from './support/commerce';
import { sse } from './support/sse';

describe('AI website assistant', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  async function configure(overrides: Record<string, unknown>) {
    const value = aiSettingsSchema.parse({ enabled: true, provider: 'mock', ...overrides });
    await prisma.setting.upsert({
      where: { key: 'ai' },
      update: { value },
      create: { key: 'ai', value },
    });
    await app.get(CacheService).del('ai:settings');
  }

  const ask = (agent: Agent, message: string, conversationId?: string) =>
    sse(agent.post(`${API}/ai/assistant/messages`).send({ message, conversationId }));

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('is off until an administrator enables it', async () => {
    await configure({ enabled: false });
    const guest = agentFor(app);
    expect(ok<AssistantPublicConfig>(await guest.get(`${API}/ai/assistant/config`)).enabled).toBe(
      false,
    );
    const response = await ask(guest, 'سلام');
    expect(response.status).toBe(503);
    await configure({});
    expect(ok<AssistantPublicConfig>(await guest.get(`${API}/ai/assistant/config`)).enabled).toBe(
      true,
    );
  });

  it('streams a grounded answer with live product cards and keeps the conversation', async () => {
    const guest = agentFor(app);
    const first = await ask(guest, 'دریل شارژی');
    expect(first.status).toBe(200);
    const types = first.events.map((e) => e.type);
    expect(types[0]).toBe('conversation');
    expect(types).toContain('tool');
    expect(types.at(-1)).toBe('done');
    const products = first.events.find((e) => e.type === 'products');
    expect(products && products.type === 'products' && products.products.length).toBeGreaterThan(0);
    const text = first.events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join('');
    expect(text).toContain('پیشنهاد');

    const conversationId =
      first.events[0]?.type === 'conversation' ? first.events[0].conversationId : '';
    const second = await ask(guest, 'فرز', conversationId);
    expect(second.events.at(-1)?.type).toBe('done');

    const view = ok<AssistantConversationView>(
      await guest.get(`${API}/ai/assistant/conversations/${conversationId}`),
    );
    expect(view.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(view.messages[1]?.products.length).toBeGreaterThan(0);

    // The full API history (tool calls and results) is stored for exact replay.
    const rows = await prisma.aiMessage.count({ where: { conversationId } });
    expect(rows).toBeGreaterThan(4);
    const usage = await prisma.aiUsage.count({ where: { conversationId, feature: 'assistant' } });
    expect(usage).toBeGreaterThanOrEqual(3);

    // Another visitor cannot read or continue it.
    const stranger = agentFor(app);
    expect((await stranger.get(`${API}/ai/assistant/conversations/${conversationId}`)).status).toBe(
      404,
    );
    expect((await ask(stranger, 'ادامه', conversationId)).status).toBe(404);
  });

  it('answers order questions only for the signed-in owner', async () => {
    const owner = await login(app, CUSTOMER.identifier, CUSTOMER.password);
    const order = await prisma.order.findFirstOrThrow({
      where: { user: { mobile: CUSTOMER.identifier } },
    });

    const mine = await ask(owner, `سفارش ${order.orderNumber} کجاست؟`);
    const tool = mine.events.find((e) => e.type === 'tool');
    expect(tool && tool.type === 'tool' && tool.name).toBe('get_order_status');
    expect(mine.events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join('')).not.toContain(
      'پیدا نشد',
    );

    const guest = await ask(agentFor(app), `سفارش ${order.orderNumber} کجاست؟`);
    expect(guest.events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join('')).toContain(
      'وارد حساب کاربری',
    );

    const other = await newCustomer(app);
    const foreign = await ask(other.agent, `سفارش ${order.orderNumber} کجاست؟`);
    expect(foreign.events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join('')).toContain(
      'پیدا نشد',
    );
  });

  it('enforces the hourly limit and the monthly budget', async () => {
    await configure({ assistantHourlyLimit: 5 });
    const guest = agentFor(app);
    for (let i = 0; i < 5; i += 1) expect((await ask(guest, 'سلام')).status).toBe(200);
    const limited = await ask(guest, 'سلام');
    expect(limited.status).toBe(429);
    expect((limited.body as ApiErrorBody).error.code).toBe('RATE_LIMITED');

    await configure({ monthlyBudgetUsd: 1 });
    await prisma.aiUsage.create({
      data: { feature: 'assistant', model: 'claude-opus-5-5', costMicros: 2_000_000n },
    });
    const overBudget = await ask(agentFor(app), 'سلام');
    const error = overBudget.events.find((e) => e.type === 'error');
    expect(error && error.type === 'error' && error.message).toContain('بودجه');
    await prisma.aiUsage.deleteMany({ where: { costMicros: 2_000_000n } });
    await configure({});
  });
});
