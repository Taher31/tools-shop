import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { getQueueToken } from '@nestjs/bullmq';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { MessengerChannelView } from '@toolshop/shared';
import { aiSettingsSchema } from '@toolshop/shared';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { QUEUES } from '../../src/infrastructure/queue/queue.constants';
import { CacheService } from '../../src/infrastructure/redis/cache.service';
import {
  type MessengerJob,
  MessengerService,
} from '../../src/modules/ai/messengers/messenger.service';
import { ADMIN, type Agent, API, createTestApp, login, SUPPORT } from './support/app';
import { ok } from './support/commerce';

const TOKEN = '123456:TEST-token-abcdefXYZ1';

interface BotCall {
  token: string;
  method: string;
  params: Record<string, unknown>;
}

/** Stand-in for api.telegram.org: records calls, rejects any token but TOKEN. */
function fakeBotApi(calls: BotCall[]): Promise<Server> {
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      const [, token = '', method = ''] = /^\/bot([^/]+)\/(\w+)$/.exec(req.url ?? '') ?? [];
      const params = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      calls.push({ token, method, params });
      res.setHeader('content-type', 'application/json');
      if (token !== TOKEN) {
        res.statusCode = 401;
        res.end(JSON.stringify({ ok: false, error_code: 401, description: 'Unauthorized' }));
        return;
      }
      const result =
        method === 'getMe' ? { id: 1, is_bot: true, username: 'toolshop_test_bot' } : true;
      res.end(JSON.stringify({ ok: true, result }));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

describe('AI messenger bots', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let support: Agent;
  let server: Server;
  let queue: Queue<MessengerJob>;
  let secret = '';
  const calls: BotCall[] = [];
  let updateId = 1000;

  const update = (chatId: number, text: string | undefined, type = 'private') => ({
    update_id: (updateId += 1),
    message: {
      message_id: updateId,
      chat: { id: chatId, type },
      from: { id: chatId, is_bot: false, first_name: 'Test' },
      ...(text !== undefined ? { text } : {}),
    },
  });

  /** Delivers an update like the platform would, then runs the queued job inline. */
  async function deliver(body: ReturnType<typeof update>) {
    const response = await request(app.getHttpServer())
      .post(`${API}/webhooks/messenger/telegram/${secret}`)
      .set('x-telegram-bot-api-secret-token', secret)
      .send(body);
    expect(response.status).toBe(200);
    const job = await queue.getJob(`telegram-${body.update_id}`);
    if (job) await app.get(MessengerService).handle(job.data);
    return job;
  }

  const sent = (chatId: number) =>
    calls.filter((c) => c.method === 'sendMessage' && c.params['chat_id'] === String(chatId));

  beforeAll(async () => {
    server = await fakeBotApi(calls);
    process.env['TELEGRAM_API_BASE'] = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    app = await createTestApp();
    prisma = app.get(PrismaService);
    queue = app.get(getQueueToken(QUEUES.MESSENGER));
    [admin, support] = await Promise.all([
      login(app, ADMIN.identifier, ADMIN.password),
      login(app, SUPPORT.identifier, SUPPORT.password),
    ]);
    const value = aiSettingsSchema.parse({
      enabled: true,
      provider: 'mock',
      features: { assistant: true, messenger: true, qa: true, support: true, content: true },
    });
    await prisma.setting.upsert({
      where: { key: 'ai' },
      update: { value },
      create: { key: 'ai', value },
    });
    await app.get(CacheService).del('ai:settings');
  });

  afterAll(async () => {
    await app?.close();
    server?.close();
    delete process.env['TELEGRAM_API_BASE'];
  });

  it('verifies the bot token, stores it encrypted and registers a secret webhook', async () => {
    const rejected = await admin
      .put(`${API}/admin/ai/messengers/telegram`)
      .send({ enabled: true, botToken: 'wrong:token' });
    expect(rejected.status).toBe(400);

    expect(
      (await support.put(`${API}/admin/ai/messengers/telegram`).send({ enabled: true })).status,
    ).toBe(403);

    const view = ok<MessengerChannelView>(
      await admin
        .put(`${API}/admin/ai/messengers/telegram`)
        .send({ enabled: true, botToken: TOKEN }),
    );
    expect(view).toMatchObject({
      enabled: true,
      botUsername: 'toolshop_test_bot',
      token: { configured: true, preview: '••••XYZ1' },
    });
    const row = await prisma.setting.findUniqueOrThrow({ where: { key: 'messenger:telegram' } });
    expect(JSON.stringify(row.value)).not.toContain(TOKEN);

    const registered = ok<MessengerChannelView>(
      await admin.post(`${API}/admin/ai/messengers/telegram/webhook`),
    );
    const call = calls.find((c) => c.method === 'setWebhook');
    const url = String(call?.params['url']);
    secret = url.split('/').at(-1) ?? '';
    expect(url).toContain('/api/v1/webhooks/messenger/telegram/');
    expect(call?.params['secret_token']).toBe(secret);
    expect(secret.length).toBeGreaterThan(20);
    expect(registered.webhookUrl).not.toContain(secret);

    const list = ok<MessengerChannelView[]>(await admin.get(`${API}/admin/ai/messengers`));
    expect(list.find((c) => c.channel === 'eitaa')?.available).toBe(false);
    expect(JSON.stringify(list)).not.toContain(TOKEN);
  });

  it('rejects deliveries without the right secret', async () => {
    const server_ = request(app.getHttpServer());
    const body = update(5001, 'سلام');
    expect((await server_.post(`${API}/webhooks/messenger/telegram/nope`).send(body)).status).toBe(
      404,
    );
    expect(
      (
        await server_
          .post(`${API}/webhooks/messenger/telegram/${secret}`)
          .set('x-telegram-bot-api-secret-token', 'forged')
          .send(body)
      ).status,
    ).toBe(404);
    expect((await server_.post(`${API}/webhooks/messenger/bale/${secret}`).send(body)).status).toBe(
      404,
    );
    expect((await server_.post(`${API}/webhooks/messenger/x/${secret}`).send(body)).status).toBe(
      404,
    );
  });

  it('answers customers in private chats through the store assistant', async () => {
    await deliver(update(7001, '/start'));
    expect(sent(7001)[0]?.params['text']).toContain('/new');

    const job = await deliver(update(7001, 'فرز'));
    expect(job?.data.text).toBe('فرز');
    const replies = sent(7001);
    expect(replies).toHaveLength(2);
    expect(String(replies[1]?.params['text']).length).toBeGreaterThan(5);
    expect(calls.some((c) => c.method === 'sendChatAction')).toBe(true);

    const conversation = await prisma.aiConversation.findUniqueOrThrow({
      where: { channel_externalChatId: { channel: 'telegram', externalChatId: '7001' } },
      include: { messages: true },
    });
    expect(conversation.messages.some((m) => m.role === 'user' && m.text === 'فرز')).toBe(true);

    // Duplicate delivery of the same update is de-duplicated by the queue.
    const again = await queue.getJob(job?.id ?? '');
    expect(again?.id).toBe(job?.id);

    // /new starts a fresh conversation but keeps the old one for the AI Center.
    await deliver(update(7001, '/new'));
    expect(
      await prisma.aiConversation.findUnique({
        where: { channel_externalChatId: { channel: 'telegram', externalChatId: '7001' } },
      }),
    ).toBeNull();
    expect(
      await prisma.aiConversation.findUnique({ where: { id: conversation.id } }),
    ).not.toBeNull();
  });

  it('ignores groups and bots and explains unsupported messages', async () => {
    expect(await deliver(update(-9001, 'سلام همه', 'group'))).toBeUndefined();
    await deliver(update(7002, undefined));
    expect(String(sent(7002)[0]?.params['text'])).toContain('متنی');
  });

  it('cannot enable a platform without a documented bot API', async () => {
    const response = await admin.put(`${API}/admin/ai/messengers/eitaa`).send({ enabled: true });
    expect(response.status).toBe(409);
  });
});
