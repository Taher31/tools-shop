import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { QuestionView } from '@toolshop/shared';
import { aiSettingsSchema } from '@toolshop/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { CacheService } from '../../src/infrastructure/redis/cache.service';
import { AiStaffService } from '../../src/modules/ai/ai-staff.service';
import { ADMIN, type Agent, API, createTestApp, login, newCustomer } from './support/app';

const stream = (content: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n` +
  `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`;

describe('AI-first reviews and questions', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let server: Server;
  let staff: AiStaffService;
  let productId: string;
  let slug: string;

  const configure = async (overrides: Record<string, unknown> = {}) => {
    const value = aiSettingsSchema.parse({
      enabled: true,
      provider: 'openai_compatible',
      compatBaseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
      compatModel: 'm',
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

  /** Scripted model: behaviour is chosen by markers in the customer text. */
  const reply = (prompt: string): string => {
    if (prompt.includes('customer_question')) {
      if (prompt.includes('MARK_SPAM'))
        return '{"answer":"","confidence":0.9,"needs_human":false,"inappropriate":true,"notes":""}';
      if (prompt.includes('MARK_UNKNOWN'))
        return '{"answer":"","confidence":0.1,"needs_human":true,"inappropriate":false,"notes":"داده کافی نیست"}';
      if (prompt.includes('MARK_LOW'))
        return '{"answer":"احتمالاً بله.","confidence":0.3,"needs_human":false,"inappropriate":false,"notes":""}';
      return '{"answer":"بله، گارانتی ۱۸ ماهه دارد.","confidence":0.8,"needs_human":false,"inappropriate":false,"notes":""}';
    }
    if (prompt.includes('MARK_BAD')) return '{"verdict":"reject","reason":"توهین"}';
    if (prompt.includes('MARK_MAYBE')) return '{"verdict":"needs_human","reason":"مبهم"}';
    return '{"verdict":"approve","reason":"نظر صادقانه"}';
  };

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c: Buffer) => (raw += c.toString()));
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.end(stream(reply(raw)));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    app = await createTestApp();
    prisma = app.get(PrismaService);
    staff = app.get(AiStaffService);
    admin = await login(app, ADMIN.identifier, ADMIN.password);
    const product = await prisma.product.findFirstOrThrow({
      where: { status: 'active', deletedAt: null },
    });
    productId = product.id;
    slug = product.slug;
    await configure();
  });

  afterAll(async () => {
    await app?.close();
    server?.close();
  });

  const review = async (body: string, rating = 5) => {
    const customer = await newCustomer(app);
    const res = await customer.agent
      .post(`${API}/products/${productId}/reviews`)
      .send({ rating, body });
    expect(res.status).toBeLessThan(300);
    return prisma.review.findFirstOrThrow({ where: { body }, orderBy: { createdAt: 'desc' } });
  };

  it('approves clean reviews (including negative ones) right away and records it as the AI', async () => {
    const good = await review('خیلی خوب بود، من خرید کردم و راضی‌ام.');
    expect(await staff.moderateReview(good.id)).toBe('approve');
    expect((await prisma.review.findUniqueOrThrow({ where: { id: good.id } })).status).toBe(
      'approved',
    );
    const bad = await review('کیفیت پایین بود و پشیمانم.', 1);
    expect(await staff.moderateReview(bad.id)).toBe('approve');
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'review.ai_moderate', entityId: good.id },
    });
    expect(audit?.actorType).toBe('ai');
  });

  it('rejects abuse, holds doubtful reviews and never auto-approves links or phone numbers', async () => {
    const abusive = await review('MARK_BAD این فروشگاه کلاهبردار است');
    expect(await staff.moderateReview(abusive.id)).toBe('reject');
    expect((await prisma.review.findUniqueOrThrow({ where: { id: abusive.id } })).status).toBe(
      'rejected',
    );

    const unsure = await review('MARK_MAYBE نظر مبهم درباره محصول');
    expect(await staff.moderateReview(unsure.id)).toBe('needs_human');
    expect((await prisma.review.findUniqueOrThrow({ where: { id: unsure.id } })).status).toBe(
      'pending',
    );

    const spam = await review('عالی بود! خرید از https://spam.example/shop و تماس 09123456789');
    expect(await staff.moderateReview(spam.id)).toBe('needs_human');
    expect((await prisma.review.findUniqueOrThrow({ where: { id: spam.id } })).status).toBe(
      'pending',
    );
  });

  it('does not overwrite a decision a person already made', async () => {
    const mine = await review('نظر بررسی‌شده توسط کارشناس');
    await prisma.review.update({ where: { id: mine.id }, data: { status: 'rejected' } });
    await staff.moderateReview(mine.id);
    expect((await prisma.review.findUniqueOrThrow({ where: { id: mine.id } })).status).toBe(
      'rejected',
    );
  });

  const question = async (body: string) => {
    const customer = await newCustomer(app);
    const res = await customer.agent.post(`${API}/products/${productId}/questions`).send({ body });
    expect(res.status).toBeLessThan(300);
    return prisma.productQuestion.findFirstOrThrow({
      where: { body },
      orderBy: { createdAt: 'desc' },
    });
  };
  const publicList = async () =>
    (await admin.get(`${API}/products/${productId}/questions?pageSize=100`)).body as {
      items: QuestionView[];
    };

  it('answers questions itself, labelled as AI, and shows them publicly', async () => {
    const q = await question('آیا این محصول گارانتی دارد؟ MARK_OK');
    await staff.suggestQuestionAnswer(q.id, true);
    const row = await prisma.productQuestion.findUniqueOrThrow({ where: { id: q.id } });
    expect(row).toMatchObject({ status: 'answered', answeredByAi: true, answeredById: null });
    const shown = (await publicList()).items.find((x) => x.id === q.id);
    expect(shown).toMatchObject({ answeredByAi: true, answeredBy: 'دستیار هوشمند فروشگاه' });
    expect(shown?.answer).toContain('گارانتی');
  });

  it('leaves an expert notice when it cannot answer, and rejects abusive questions', async () => {
    const unknown = await question('سؤال سخت MARK_UNKNOWN درباره سازگاری');
    await staff.suggestQuestionAnswer(unknown.id, true);
    const row = await prisma.productQuestion.findUniqueOrThrow({ where: { id: unknown.id } });
    expect(row.status).toBe('pending');
    expect(row.expertNotice).toContain('ساعت');
    const shown = (await publicList()).items.find((x) => x.id === unknown.id);
    expect(shown).toMatchObject({ answer: null });
    expect(shown?.expertNotice).toContain('کارشناس');

    const low = await question('سؤال MARK_LOW با اطمینان کم');
    await staff.suggestQuestionAnswer(low.id, true);
    expect((await prisma.productQuestion.findUniqueOrThrow({ where: { id: low.id } })).status).toBe(
      'pending',
    );
    await configure({ qaAutoPublishMinConfidence: 0.2 });
    await staff.suggestQuestionAnswer(low.id, true);
    expect((await prisma.productQuestion.findUniqueOrThrow({ where: { id: low.id } })).status).toBe(
      'answered',
    );
    await configure();

    const spam = await question('تبلیغ MARK_SPAM بخرید');
    await staff.suggestQuestionAnswer(spam.id, true);
    expect(
      (await prisma.productQuestion.findUniqueOrThrow({ where: { id: spam.id } })).status,
    ).toBe('rejected');
    expect((await publicList()).items.find((x) => x.id === spam.id)).toBeUndefined();
  });

  it('keeps a human in charge when auto-answering is off and lets staff replace AI answers', async () => {
    await configure({ qaAutoPublish: false, qaHoldingNotice: false });
    const q = await question('سؤال بدون پاسخ خودکار MARK_OK');
    await staff.suggestQuestionAnswer(q.id, true);
    const row = await prisma.productQuestion.findUniqueOrThrow({ where: { id: q.id } });
    expect(row).toMatchObject({ status: 'pending', expertNotice: null });
    expect(row.aiSuggestedAnswer).toBeTruthy();
    await configure();

    const answered = await question('سؤال برای جایگزینی MARK_OK');
    await staff.suggestQuestionAnswer(answered.id, true);
    const res = await admin
      .put(`${API}/admin/questions/${answered.id}/answer`)
      .send({ status: 'answered', answer: 'پاسخ کارشناس' });
    expect(res.status).toBe(200);
    expect(
      await prisma.productQuestion.findUniqueOrThrow({ where: { id: answered.id } }),
    ).toMatchObject({
      answeredByAi: false,
      answer: 'پاسخ کارشناس',
    });
    void slug;
  });
});
